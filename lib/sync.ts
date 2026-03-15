import db from './db';
import { searchActiveItems, eBayListing } from './ebay';
import { scrapeSoldItems } from './scraper';

export async function syncEbayData(marvelId: string, title: string, number: string, year: number | string) {
    const query = `${title} ${number} (${year})`;

    try {
        // Fetch sold listings using our Stealth Puppeteer scraper
        const soldItems = await scrapeSoldItems(query, 50, number, year);

        // Fetch active listings using the official eBay Browse API (failures are non-fatal)
        let activeItems: eBayListing[] = [];
        try {
            activeItems = await searchActiveItems(query, 50, number, year);
        } catch (activeErr) {
            console.warn(`Active listings fetch failed for ${query}: ${(activeErr as Error).message}`);
        }

        // Put active items first, so sold items (if overlapping) will overwrite them
        // and retain the 'sold' type in the database.
        const allItems = [
            ...activeItems.map(i => ({ ...i, type: 'asking' as const })),
            ...soldItems.map(i => ({ ...i, type: 'sold' as const }))
        ];

        const insertListing = db.prepare(`
          INSERT OR REPLACE INTO ebay_listings 
          (item_id, marvel_id, type, price, currency, sale_date, grade, is_slabbed, raw_title, listing_url, image_url)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        db.transaction(() => {
            let logCount = 0;
            for (const item of allItems) {
                if (item.type === 'asking' && logCount < 3) {
                    console.log(`Inserting active item: saleDate=${item.saleDate}`);
                    logCount++;
                }
                insertListing.run(
                    item.itemId,
                    marvelId,
                    item.type,
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
