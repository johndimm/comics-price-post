import "dotenv/config";

async function testFindingSold() {
    const appId = process.env.EBAY_CLIENT_ID;
    const query = encodeURIComponent("Journey into Mystery 116 (1965)");
    const url = `https://svcs.ebay.com/services/search/FindingService/v1` +
        `?OPERATION-NAME=findCompletedItems` +
        `&SERVICE-VERSION=1.13.0` +
        `&SECURITY-APPNAME=${appId}` +
        `&RESPONSE-DATA-FORMAT=JSON` +
        `&REST-PAYLOAD` +
        `&keywords=${query}` +
        `&itemFilter(0).name=SoldItemsOnly` +
        `&itemFilter(0).value=true` +
        `&paginationInput.entriesPerPage=10`;

    console.log(`Testing Finding API URL: ${url}`);
    try {
        const response = await fetch(url);
        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Error calling Finding API:", e);
    }
}

testFindingSold().catch(console.error);
