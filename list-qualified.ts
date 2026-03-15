import { getAllComics } from "./lib/comics";

const comics = getAllComics();
const qualified = comics.filter(c => c.is_qualified);

console.log(`Summary of Qualified Comics (${qualified.length}):`);
qualified.forEach(c => {
    console.log(`${c.title} #${c.number} (Grade: ${c.grade}) - Notes: ${c.notes}`);
});
