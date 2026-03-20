/**
 * One-time setup: opens a visible browser to Heritage Auctions.
 * Log in manually (solve any CAPTCHA), then press Enter in the terminal.
 * Your session cookies are saved to data/heritage-cookies.json for future scraping.
 */
import 'dotenv/config';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

puppeteer.use(StealthPlugin());

async function main() {
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ['--no-sandbox', '--start-maximized'],
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    console.log('Opening Heritage Auctions login page...');
    await page.goto('https://www.ha.com/c/login.zx', { waitUntil: 'domcontentloaded', timeout: 30000 });

    console.log('\nA browser window has opened.');
    console.log('Log in to Heritage Auctions in that window.');
    console.log('Once you are logged in, press Enter here to save your cookies.');

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    await new Promise<void>(resolve => rl.question('', () => { rl.close(); resolve(); }));

    const cookies = await page.cookies();
    const cookiePath = path.join(process.cwd(), 'data', 'heritage-cookies.json');
    fs.writeFileSync(cookiePath, JSON.stringify(cookies, null, 2));
    console.log(`Saved ${cookies.length} cookies to ${cookiePath}`);

    await browser.close();
}

main().catch(console.error);
