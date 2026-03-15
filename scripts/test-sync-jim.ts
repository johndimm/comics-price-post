import "dotenv/config";
import { syncEbayData } from "../lib/sync.ts";

async function testSync() {
    console.log("Starting sync for JIM 116...");
    await syncEbayData("9691", "Journey into Mystery", "116", "1965");
    console.log("Sync complete!");
}

testSync().catch(console.error);
