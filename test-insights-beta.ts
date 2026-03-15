import "dotenv/config";
import fs from "fs";

async function getInsightsToken() {
    const clientId = process.env.EBAY_CLIENT_ID;
    const clientSecret = process.env.EBAY_CLIENT_SECRET;
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": `Basic ${auth}`,
        },
        body: new URLSearchParams({
            grant_type: "client_credentials",
            scope: "https://api.ebay.com/oauth/api_scope/buy.marketplace.insights",
        }),
    });

    const data = await response.json();
    return data.access_token;
}

async function testInsightsBeta() {
    try {
        const token = await getInsightsToken();
        if (!token) {
            console.error("Failed to get token with insights scope");
            return;
        }
        const query = encodeURIComponent("Journey into Mystery 116 (1965)");
        const url = `https://api.ebay.com/buy/marketplace_insights/v1_beta/item_sales/search?q=${query}&limit=5`;

        console.log(`Testing Insights Beta URL: ${url}`);
        const response = await fetch(url, {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        const text = await response.text();
        console.log(`Status: ${response.status}`);
        console.log(`Response: ${text}`);
    } catch (e) {
        console.error("Error:", e);
    }
}

testInsightsBeta().catch(console.error);
