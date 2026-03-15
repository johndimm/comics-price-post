require('dotenv').config();
const { syncEbayData, getCachedSoldItems } = require('./lib/sync');

async function testSync() {
    const marvelId = "10"; // Just a test ID
    const title = "Amazing Spider-Man";
    const number = "300";

    console.log(`Testing sync for ${title} #${number}...`);
    await syncEbayData(marvelId, title, number);

    const cached = getCachedSoldItems(marvelId);
    console.log(`Found ${cached.length} items in cache.`);
    if (cached.length > 0) {
        console.log("First item:", JSON.stringify(cached[0], null, 2));
    }
}

testSync().catch(console.error);
