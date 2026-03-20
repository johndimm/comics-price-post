import "dotenv/config";
import { getAllComics } from "../lib/comics";
import { syncEbayData } from "../lib/sync";

async function main() {
    const comics = getAllComics().filter(c => c.marvel_id.startsWith("local-"));
    console.log(`Syncing ${comics.length} local comics...`);

    for (let i = 0; i < comics.length; i++) {
        const c = comics[i];
        console.log(`[${i + 1}/${comics.length}] ${c.title} #${c.number} (${c.year})`);
        await syncEbayData(c.marvel_id, c.title, c.number, c.year);
        await new Promise(r => setTimeout(r, 200));
    }

    console.log("Done.");
}

main().catch(console.error);
