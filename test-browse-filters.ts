async function testBrowseFilters() {
    const clientId = process.env.EBAY_CLIENT_ID!;
    const clientSecret = process.env.EBAY_CLIENT_SECRET!;
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const tokenResponse = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": `Basic ${auth}`,
        },
        body: new URLSearchParams({
            grant_type: "client_credentials",
            scope: "https://api.ebay.com/oauth/api_scope",
        }),
    });
    const tokenData = await tokenResponse.json();
    const token = tokenData.access_token;

    const filters = [
        "listingStatus:{SOLD}",
        "listingStatus:{COMPLETED}",
        "itemEndDate:[2024-01-01T00:00:00Z..2025-03-01T00:00:00Z]",
    ];

    for (const filter of filters) {
        console.log(`\n--- Testing filter: ${filter} ---`);
        const url = `https://api.ebay.com/buy/browse/v1/item_summary/search?q=Amazing+Spider-Man+300&filter=${encodeURIComponent(filter)}&limit=3`;
        try {
            const response = await fetch(url, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.errors) {
                console.log("Errors:", JSON.stringify(data.errors, null, 2));
            } else if (data.itemSummaries) {
                console.log(`Found ${data.itemSummaries.length} items.`);
                console.log("Sample title:", data.itemSummaries[0].title);
            } else {
                console.log("No items found or unexpected response.");
            }
        } catch (e) {
            console.error("Fetch error:", e);
        }
    }
}

testBrowseFilters();
