/**
 * Re-parse grades for existing listings where grade = 0 but title contains grade info.
 * Also fixes is_slabbed for listings that weren't flagged correctly.
 */
import db from '../lib/db';

// Inline the fixed parseGrade (matches lib/ebay.ts)
function parseGrade(title: string, issueNumber?: string, year?: string | number): number | undefined {
    let t = title.toUpperCase();

    // CGC/CBCS/PGX first — before issue-number removal
    // Handles: "CGC 7.0", "CGC7.0", "CGC .5" but NOT "CGC NG"/"CGC PG"/"CGC SS"
    const slabMatch = t.match(/\b(?:CGC|CBCS|PGX)\s*(\d+\.?\d*|\.\d+)\b(?!\s*(?:NG|PG|SS|OW|PQ)\b)/);
    if (slabMatch) {
        const val = parseFloat(slabMatch[1]);
        if (val >= 0.5 && val <= 10.0) return val;
    }

    // Remove issue number but not when followed by decimal
    if (issueNumber) {
        const numPattern = new RegExp(`\\b${issueNumber}(?!\\.)`, 'g');
        t = t.replace(numPattern, ' ');
    }
    if (year) {
        const yearPattern = new RegExp(`\\b${year}\\b`, 'g');
        t = t.replace(yearPattern, ' ');
    }

    // Bare decimal grade
    const numMatch = t.match(/\b(10\.0|\d\.\d)\b/);
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

// Get all comics for issue number/year lookup
const comics = db.prepare('SELECT DISTINCT marvel_id FROM ebay_listings WHERE grade IS NULL OR grade = 0').all() as { marvel_id: string }[];
console.log(`${comics.length} comics with ungraded listings`);

// Load comic metadata (number/year) from listings' marvel_id → comics table doesn't exist here,
// so we parse from the marvel_id or use a separate approach.
// Instead, pull number/year from the CSV via the listings themselves.
// For now: just use the title-only approach (no issue/year context).
// A second pass could add context if needed.

const rows = db.prepare(`
    SELECT item_id, marvel_id, raw_title
    FROM ebay_listings
    WHERE (grade IS NULL OR grade = 0) AND raw_title IS NOT NULL
`).all() as { item_id: string; marvel_id: string; raw_title: string }[];

console.log(`${rows.length} listings with no grade`);

const update = db.prepare('UPDATE ebay_listings SET grade = ?, is_slabbed = ? WHERE item_id = ?');
const updateSlabbed = db.prepare('UPDATE ebay_listings SET is_slabbed = 1 WHERE item_id = ?');

let fixed = 0;

for (const row of rows) {
    const grade = parseGrade(row.raw_title);
    const isSlabbed = /CGC|CBCS|PGX/i.test(row.raw_title) ? 1 : 0;

    if (grade !== undefined) {
        update.run(grade, isSlabbed, row.item_id);
        fixed++;
    } else if (isSlabbed) {
        // Mark as slabbed even if grade couldn't be parsed
        updateSlabbed.run(row.item_id);
    }
}

console.log(`Fixed ${fixed} listings with grade from title`);

// Summary of what's still missing
const remaining = db.prepare(`
    SELECT COUNT(*) as cnt FROM ebay_listings WHERE grade IS NULL OR grade = 0
`).get() as { cnt: number };
console.log(`Still ungraded: ${remaining.cnt}`);
