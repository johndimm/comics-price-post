/**
 * Core agent logic — scans comics and generates action items.
 * Safe to run multiple times (idempotent via upsertAction).
 */
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { getAllComics } from './comics';
import { readLedger } from './offer-ledger';
import { SHORTBOXED_CATALOG } from './shortboxed-catalog';
import { upsertAction } from './agent-actions';

function loadPhotosSet(): Set<string> {
    const csvPath = path.join(process.cwd(), 'public', 'comic-photos', 'comics-images.csv');
    if (!fs.existsSync(csvPath)) return new Set();
    const content = fs.readFileSync(csvPath, 'utf-8');
    const result = Papa.parse<string[]>(content, { skipEmptyLines: true });
    const rows = result.data;
    const hasPhoto = new Set<string>();
    // headers: comic_id, area, photo
    for (let i = 1; i < rows.length; i++) {
        const [comic_id, , photo] = rows[i];
        if (comic_id && photo && photo.trim()) {
            hasPhoto.add(comic_id.trim());
        }
    }
    return hasPhoto;
}

export async function runAgent(): Promise<{ summary: string[] }> {
    const summary: string[] = [];

    const comics = getAllComics();
    const ledger = readLedger();
    const sbActiveIds = new Set(
        SHORTBOXED_CATALOG.filter(e => e.status === 'active').map(e => e.marvelId)
    );
    const photosSet = loadPhotosSet();

    // Build a map: marvelId → active ledger entries (published or has listingId)
    const activeListings = new Map<string, typeof ledger[0]>();
    for (const entry of ledger) {
        if (!entry.marvelId) continue;
        const isActive =
            entry.status === 'published' ||
            (!entry.status && !!entry.listingId);
        if (isActive && !activeListings.has(entry.marvelId)) {
            activeListings.set(entry.marvelId, entry);
        }
    }

    let created = 0;
    let updated = 0;

    for (const comic of comics) {
        const isSold = !!(comic.sold_price || comic.sold_date);
        const isNFS = comic.for_sale === 'NFS';
        if (isSold || isNFS) continue;

        const isCGC = !!(comic.cgc && comic.cgc.length > 0);
        const fmv = comic.fmv ?? 0;
        const grade = comic.grade ?? 0;
        const marvelId = comic.marvel_id;
        const comicTitle = `${comic.title} #${comic.number}`;

        // Heritage candidate: CGC 8.5+, fmv >= 800
        const isHeritageCandidate = isCGC && grade >= 8.5 && fmv >= 800;

        if (isHeritageCandidate) {
            upsertAction({
                type: 'submit_heritage',
                priority: 1,
                marvelId,
                comicTitle,
                details: {
                    grade: comic.grade,
                    cgc: comic.cgc,
                    fmv,
                    fmv_high: comic.fmv_high,
                },
            });
            created++;
            continue; // heritage candidates skip other actions
        }

        if (!isCGC) {
            // not a CGC — skip agent actions (only CGC items are managed)
            continue;
        }

        const onEbay = activeListings.has(marvelId);
        const onShortboxed = sbActiveIds.has(marvelId);
        const hasPhotos = photosSet.has(marvelId);

        // eBay draft or needs_photos
        if (!onEbay) {
            if (hasPhotos) {
                const recommendedAsk = comic.recommended_ask ?? (fmv > 0 ? fmv : null);
                upsertAction({
                    type: 'publish_ebay_draft',
                    priority: 2,
                    marvelId,
                    comicTitle,
                    details: {
                        grade: comic.grade,
                        cgc: comic.cgc,
                        fmv,
                        recommended_ask: recommendedAsk,
                    },
                });
                created++;
            } else {
                upsertAction({
                    type: 'needs_photos',
                    priority: 3,
                    marvelId,
                    comicTitle,
                    details: {
                        grade: comic.grade,
                        cgc: comic.cgc,
                        fmv,
                    },
                });
                created++;
            }
        }

        // Shortboxed: CGC, not on Shortboxed, not heritage
        if (!onShortboxed) {
            const priceSuggestion = comic.recommended_ask ?? (fmv > 0 ? fmv : null);
            upsertAction({
                type: 'list_shortboxed',
                priority: 2,
                marvelId,
                comicTitle,
                details: {
                    grade: comic.grade,
                    cgc: comic.cgc,
                    fmv,
                    suggested_price: priceSuggestion,
                },
            });
            created++;
        }

        // Price update: active eBay listing, fmv exists, price differs > 15%
        if (onEbay && fmv > 0) {
            const listing = activeListings.get(marvelId)!;
            const currentPrice = parseFloat(listing.price ?? '0');
            if (currentPrice > 0) {
                const diff = Math.abs(currentPrice - fmv) / fmv;
                if (diff > 0.15) {
                    upsertAction({
                        type: 'update_ebay_price',
                        priority: 2,
                        marvelId,
                        comicTitle,
                        details: {
                            grade: comic.grade,
                            cgc: comic.cgc,
                            fmv,
                            currentPrice,
                            suggestedPrice: comic.recommended_ask ?? fmv,
                            offerId: listing.offerId,
                            listingId: listing.listingId,
                        },
                    });
                    updated++;
                }
            }
        }
    }

    summary.push(`Agent run complete: ${created} actions created/updated, ${updated} price updates flagged`);
    return { summary };
}
