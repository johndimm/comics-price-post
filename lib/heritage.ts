import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';
puppeteer.use(StealthPlugin());

function parseGrade(title: string, issueNumber?: string, year?: string | number): number | undefined {
    let t = title.toUpperCase();
    // CGC/CBCS/PGX Signature Series — exclude
    if (/\b(?:CGC|CBCS|PGX)\s+SS\b/.test(t) || /\bSIGNED\b/.test(t)) return undefined;

    if (issueNumber) t = t.replace(new RegExp(`\\b${issueNumber}(?!\\.)`, 'g'), ' ');
    if (year) t = t.replace(new RegExp(`\\b${year}\\b`, 'g'), ' ');

    // CGC/CBCS/PGX grade first
    const slabMatch = t.match(/\b(?:CGC|CBCS|PGX)\s*(\d+\.?\d*|\.\d+)\b/);
    if (slabMatch) { const v = parseFloat(slabMatch[1]); if (v >= 0.5 && v <= 10.0) return v; }

    const numMatch = t.match(/\b(10\.0|\d\.\d)\b/);
    if (numMatch) { const v = parseFloat(numMatch[1]); if (v >= 0.5 && v <= 10.0) return v; }

    if (t.includes('NM/MT') || t.includes('NM MT')) return 9.8;
    if (t.includes('NM+')) return 9.6;
    if (t.includes('NM-')) return 9.2;
    if (t.includes('VF/NM') || t.includes('VF NM')) return 9.0;
    if (t.includes('VF+')) return 8.5;
    if (t.includes('VF')) return 8.0;
    if (t.includes('FN/VF') || t.includes('FN VF')) return 7.0;
    if (t.includes('FN+')) return 6.5;
    if (t.includes('FN')) return 6.0;
    if (t.includes('VG/FN') || t.includes('VG FN')) return 5.0;
    if (t.includes('VG+')) return 4.5;
    if (t.includes('VG')) return 4.0;
    if (t.includes('GD/VG') || t.includes('GD VG')) return 3.0;
    if (t.includes('GD+')) return 2.5;
    if (t.includes('GD')) return 2.0;
    if (t.includes('FR/GD') || t.includes('FR GD')) return 1.5;
    if (t.includes('FR')) return 1.0;
    if (t.includes('PR')) return 0.5;
    if (t.includes('NM')) return 9.4;
    return undefined;
}

export interface HeritageLot {
    itemId: string;       // "auction-lot" e.g. "7152-91136"
    title: string;
    price: number;
    grade: number | undefined;
    isSlabbed: boolean;
    saleDate: string | null;
    listingUrl: string;
    imageUrl: string | null;
}

function loadCookies(): any[] | null {
    const cookiePath = path.join(process.cwd(), 'data', 'heritage-cookies.json');
    if (!fs.existsSync(cookiePath)) return null;
    try {
        return JSON.parse(fs.readFileSync(cookiePath, 'utf-8'));
    } catch {
        return null;
    }
}

export async function scrapeHeritageSold(
    query: string,
    limit: number = 30,
    issueNumber?: string,
    year?: string | number,
    requiredWords?: string[]
): Promise<HeritageLot[]> {
    const cookies = loadCookies();
    if (!cookies) {
        console.warn('Heritage: no cookies found. Run scripts/heritage-save-cookies.ts first.');
        return [];
    }

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    // Set cookies before navigating
    await page.setCookie(...cookies);

    try {
        // Search archive (past sold) — mode=archive shows realized prices
        const encoded = encodeURIComponent(query);
        const url = `https://comics.ha.com/c/search/results.zx?term=${encoded}&mode=archive`;
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(r => setTimeout(r, 2000));

        const lots = await page.evaluate(() => {
            const items = document.querySelectorAll('li.item-block');
            return Array.from(items).map(item => {
                const titleEl = item.querySelector('.item-title b, .item-title');
                const lotnoEl = item.querySelector('.lotno');
                const priceEl = item.querySelector('.current-amount');
                const linkEl = item.querySelector('a.item-title') as HTMLAnchorElement | null;
                const imgEl = item.querySelector('img.thumbnail, img.preview') as HTMLImageElement | null;

                const title = titleEl?.textContent?.trim() ?? '';
                const lotnoText = lotnoEl?.textContent?.trim() ?? '';
                const priceText = priceEl?.textContent?.trim() ?? '';
                const href = linkEl?.href ?? '';
                const imageUrl = imgEl?.src ?? null;

                // Parse lot ID from URL e.g. /a/7152-91136.s
                const lotMatch = href.match(/\/a\/(\d+-\d+)\.s/);
                const itemId = lotMatch ? 'ha-' + lotMatch[1] : '';

                // Parse date from lotno: "Auction 7152 | Lot: 91136 | Nov 21, 2015"
                const dateMatch = lotnoText.match(/\|\s*([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})\s*$/);
                const dateSold = dateMatch ? dateMatch[1] : '';

                // Parse price: "Sold For: $1,234"
                const priceMatch = priceText.match(/\$([\d,]+)/);
                const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : 0;

                return { title, price, dateSold, href, itemId, imageUrl };
            });
        });

        const results: HeritageLot[] = [];
        for (const lot of lots) {
            if (!lot.title || lot.price <= 0 || !lot.itemId) continue;

            // Skip original art (pages, covers, splash pages, etc.)
            if (/\b(page \d|cover art|splash|panel|original art|original comic art)\b/i.test(lot.title)) continue;

            // Filter by required words
            if (requiredWords) {
                const t = lot.title.toLowerCase();
                if (!requiredWords.every(w => t.includes(w.toLowerCase()))) continue;
            }
            if (issueNumber && !new RegExp(`\\b${issueNumber}\\b`).test(lot.title)) continue;

            // Parse date
            let saleDate: string | null = null;
            if (lot.dateSold) {
                try {
                    const d = new Date(lot.dateSold);
                    if (!isNaN(d.getTime())) saleDate = d.toISOString().split('T')[0];
                } catch { /* ignore */ }
            }

            const isSlabbed = /CGC|CBCS|PGX/i.test(lot.title);
            const grade = parseGrade(lot.title, issueNumber, year);

            results.push({
                itemId: lot.itemId,
                title: lot.title,
                price: lot.price,
                grade,
                isSlabbed,
                saleDate,
                listingUrl: lot.href,
                imageUrl: lot.imageUrl,
            });

            if (results.length >= limit) break;
        }

        return results;
    } catch (err) {
        console.error('Heritage scrape error:', err);
        return [];
    } finally {
        await browser.close();
    }
}
