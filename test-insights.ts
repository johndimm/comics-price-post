import "dotenv/config";
import { getAccessToken } from "./lib/ebay.ts";
import fs from "fs";

async function testInsights() {
    try {
        const token = await getAccessToken();
        const query = "Amazing Spider-Man 11 (1964)";
        const encodedQuery = encodeURIComponent(query);
        // Marketplace Insights uses q parameter and is for SOLD items
        const url = `https://api.ebay.com/buy/marketplace_insights/v1/item_sales/search?q=${encodedQuery}&limit=5`;

        let log = `Testing Insights URL: ${url}\n`;
        const response = await fetch(url, {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        const text = await response.text();
        log += `Status: ${response.status}\n`;
        log += `Response: ${text}\n`;

        fs.writeFileSync("ebay-insights-debug.log", log);
        console.log("Log written to ebay-insights-debug.log");
    } catch (e) {
        fs.writeFileSync("ebay-insights-debug.log", String(e));
    }
}

testInsights().catch(console.error);
