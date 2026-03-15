async function testBrowseApi() {
    const clientId = process.env.EBAY_CLIENT_ID!;
    const clientSecret = process.env.EBAY_CLIENT_SECRET!;
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    console.log("Requesting Client Credentials token...");
    try {
        const response = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
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
        const data = await response.json();

        if (data.access_token) {
            console.log("Success! Got access token. Testing Browse API search...");

            // Testing with a simple search for active items
            const query = encodeURIComponent("Amazing Spider-Man 300");
            const url = `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${query}&limit=5`;

            const browseResponse = await fetch(url, {
                headers: {
                    "Authorization": `Bearer ${data.access_token}`
                }
            });
            const browseData = await browseResponse.json();
            console.log("Browse API Response:", JSON.stringify(browseData, null, 2));

            if (browseData.itemSummaries) {
                console.log(`Found ${browseData.itemSummaries.length} active items.`);
            }
        } else {
            console.log("Failed to get token:", data);
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

testBrowseApi();
