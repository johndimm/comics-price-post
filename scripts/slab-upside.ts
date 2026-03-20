/**
 * Find raw/community comics where the slabbed FMV is $100+ more than raw FMV.
 * Run with: npx ts-node --project tsconfig.scripts.json scripts/slab-upside.ts
 */
import { getAllComics } from "../lib/comics";
import { getGradeCurvePoints } from "../lib/db";

function evalCurve(pts: { x: number; y: number }[], grade: number): number | null {
    if (!pts || pts.length < 2) return null;
    const sorted = [...pts].sort((a, b) => a.x - b.x);
    if (grade < sorted[0].x - 1 || grade > sorted[sorted.length - 1].x + 1) return null;
    if (grade <= sorted[0].x) return sorted[0].y;
    if (grade >= sorted[sorted.length - 1].x) return sorted[sorted.length - 1].y;
    for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i].x <= grade && grade <= sorted[i + 1].x) {
            const t = (grade - sorted[i].x) / (sorted[i + 1].x - sorted[i].x);
            return Math.round(sorted[i].y + t * (sorted[i + 1].y - sorted[i].y));
        }
    }
    return null;
}

const THRESHOLD = 100;

const comics = getAllComics();
const results: { title: string; number: string; grade: number; raw: number; slabbed: number; upside: number }[] = [];

for (const comic of comics) {
    if (comic.grade_category === "slabbed") continue;
    if (comic.grade <= 0) continue;

    const curves = getGradeCurvePoints(comic.marvel_id);
    const slabbedFmv = evalCurve(curves.sold.slabbed, comic.grade);
    const rawFmv = evalCurve(curves.sold.raw, comic.grade);

    if (slabbedFmv == null || rawFmv == null) continue;

    const upside = slabbedFmv - rawFmv;
    if (upside > THRESHOLD) {
        results.push({
            title: comic.title,
            number: comic.number,
            grade: comic.grade,
            raw: rawFmv,
            slabbed: slabbedFmv,
            upside,
        });
    }
}

results.sort((a, b) => b.upside - a.upside);

console.log(`\nComics where slabbed FMV > raw FMV by $${THRESHOLD}+:\n`);
console.log("Upside  Slabbed  Raw     Grade  Comic");
console.log("------  -------  ------  -----  -----");
for (const r of results) {
    console.log(
        `$${String(r.upside).padStart(5)}  $${String(r.slabbed).padStart(6)}  $${String(r.raw).padStart(5)}  ${r.grade.toFixed(1).padStart(5)}  ${r.title} #${r.number}`
    );
}
console.log(`\n${results.length} comics found.`);
