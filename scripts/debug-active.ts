import "dotenv/config";
import { getAccessToken } from "../lib/ebay.ts";

async function run() {
    const token = await getAccessToken();
    const query = "journey into mystery 116";
    const encodedQuery = encodeURIComponent(query);
    const url = `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodedQuery}&limit=1`;

    const response = await fetch(url, {
        headers: {
            "Authorization": `Bearer ${token}`
        }
    });
    const data = await response.json();
    console.log(JSON.stringify(data.itemSummaries[0], null, 2));
}

run();
