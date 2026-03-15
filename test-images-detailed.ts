import { getAllComics } from "./lib/comics";

const comics = getAllComics();
console.log("Total comics:", comics.length);

const sample = comics.slice(0, 10);
sample.forEach(c => {
    console.log(`\nComic: ${c.title} #${c.number} (${c.marvel_id})`);
    console.log(`Photos: ${JSON.stringify(c.photos)}`);
    console.log(`Qualified: ${c.is_qualified}`);
});

const withFallback = comics.filter(c => c.photos.length > 0 && c.photos[0].startsWith("http"));
console.log(`\nComics using Marvel fallback (http): ${withFallback.length}`);
if (withFallback.length > 0) {
    console.log("Sample fallback URL:", withFallback[0].photos[0]);
}

const withLocal = comics.filter(c => c.photos.length > 0 && !c.photos[0].startsWith("http"));
console.log(`Comics using local photos: ${withLocal.length}`);
