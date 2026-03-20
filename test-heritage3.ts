import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
puppeteer.use(StealthPlugin());

async function main() {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    
    // Try an individual lot page
    const url = 'https://comics.ha.com/itm/silver-age-1956-1969-/superhero/fantastic-four-55-boston-pedigree-marvel-1966-cgc-mt-99-white-pages/a/7152-91136.s';
    console.log('Fetching lot page:', url);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));
    
    const priceInfo = await page.evaluate(() => {
        const els = document.querySelectorAll('[class*="price"], [class*="realized"], [class*="sold"], [class*="hammer"], [class*="amount"], [class*="bid"]');
        return Array.from(els).slice(0, 15).map(el => ({
            classes: el.className,
            text: el.textContent?.trim().slice(0, 150)
        }));
    });
    console.log('Price elements:', JSON.stringify(priceInfo, null, 2));
    
    // Also search for dollar signs in the page
    const dollarsText = await page.evaluate(() => {
        const body = document.body.textContent || '';
        const matches = body.match(/.{0,30}\$[\d,]+.{0,30}/g);
        return matches?.slice(0, 10) ?? [];
    });
    console.log('\nDollar amounts found:', dollarsText);
    
    await browser.close();
}
main().catch(console.error);
