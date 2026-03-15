import "dotenv/config";
import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { syncEbayData } from "../lib/sync";

async function main() {
    const csvPath = path.join(process.cwd(), "public", "Silver Age Marvels - 2026 all comics.csv");
    const content = fs.readFileSync(csvPath, "utf-8");
    const rows = Papa.parse<string[]>(content, { skipEmptyLines: true }).data;
    const headers = rows[0];
    const idx = (name: string) => headers.indexOf(name);

    const candidates = rows.slice(1).filter(row => {
        const cgc = row[idx("CGC")]?.trim();
        const forSale = row[idx("For Sale")]?.trim();
        const soldPrice = row[idx("Sold Price")]?.trim();
        return cgc && !forSale?.includes("ebay.com") && !soldPrice;
    });

    console.log(`Syncing ${candidates.length} unlisted slabbed comics...`);

    for (let i = 0; i < candidates.length; i++) {
        const row = candidates[i];
        const marvel_id = row[idx("marvel_id")].trim();
        const title = row[idx("title")].trim();
        const number = row[idx("number")].trim();
        const year = row[idx("year")].trim();
        console.log(`[${i + 1}/${candidates.length}] ${title} #${number} (${year})`);
        await syncEbayData(marvel_id, title, number, year);
        await new Promise(r => setTimeout(r, 300));
    }

    console.log("Done.");
}

main().catch(console.error);
