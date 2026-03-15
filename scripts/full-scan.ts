import "dotenv/config";
import { getAllComics } from "../lib/comics";
import { syncEbayData } from "../lib/sync";

async function fullScan() {
    console.log("Starting full eBay scan of collection...");
    const comics = getAllComics();
    console.log(`Found ${comics.length} comics to scan.`);

    for (let i = 0; i < comics.length; i++) {
        const c = comics[i];
        console.log(`[${i + 1}/${comics.length}] Scanning ${c.title} #${c.number} (${c.year}) (${c.marvel_id})...`);
        await syncEbayData(c.marvel_id, c.title, c.number, c.year);

        // Brief delay to avoid hitting rate limits too fast (Browse API limit is 5000/day)
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log("Full scan completed.");
}

fullScan().catch(console.error);
