import { getAllComics } from './lib/comics';

const all = getAllComics();
console.log(`Total comics: ${all.length}`);
const withImages = all.filter(c => c.photos.length > 0);
console.log(`Comics with images: ${withImages.length}`);

const titles = Array.from(new Set(all.map(c => c.title))).sort();
console.log(`Unique titles: ${titles.length}`);
titles.forEach(t => {
    const issues = all.filter(c => c.title === t);
    const issuesWithImages = issues.filter(c => c.photos.length > 0);
    console.log(`${t}: ${issuesWithImages.length}/${issues.length} have images`);
});
