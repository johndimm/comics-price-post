import { notFound } from "next/navigation";
import Link from "next/link";
import { getAllComics, getComicById, getGradeLabel } from "@/lib/comics";
import { getListingsByComic, calcFMV, getGradeCurvePoints, getComicMetadata } from "@/lib/db";
import ListingClient from "./ListingClient";
import { comicEra, ebayTitle, conditionFromGrade, buildDescription } from "@/lib/ebay-listing";
import { getOffersForComic } from "@/lib/offer-ledger";

interface Params {
    params: Promise<{ id: string }>;
}

export async function generateStaticParams() {
    const comics = getAllComics();
    return comics.map((c) => ({ id: c.marvel_id }));
}


export default async function ListingPage({ params }: Params) {
    const { id } = await params;
    const comic = getComicById(id);
    if (!comic) notFound();

    const listings = getListingsByComic(id);
    const metadata = getComicMetadata(id);
    const soldListings = listings.filter(l => l.type === "sold");
    const askingListings = listings.filter(l => l.type === "asking");

    const gradeCurve = getGradeCurvePoints(id);
    const isSlabbed = comic.grade_category === "slabbed";
    const baseFmv = calcFMV(comic.sold_price, soldListings, askingListings, comic.grade, gradeCurve, isSlabbed);
    const fmvValue = baseFmv.value !== null ? Math.round(baseFmv.value * comic.fmv_multiplier) : null;
    const rawAsk = baseFmv.recommendedAsk ?? (fmvValue ? Math.round(fmvValue * 1.15) : null);
    const rawAskWithMultiplier = rawAsk != null ? Math.round(rawAsk * comic.fmv_multiplier) : null;
    const askPrice = rawAskWithMultiplier != null && fmvValue != null
        ? Math.min(Math.max(rawAskWithMultiplier, Math.round(fmvValue * 1.1)), Math.round(fmvValue * 1.2))
        : rawAskWithMultiplier;

    const gradeLabel = getGradeLabel(comic.grade);
    const title = ebayTitle(comic, gradeLabel);
    const condition = conditionFromGrade(comic.grade);
    const era = comicEra(comic.year);
    const description = buildDescription(comic, gradeLabel, metadata, id);
    const offers = getOffersForComic(id);

    const specifics: [string, string][] = [
        ["Publisher", comic.publisher || "Marvel Comics"],
        ["Publication Year", String(comic.year)],
        ["Issue Number", `#${comic.number}`],
        ["Era", era],
        ["Grade", comic.grade > 0 ? `${comic.grade.toFixed(1)} — ${gradeLabel}` : "Ungraded"],
        ...(isSlabbed ? [["CGC Cert #", comic.cgc && comic.cgc.toLowerCase() !== "yes" ? comic.cgc : "— add before listing"] as [string, string]] : []),
        ...(comic.artist ? [["Cover Artist", comic.artist] as [string, string]] : []),
        ["Genre", comic.genre || "Superhero"],
        ...(comic.is_qualified ? [["Condition Notes", "Qualified grade"] as [string, string]] : []),
    ];

    return (
        <div className="listing-page">
            <div className="listing-nav">
                <Link href={`/comic/${id}`} className="evidence-back">← Back to comic</Link>
                <span className="listing-nav-label">Simulated eBay Listing</span>
            </div>

            {offers.length > 0 && (
                <div style={{ maxWidth: 900, margin: '0 auto 16px', padding: '12px 16px', background: '#0d1a0d', border: '1px solid #2a5c2a', borderRadius: 8, fontSize: 13 }}>
                    <div style={{ fontWeight: 'bold', color: '#6fcf6f', marginBottom: 8 }}>eBay Offer History</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ color: '#888', textAlign: 'left' }}>
                                <th style={{ padding: '3px 10px 3px 0' }}>Date</th>
                                <th style={{ padding: '3px 10px 3px 0' }}>Status</th>
                                <th style={{ padding: '3px 10px 3px 0' }}>Price</th>
                                <th style={{ padding: '3px 10px 3px 0' }}>Offer ID</th>
                                <th style={{ padding: '3px 10px 3px 0' }}>Listing</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[...offers].reverse().map((o, i) => (
                                <tr key={i} style={{ color: '#ccc', borderTop: '1px solid #1a2a1a' }}>
                                    <td style={{ padding: '4px 10px 4px 0' }}>{new Date(o.createdAt).toLocaleDateString()}</td>
                                    <td style={{ padding: '4px 10px 4px 0' }}>
                                        <span style={{ color: o.status === 'published' ? '#6fcf6f' : o.status === 'ended' ? '#f87171' : '#e2c97e' }}>
                                            {o.status ?? 'draft'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '4px 10px 4px 0' }}>${o.price}</td>
                                    <td style={{ padding: '4px 10px 4px 0', fontFamily: 'monospace', fontSize: 12 }}>{o.offerId}</td>
                                    <td style={{ padding: '4px 10px 4px 0' }}>
                                        {o.listingId
                                            ? <a href={`https://www.ebay.com/itm/${o.listingId}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)' }}>View ↗</a>
                                            : <span style={{ color: '#555' }}>—</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <ListingClient
                title={title}
                askPrice={askPrice}
                condition={condition}
                photos={comic.photos}
                specifics={specifics}
                description={description}
                comicTitle={comic.title}
                comicNumber={comic.number}
            />
        </div>
    );
}
