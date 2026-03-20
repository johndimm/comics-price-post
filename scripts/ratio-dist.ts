import { getAllComics } from '../lib/comics';
import { getListingsByComic, calcFMV, getGradeCurvePoints } from '../lib/db';

const comics = getAllComics();
const results: { ratio: number; title: string; number: string }[] = [];

for (const c of comics) {
  if (!c.fmv || !c.grade) continue;
  const sold = getListingsByComic(c.marvel_id).filter(l => l.type === 'sold');
  const asking = getListingsByComic(c.marvel_id).filter(l => l.type === 'asking');
  const curves = getGradeCurvePoints(c.marvel_id);
  const res = calcFMV(null, sold, asking, Number(c.grade), curves, c.is_slabbed === 1 ? true : c.is_slabbed === 0 ? false : undefined);
  if (res.value && res.recommendedAsk) {
    results.push({ ratio: res.recommendedAsk / res.value, title: c.title, number: c.number });
  }
}

results.sort((a, b) => a.ratio - b.ratio);
const n = results.length;
console.log('Count with raw recommendedAsk:', n);
const pct = (p: number) => results[Math.floor(p * n / 100)].ratio.toFixed(3);
console.log('p10:', pct(10), 'p25:', pct(25), 'median:', pct(50), 'p75:', pct(75), 'p90:', pct(90));
console.log('min:', results[0].ratio.toFixed(3), results[0].title, '#' + results[0].number);
console.log('max:', results[n-1].ratio.toFixed(3), results[n-1].title, '#' + results[n-1].number);

const buckets: Record<string, number> = {};
for (const p of results) {
  const b = (Math.floor(p.ratio * 20) / 20).toFixed(2);
  buckets[b] = (buckets[b] || 0) + 1;
}
Object.keys(buckets).sort().forEach(k => {
  const bar = '#'.repeat(Math.min(buckets[k], 60));
  console.log(k + 'x', bar, buckets[k]);
});
