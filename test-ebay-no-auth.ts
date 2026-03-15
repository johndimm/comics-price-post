async function testFindingApiNoAuth() {
    const clientId = "JohnDimm-comicssa-PRD-14ed7534b-de3e7560"; // From .env
    const query = "Amazing Spider-Man 300";

    const url = new URL("https://svcs.ebay.com/services/search/FindingService/v1");
    url.searchParams.set("OPERATION-NAME", "findCompletedItems");
    url.searchParams.set("SERVICE-VERSION", "1.13.0");
    url.searchParams.set("SECURITY-APPNAME", clientId);
    url.searchParams.set("RESPONSE-DATA-FORMAT", "JSON");
    url.searchParams.set("REST-PAYLOAD", "");
    url.searchParams.set("keywords", query);
    url.searchParams.set("itemFilter(0).name", "SoldItemsOnly");
    url.searchParams.set("itemFilter(0).value", "true");

    console.log(`Requesting URL: ${url.toString()}`);

    try {
        const response = await fetch(url.toString());
        const data = await response.json();
        console.log("Response:", JSON.stringify(data, null, 2));
    } catch (error) {
        console.error("Error:", error);
    }
}

testFindingApiNoAuth();
