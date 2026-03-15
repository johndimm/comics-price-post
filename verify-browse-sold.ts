async function verifyBrowseSold() {
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

    const filter = "listingStatus:{SOLD}";
    const url = `https://api.ebay.com/buy/browse/v1/item_summary/search?q=Amazing+Spider-Man+300&filter=${encodeURIComponent(filter)}&limit=3`;

    console.log(`Testing filter: ${filter}`);
    const response = await fetch(url, {
        headers: { "Authorization": `Bearer ${token}` }
    });
    const data = await response.json();

    if (data.itemSummaries) {
        data.itemSummaries.forEach((item, i) => {
            console.log(`\nItem ${i + 1}:`);
            console.log(`Title: ${item.title}`);
            console.log(`Price: ${item.price.value} ${item.price.currency}`);
            console.log(`URL: ${item.itemWebUrl}`);
            console.log(`Item End Date: ${item.itemEndDate}`);
        });
    } else {
        console.log("No items found.");
    }
}

verifyBrowseSold();
