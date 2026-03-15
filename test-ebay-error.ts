import "dotenv/config";
import { getAccessToken } from "./lib/ebay.ts";
import fs from "fs";

async function testSoldFilter() {
    try {
        const token = await getAccessToken();
        const query = "Amazing Spider-Man 11 (1964)";
        const encodedQuery = encodeURIComponent(query);
        const filter = encodeURIComponent("listingStatus:{SOLD}");
        const url = `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodedQuery}&filter=${filter}&limit=5`;

        let log = `Testing URL: ${url}\n`;
        const response = await fetch(url, {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        const text = await response.text();
        log += `Status: ${response.status}\n`;
        log += `Response: ${text}\n`;

        fs.writeFileSync("ebay-debug.log", log);
        console.log("Log written to ebay-debug.log");
    } catch (e) {
        fs.writeFileSync("ebay-debug.log", String(e));
    }
}

testSoldFilter().catch(console.error);
