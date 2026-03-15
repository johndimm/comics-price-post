import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { eBayListing } from './ebay.js';

puppeteer.use(StealthPlugin());

// Temporarily redefine parseGrade here, or we could export it from ebay.ts
function parseGrade(title: string, issueNumber?: string, year?: string | number): number | undefined {
    let t = title.toUpperCase();

    if (issueNumber) {
        const numPattern = new RegExp(`\\b${issueNumber}\\b`, 'g');
        t = t.replace(numPattern, ' ');
    }
    if (year) {
        const yearPattern = new RegExp(`\\b${year}\\b`, 'g');
        t = t.replace(yearPattern, ' ');
    }

    const numMatch = t.match(/\b(10\.0|[0-9]\.[0-5|8])\b/);
    if (numMatch) {
        const val = parseFloat(numMatch[1]);
        if (val >= 0.5 && val <= 10.0) return val;
    }

    if (t.includes('VERY FINE/NEAR MINT') || t.includes('VF/NM')) return 9.0;
    if (t.includes('FINE/VERY FINE') || t.includes('FN/VF') || t.includes('F/VF')) return 7.0;
    if (t.includes('VERY GOOD/FINE') || t.includes('VG/FN') || t.includes('VG/F')) return 5.0;
    if (t.includes('GOOD/VERY GOOD') || t.includes('GD/VG') || t.includes('G/VG')) return 3.0;
    if (t.includes('FAIR/GOOD') || t.includes('FR/GD') || t.includes('F/G')) return 1.5;

    if (t.includes('NEAR MINT+') || t.includes('NM+')) return 9.6;
    if (t.includes('NEAR MINT-') || t.includes('NM-')) return 9.2;
    if (t.includes('NEAR MINT') || t.includes('NM')) return 9.4;
    if (t.includes('VERY FINE+') || t.includes('VF+')) return 8.5;
    if (t.includes('VERY FINE') || t.includes('VF')) return 8.0;
    if (t.includes('FINE+') || t.includes('FN+')) return 6.5;
    if (t.includes('FINE') || t.includes('FN')) return 6.0;
    if (t.includes('VERY GOOD') || t.includes('VG')) return 4.0;
    if (t.includes('GOOD') || t.includes('GD')) return 2.0;
    if (t.includes('FAIR') || t.includes('FR')) return 1.0;
    if (t.includes('POOR') || t.includes('PR')) return 0.5;
    if (t.includes('GEM MINT') || t.includes('GM')) return 10.0;
    if (t.includes('MINT') || t.includes('MT')) return 9.9;

    return undefined;
}

export async function scrapeSoldItems(query: string, limit: number = 20, issueNumber?: string, year?: string | number): Promise<eBayListing[]> {
    const encodedQuery = encodeURIComponent(query);
    // LH_Sold=1 and LH_Complete=1 are required to view completed/sold listings
    const url = `https://www.ebay.com/sch/i.html?_nkw=${encodedQuery}&LH_Sold=1&LH_Complete=1&_ipg=60`;

    // Use headless: "new" or true. Using standard user agent to avoid basic blocks.
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
    });
    // Set a realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Wait for results to be somewhat visible, don't strictly require it in case of no results
        await page.waitForSelector('.srp-results', { timeout: 5000 }).catch(() => { });

        const rawListings = await page.evaluate(() => {
            const results: any[] = [];
            // Target the result items
            const itemNodes = document.querySelectorAll('li.s-item, li.s-card');

            itemNodes.forEach(node => {
                // Ignore the "Shop on eBay" pseudo-item
                if (node.classList.contains('s-item__pl-on-bottom')) return;

                const titleEl = node.querySelector('.s-item__title span, .s-card__title span');
                const priceEl = node.querySelector('.s-item__price, .s-card__price');
                const linkEl = node.querySelector('a.s-item__link, a.s-card__link') as HTMLAnchorElement;
                const imgEl = node.querySelector('.s-item__image-img, .s-card__image-img, .s-card__link img') as HTMLImageElement;
                if (titleEl && priceEl && linkEl) {
                    const title = titleEl.textContent || '';
                    if (title.toLowerCase().includes('shop on ebay')) return; // Extra check

                    let priceText = priceEl.textContent || '';
                    const priceMatch = priceText.match(/[\d,]+\.\d{2}/);
                    const price = priceMatch ? parseFloat(priceMatch[0].replace(/,/g, '')) : 0;

                    let itemId = '';
                    const urlMatch = linkEl.href.match(/\/itm\/(\d+)/);
                    if (urlMatch) {
                        itemId = urlMatch[1];
                    }

                    let dateSold = '';
                    const nodeText = node.textContent || '';
                    // Looking for patterns like "Sold Mar 8, 2026" anywhere in the item's text
                    const dateMatch = nodeText.match(/Sold\s+([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})/i);
                    if (dateMatch) {
                        dateSold = dateMatch[1].trim();
                    }

                    results.push({
                        itemId,
                        title,
                        price,
                        currency: 'USD',
                        listingUrl: linkEl.href,
                        imageUrl: imgEl ? imgEl.src : undefined,
                        dateSoldRaw: dateSold
                    });
                }
            });
            return results;
        });

        // Map raw listings to our eBayListing type
        const listings: eBayListing[] = rawListings.map(raw => {
            const isSlabbed = /CGC|CBCS|PGX/i.test(raw.title);
            const grade = parseGrade(raw.title, issueNumber, year);

            // Try to parse the date into ISO format (YYYY-MM-DD)
            let formattedDate = raw.dateSoldRaw;
            try {
                if (raw.dateSoldRaw) {
                    const d = new Date(raw.dateSoldRaw);
                    if (!isNaN(d.getTime())) {
                        formattedDate = d.toISOString().split('T')[0];
                    }
                }
            } catch (e) {
                // Ignore date parsing errors
            }

            return {
                itemId: raw.itemId || `scraped-${Math.random().toString(36).substr(2, 9)}`,
                title: raw.title,
                price: raw.price,
                currency: raw.currency,
                saleDate: formattedDate,
                listingUrl: raw.listingUrl,
                imageUrl: raw.imageUrl,
                isSlabbed,
                grade,
                type: 'sold'
            };
        });

        // Filter out zero-price or invalid items, ensure issue number matches, and respect the limit
        return listings.filter(l => {
            if (l.price <= 0 || l.itemId.length <= 5) return false;
            if (issueNumber && !new RegExp(`\\b${issueNumber}\\b`).test(l.title)) return false;
            return true;
        }).slice(0, limit);

    } catch (error) {
        console.error("Puppeteer scraping error:", error);
        return [];
    } finally {
        await browser.close();
    }
}
