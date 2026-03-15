import fs from "fs";
import path from "path";
import Papa from "papaparse";

const csvPath = "/Users/johndimm/projects/comics-price-post/public/Silver Age Marvels - 2026 all comics.csv";
const content = fs.readFileSync(csvPath, "utf-8");
const result = Papa.parse<string[]>(content, { skipEmptyLines: true });
const rows = result.data;
const headers = rows[0];

const idx = (name: string) => headers.indexOf(name);

const comics = rows.slice(1).map(row => ({
    title: row[idx("title")],
    number: row[idx("number")],
    grade: parseFloat(row[idx("grade")]),
    qualified: row[idx("qualified")]?.trim().toLowerCase() === "qualified",
    sold_price: row[idx("Sold Price")] ? parseFloat(row[idx("Sold Price")].replace(/[^0-9.]/g, "")) : null,
    notes: row[idx("notes")]?.toLowerCase() || ""
}));

// Find comics with qualified grades and sold prices
const qualifiedSold = comics.filter(c => c.qualified && c.sold_price !== null && c.sold_price > 0);
console.log(`Found ${qualifiedSold.length} qualified comics with sold prices.`);

const comparisons: number[] = [];

qualifiedSold.forEach(q => {
    // Look for same title, same number, same grade, but not qualified
    const matches = comics.filter(c =>
        c.title === q.title &&
        c.number === q.number &&
        c.grade === q.grade &&
        !c.qualified &&
        c.sold_price !== null &&
        c.sold_price > 0
    );

    if (matches.length > 0) {
        const avgUniversalPrice = matches.reduce((sum, m) => sum + (m.sold_price || 0), 0) / matches.length;
        const ratio = q.sold_price! / avgUniversalPrice;
        comparisons.push(ratio);
        console.log(`Match for ${q.title} #${q.number} (Grade ${q.grade}): Qualified $${q.sold_price} vs Universal Avg $${avgUniversalPrice.toFixed(2)} (Ratio: ${ratio.toFixed(2)})`);
    } else {
        // Broaden search to +/- 0.5 grade if no exact match
        const nearMatches = comics.filter(c =>
            c.title === q.title &&
            c.number === q.number &&
            Math.abs(c.grade - q.grade) <= 0.5 &&
            !c.qualified &&
            c.sold_price !== null &&
            c.sold_price > 0
        );
        if (nearMatches.length > 0) {
            const avgUniversalPrice = nearMatches.reduce((sum, m) => sum + (m.sold_price || 0), 0) / nearMatches.length;
            const ratio = q.sold_price! / avgUniversalPrice;
            // Adjust ratio based on grade difference (rough linear interpolation)
            // For now just logged as "Near match"
            console.log(`Near Match for ${q.title} #${q.number} (Grade ${q.grade}): Qualified $${q.sold_price} vs Universal Near Avg $${avgUniversalPrice.toFixed(2)} (Ratio: ${ratio.toFixed(2)})`);
        }
    }
});

if (comparisons.length > 0) {
    const avgRatio = comparisons.reduce((sum, r) => sum + r, 0) / comparisons.length;
    console.log(`\nAverage Value Ratio (Qualified/Universal): ${avgRatio.toFixed(2)}`);
    console.log(`Average Discount: ${((1 - avgRatio) * 100).toFixed(0)}%`);
} else {
    console.log("\nNo exact issue/grade matches found for comparison.");
}
