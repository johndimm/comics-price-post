import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "data", "comics.db");
const db = new Database(dbPath);

function extractGrade(title: string): number | null {
    // Regex patterns for grades like 4.5, 9.8, CGC 5.0, etc.
    // Looking for numbers followed by . or alone if they are standard grades
    const patterns = [
        /(?:CGC|CBCS|PGX)\s*(\d\.\d)/i, // CGC 4.5
        /([\d\.\d]+)\s*(?:Qualified|Universal|Restored)/i, // 5.0 Qualified
        /\[(\d\.\d)\]/i, // [4.0]
        /(?:VF|FN|VG|GD|FR|PR)\D*(\d\.\d)/i, // VF 7.5
        /\b(\d\.\d)\b/ // Just a 4.5 somewhere
    ];

    for (const p of patterns) {
        const match = title.match(p);
        if (match && match[1]) {
            const val = parseFloat(match[1]);
            if (val >= 0.5 && val <= 10.0) return val;
        }
    }
    return null;
}

function analyze() {
    const listings = db.prepare("SELECT item_id, raw_title FROM ebay_listings").all() as any[];
    const updateStmt = db.prepare("UPDATE ebay_listings SET grade = ? WHERE item_id = ?");

    console.log(`Analyzing ${listings.length} listings...`);
    let updatedCount = 0;

    db.transaction(() => {
        for (const l of listings) {
            const g = extractGrade(l.raw_title);
            if (g !== null) {
                updateStmt.run(g, l.item_id);
                updatedCount++;
            }
        }
    })();

    console.log(`Updated grades for ${updatedCount} listings.`);

    // Now compare prices
    const results = db.prepare(`
    SELECT 
      l.marvel_id,
      l.grade,
      lower(l.raw_title) LIKE '%qualified%' OR lower(l.raw_title) LIKE '%green label%' as is_qualified,
      AVG(l.price) as avg_price,
      COUNT(*) as count
    FROM ebay_listings l
    WHERE l.grade IS NOT NULL AND l.grade > 0
    GROUP BY l.marvel_id, l.grade, is_qualified
    HAVING count >= 1
  `).all() as any[];

    // Comparison logic: Find cases where we have BOTH qualified and non-qualified for same (comic, grade)
    const comparison: Record<string, { q?: number, u?: number }> = {};
    for (const r of results) {
        const key = `${r.marvel_id}_${r.grade}`;
        if (!comparison[key]) comparison[key] = {};
        if (r.is_qualified) comparison[key].q = r.avg_price;
        else comparison[key].u = r.avg_price;
    }

    let totalDiff = 0;
    let count = 0;
    for (const [key, val] of Object.entries(comparison)) {
        if (val.q && val.u) {
            const ratio = val.q / val.u;
            if (ratio > 0.1 && ratio < 1.5) { // Filter outliers
                totalDiff += ratio;
                count++;
                console.log(`Match ${key}: Qual $${val.q.toFixed(2)} vs Univ $${val.u.toFixed(2)} (Ratio: ${ratio.toFixed(2)})`);
            }
        }
    }

    if (count > 0) {
        const avgRatio = totalDiff / count;
        console.log(`\nAverage Qualified/Universal Price Ratio: ${avgRatio.toFixed(2)}`);
        console.log(`Based on ${count} direct comparisons.`);
    } else {
        console.log("\nNo direct comparisons found (need same comic and grade with both listing types).");
    }
}

analyze();
