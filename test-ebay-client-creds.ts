async function testClientCredentials() {
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
                scope: "https://api.ebay.com/oauth/api_scope", // Base scope
            }),
        });
        const data = await response.json();
        console.log("Token Data:", data);

        if (data.access_token) {
            console.log("Success! Got access token. Testing Finding API with it...");
            const url = new URL("https://svcs.ebay.com/services/search/FindingService/v1");
            url.searchParams.set("OPERATION-NAME", "findCompletedItems");
            url.searchParams.set("SERVICE-VERSION", "1.13.0");
            url.searchParams.set("RESPONSE-DATA-FORMAT", "JSON");
            url.searchParams.set("REST-PAYLOAD", "");
            url.searchParams.set("keywords", "Amazing Spider-Man 300");
            url.searchParams.set("itemFilter(0).name", "SoldItemsOnly");
            url.searchParams.set("itemFilter(0).value", "true");

            const findResponse = await fetch(url.toString(), {
                headers: {
                    "X-EBAY-SOA-SECURITY-APPNAME": clientId,
                    "Authorization": `Bearer ${data.access_token}`
                }
            });
            const findData = await findResponse.json();
            console.log("Finding API (Completed) Response:", JSON.stringify(findData, null, 2));

            console.log("\nTesting Finding API (Active) with findItemsByKeywords...");
            const urlActive = new URL("https://svcs.ebay.com/services/search/FindingService/v1");
            urlActive.searchParams.set("OPERATION-NAME", "findItemsByKeywords");
            urlActive.searchParams.set("SERVICE-VERSION", "1.13.0");
            urlActive.searchParams.set("RESPONSE-DATA-FORMAT", "JSON");
            urlActive.searchParams.set("REST-PAYLOAD", "");
            urlActive.searchParams.set("keywords", "Amazing Spider-Man 300");

            const activeResponse = await fetch(urlActive.toString(), {
                headers: {
                    "X-EBAY-SOA-SECURITY-APPNAME": clientId,
                    "Authorization": `Bearer ${data.access_token}`
                }
            });
            const activeData = await activeResponse.json();
            console.log("Finding API (Active) Response:", JSON.stringify(activeData, null, 2));
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

testClientCredentials();
