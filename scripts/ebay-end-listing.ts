/**
 * End (withdraw) an eBay listing by offer ID.
 * Usage: npx tsx scripts/ebay-end-listing.ts <offerId>
 */
import 'dotenv/config';

const EBAY_ENV = process.env.EBAY_ENV || 'production';
const API_BASE = EBAY_ENV === 'sandbox'
    ? 'https://api.sandbox.ebay.com'
    : 'https://api.ebay.com';

async function getAccessToken(): Promise<string> {
    const clientId = process.env.EBAY_CLIENT_ID!;
    const clientSecret = process.env.EBAY_CLIENT_SECRET!;
    const refreshToken = process.env.EBAY_REFRESH_TOKEN!;

    const creds = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const scopes = [
        'https://api.ebay.com/oauth/api_scope',
        'https://api.ebay.com/oauth/api_scope/sell.inventory',
    ].join(' ');

    const res = await fetch(`${API_BASE}/identity/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${creds}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            scope: scopes,
        }),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Token refresh failed: ${res.status} ${text}`);
    }
    const data = await res.json() as { access_token: string };
    return data.access_token;
}

async function endListing(offerId: string): Promise<void> {
    const token = await getAccessToken();

    const res = await fetch(`${API_BASE}/sell/inventory/v1/offer/${offerId}/withdraw`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept-Language': 'en-US',
        },
    });

    if (res.status === 200 || res.status === 204) {
        console.log(`✓ Offer ${offerId} successfully withdrawn.`);
    } else {
        const text = await res.text();
        throw new Error(`Withdraw failed: ${res.status} ${text}`);
    }
}

const offerId = process.argv[2];
if (!offerId) {
    console.error('Usage: npx tsx scripts/ebay-end-listing.ts <offerId>');
    process.exit(1);
}

endListing(offerId).catch(e => { console.error(e.message); process.exit(1); });
