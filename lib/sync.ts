import db from './db';
import { searchActiveItems, eBayListing } from './ebay';
import { scrapeSoldItems } from './scraper';
import { scrapeHeritageSold } from './heritage';

const TITLE_KEYWORDS = ['annual', 'king-size', 'king size', 'giant-size', 'giant size', 'special'];
const STOP_WORDS = new Set(['the', 'a', 'an', 'of', 'and', 'or', 'in', 'for', 'to']);

export async function syncEbayData(marvelId: string, title: string, number: string, year: number | string) {
    if (/replica|facsimile|reprint/i.test(title)) {
        console.log(`Skipping sync for replica/facsimile: ${title} #${number}`);
        return;
    }
    const query = `${title} ${number} (${year})`;
    const tl = title.toLowerCase();
    const keywordMatches = TITLE_KEYWORDS.filter(kw => tl.includes(kw));
    // Require the full title as a phrase so "Motor City Comic Con" doesn't match "Motor City Comics"
    const requiredWords = [...keywordMatches, tl];

    try {
        // Fetch sold listings using our Stealth Puppeteer scraper
        const soldItems = await scrapeSoldItems(query, 50, number, year, requiredWords);

        // Fetch active listings using the official eBay Browse API (failures are non-fatal)
        let activeItems: eBayListing[] = [];
        try {
            activeItems = await searchActiveItems(query, 50, number, year, requiredWords);
        } catch (activeErr) {
            console.warn(`Active listings fetch failed for ${query}: ${(activeErr as Error).message}`);
        }

        // Fetch Heritage auction sold results (requires data/heritage-cookies.json)
        let heritageItems: eBayListing[] = [];
        try {
            const hLots = await scrapeHeritageSold(query, 30, number, year, requiredWords);
            heritageItems = hLots.map(lot => ({
                itemId: lot.itemId,
                title: lot.title,
                price: lot.price,
                currency: 'USD',
                saleDate: lot.saleDate ?? undefined,
                listingUrl: lot.listingUrl,
                imageUrl: lot.imageUrl ?? undefined,
                isSlabbed: lot.isSlabbed,
                grade: lot.grade,
                type: 'sold' as const,
            }));
            if (heritageItems.length > 0) console.log(`Heritage: ${heritageItems.length} sold lots for ${query}`);
        } catch (heritageErr) {
            console.warn(`Heritage fetch failed for ${query}: ${(heritageErr as Error).message}`);
        }

        // Put active items first, so sold items (if overlapping) will overwrite them
        // and retain the 'sold' type in the database.
        const allItems = [
            ...activeItems.map(i => ({ ...i, type: 'asking' as const })),
            ...heritageItems,
            ...soldItems.map(i => ({ ...i, type: 'sold' as const }))
        ];

        const insertListing = db.prepare(`
          INSERT OR REPLACE INTO ebay_listings
          (item_id, marvel_id, type, source, price, currency, sale_date, grade, is_slabbed, raw_title, listing_url, image_url)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        db.transaction(() => {
            let logCount = 0;
            for (const item of allItems) {
                if (item.type === 'asking' && logCount < 3) {
                    console.log(`Inserting active item: saleDate=${item.saleDate}`);
                    logCount++;
                }
                const source = item.itemId.startsWith('ha-') ? 'heritage' : 'ebay';
                insertListing.run(
                    item.itemId,
                    marvelId,
                    item.type,
                    source,
                    item.price,
                    item.currency,
                    item.saleDate,
                    item.grade || null,
                    item.isSlabbed ? 1 : 0,
                    item.title,
                    item.listingUrl,
                    item.imageUrl
                );
            }
        })();

        console.log(`Inserted/Updated ${allItems.length} items for ${query} into DB.`);

        db.prepare(`
          INSERT OR REPLACE INTO sync_log (marvel_id, last_sold_sync, last_asking_sync)
          VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).run(marvelId);

        console.log(`Synced ${soldItems.length} sold & ${activeItems.length} active items for ${query}`);
    } catch (error) {
        console.error(`Error syncing eBay data for ${query}:`, error);
    }
}

export function getCachedSoldItems(marvelId: string) {
    return db.prepare("SELECT * FROM ebay_listings WHERE marvel_id = ? AND type = 'sold'").all(marvelId);
}
