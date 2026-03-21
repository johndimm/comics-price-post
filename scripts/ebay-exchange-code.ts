import 'dotenv/config';

async function main() {
  const code = 'v^1.1#i^1#r^1#I^3#f^0#p^3#t^Ul41XzY6ODE1MUU1OUE2NEIyNzEwNDVGNTM5NEY2REVDREFBNTZfMF8xI0VeMjYw';
  const creds = Buffer.from(process.env.EBAY_CLIENT_ID + ':' + process.env.EBAY_CLIENT_SECRET).toString('base64');
  const res = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: { 'Authorization': 'Basic ' + creds, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: process.env.EBAY_RUNAME! }),
  });
  const data = await res.json() as any;
  if (data.refresh_token) {
    console.log('REFRESH TOKEN:\n' + data.refresh_token);
    console.log('Expires in:', Math.round(data.refresh_token_expires_in / 86400 / 30), 'months');
  } else {
    console.log('ERROR:', JSON.stringify(data, null, 2));
  }
}
main().catch(console.error);
