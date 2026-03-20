import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function main() {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    // Try past auction results search
    const url = 'https://comics.ha.com/c/search-results.zx?N=0+790+4294967153&Nty=1&Ntt=fantastic+four+55+cgc+1966';
    console.log('Fetching:', url);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait a bit for JS rendering
    await new Promise(r => setTimeout(r, 3000));

    // Dump page title and first 3000 chars of body text to understand structure
    const title = await page.title();
    console.log('Page title:', title);

    // Look for lot result elements
    const html = await page.content();
    console.log('\n--- First 5000 chars of HTML ---');
    console.log(html.slice(0, 5000));

    // Try to find lot items
    const lotInfo = await page.evaluate(() => {
        // Try various selectors
        const selectors = [
            '.lot-item', '.search-result', '.auction-lot', '.item-result',
            '[class*="lot"]', '[class*="result"]', '[class*="auction"]',
            'article', '.card', '.grid-item'
        ];
        const found: Record<string, number> = {};
        for (const s of selectors) {
            found[s] = document.querySelectorAll(s).length;
        }
        return found;
    });
    console.log('\n--- Selector counts ---');
    console.log(JSON.stringify(lotInfo, null, 2));

    // Get all class names used on the page
    const classes = await page.evaluate(() => {
        const all = document.querySelectorAll('*');
        const classSet = new Set<string>();
        all.forEach(el => {
            el.classList.forEach(c => classSet.add(c));
        });
        return [...classSet].slice(0, 100);
    });
    console.log('\n--- First 100 class names ---');
    console.log(classes.join(', '));

    await browser.close();
}

main().catch(console.error);
