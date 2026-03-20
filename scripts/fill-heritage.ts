/**
 * Fill Heritage auction data for all comics that don't yet have any Heritage sold records.
 * Skips eBay — Heritage only. Safe to re-run; already-filled comics are skipped.
 *
 * Journey Into Mystery / Thor title note:
 *   JIM ran through #125 (1966), then became Thor with #126.
 *   Our CSV stores all as "Mighty Thor", but Heritage catalogs #83-125 as "Journey Into Mystery".
 */
import "dotenv/config";
import { getAllComics } from "../lib/comics";
import { scrapeHeritageSold } from "../lib/heritage";
import db from "../lib/db";
// Comics where our CSV title differs from Heritage's catalog title
function heritageTitle(title: string, number: string): string {
    if (title === "Mighty Thor" && parseInt(number) <= 125) return "Journey Into Mystery";
    return title;
}

const insertListing = db.prepare(`
    INSERT OR IGNORE INTO ebay_listings
    (item_id, marvel_id, type, source, price, currency, sale_date, grade, is_slabbed, raw_title, listing_url, image_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

async function main() {
    const comics = getAllComics();
    console.log(`Found ${comics.length} comics. Checking Heritage coverage...\n`);

    const alreadyFilled = new Set<string>(
        (db.prepare("SELECT DISTINCT marvel_id FROM ebay_listings WHERE source='heritage'").all() as any[])
            .map((r: any) => r.marvel_id)
    );

    const toFill = comics.filter(c => !alreadyFilled.has(c.marvel_id));
    console.log(`${alreadyFilled.size} already have Heritage data. Filling ${toFill.length} remaining.\n`);

    let filled = 0;
    let skipped = 0;

    for (let i = 0; i < toFill.length; i++) {
        const c = toFill[i];
        const searchTitle = heritageTitle(c.title, c.number);
        process.stdout.write(`[${i + 1}/${toFill.length}] ${c.title} #${c.number} (${c.year})... `);

        try {
            const lots = await scrapeHeritageSold(
                `${searchTitle} ${c.number} ${c.year}`,
                30,
                c.number,
                c.year,
                [searchTitle.toLowerCase()]
            );

            if (lots.length > 0) {
                const tx = db.transaction(() => {
                    for (const lot of lots) {
                        insertListing.run(
                            lot.itemId, c.marvel_id, 'sold', 'heritage',
                            lot.price, 'USD', lot.saleDate,
                            lot.grade ?? null, lot.isSlabbed ? 1 : 0,
                            lot.title, lot.listingUrl, lot.imageUrl
                        );
                    }
                });
                tx();
                console.log(`${lots.length} lots`);
                filled++;
            } else {
                console.log('0 lots');
                skipped++;
            }
        } catch (e) {
            console.log(`ERROR: ${(e as Error).message}`);
        }

        // Small delay to be polite to Heritage
        await new Promise(r => setTimeout(r, 500));
    }

    console.log(`\nDone. Filled: ${filled}, No results: ${skipped}`);
}

main().catch(console.error);
