/**
 * Generates a new eBay OAuth 2.0 refresh token.
 * Run: npx tsx scripts/ebay-oauth-bootstrap.ts
 * Then open the printed URL in your browser, authorize, and paste back the redirect URL.
 */
import 'dotenv/config';
import * as http from 'http';

const CLIENT_ID = process.env.EBAY_CLIENT_ID!;
const CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET!;
const RUNAME = process.env.EBAY_RUNAME!;
const API_BASE = 'https://api.ebay.com';

const SCOPES = [
    'https://api.ebay.com/oauth/api_scope',
    'https://api.ebay.com/oauth/api_scope/sell.account',
    'https://api.ebay.com/oauth/api_scope/sell.inventory',
    'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
].join('%20');

// Step 1: Print the authorization URL
const authUrl = `https://auth.ebay.com/oauth2/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${RUNAME}&scope=${SCOPES}&prompt=login`;

console.log('\n── eBay OAuth 2.0 Bootstrap ──────────────────────────────');
console.log('\n1. Open this URL in your browser:\n');
console.log(authUrl);
console.log('\n2. Log in and authorize the app.');
console.log('3. You will be redirected. Paste the FULL redirect URL below.\n');

// Step 2: Read the redirect URL from stdin
process.stdout.write('Paste redirect URL here: ');
process.stdin.setEncoding('utf8');
process.stdin.once('data', async (input: string) => {
    const redirectUrl = input.trim();
    let code: string | null = null;
    try {
        const url = new URL(redirectUrl);
        code = url.searchParams.get('code');
    } catch {
        // maybe they pasted just the code
        code = redirectUrl;
    }

    if (!code) {
        console.error('Could not find authorization code in the URL.');
        process.exit(1);
    }

    console.log('\nExchanging code for tokens...');

    const creds = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    const res = await fetch(`${API_BASE}/identity/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${creds}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: RUNAME,
        }),
    });

    const data = await res.json() as any;

    if (!res.ok) {
        console.error('Token exchange failed:', JSON.stringify(data, null, 2));
        process.exit(1);
    }

    console.log('\n── SUCCESS ───────────────────────────────────────────────');
    console.log(`\nAccess Token (expires in ${data.expires_in}s):\n${data.access_token}`);
    console.log(`\nRefresh Token (expires: ${data.refresh_token_expires_in}s):\n${data.refresh_token}`);
    console.log('\nAdd to your .env:\nEBAY_REFRESH_TOKEN=' + data.refresh_token);
    process.exit(0);
});
