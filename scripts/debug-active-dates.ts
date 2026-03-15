import "dotenv/config";
import { searchActiveItems } from "../lib/ebay.ts";
async function run() {
    const items = await searchActiveItems("journey into mystery 116", 10);
    console.log(items.map(i => i.saleDate));
}
run();
