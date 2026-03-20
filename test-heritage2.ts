import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
puppeteer.use(StealthPlugin());

async function main() {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    const url = 'https://comics.ha.com/c/search-results.zx?N=0+790+4294967153&Nty=1&Ntt=fantastic+four+55+cgc+1966';
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));

    // Find all elements with 'lot' in their class
    const lotElements = await page.evaluate(() => {
        const els = document.querySelectorAll('[class*="lot"]');
        return Array.from(els).slice(0, 5).map(el => ({
            tag: el.tagName,
            classes: el.className,
            text: el.textContent?.trim().slice(0, 200)
        }));
    });
    console.log('Lot elements:', JSON.stringify(lotElements, null, 2));

    // Try to find price elements
    const prices = await page.evaluate(() => {
        const els = document.querySelectorAll('[class*="price"], [class*="realized"], [class*="hammer"], [class*="bid"]');
        return Array.from(els).slice(0, 10).map(el => ({
            classes: el.className,
            text: el.textContent?.trim().slice(0, 100)
        }));
    });
    console.log('\nPrice elements:', JSON.stringify(prices, null, 2));

    // Get innerHTML of the search-results section
    const resultsHtml = await page.evaluate(() => {
        const el = document.querySelector('.search-results');
        return el?.innerHTML.slice(0, 3000);
    });
    console.log('\nSearch results HTML:', resultsHtml);

    await browser.close();
}
main().catch(console.error);
// Add second run
async function main2() {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    const url = 'https://comics.ha.com/c/search-results.zx?N=0+790+4294967153&Nty=1&Ntt=fantastic+four+55+cgc+1966';
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));
    
    // Get the parent of .lotno to understand card structure
    const cardHtml = await page.evaluate(() => {
        const lotno = document.querySelector('.lotno');
        const card = lotno?.closest('li, .item, .result, [class*="item"], [class*="card"]') ?? lotno?.parentElement?.parentElement;
        return card?.outerHTML?.slice(0, 2000);
    });
    console.log('Card HTML:', cardHtml);
    
    await browser.close();
}
main2().catch(console.error);
