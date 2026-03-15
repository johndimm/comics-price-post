import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function run() {
    const url = "https://www.ebay.com/sch/i.html?_nkw=journey+into+mystery+116&LH_Sold=1&LH_Complete=1&_ipg=60";

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
    });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForSelector('.srp-results', { timeout: 10000 });

        const firstItemHtml = await page.evaluate(() => {
            const item = document.querySelector('li.s-item');
            return item ? item.innerHTML : null;
        });

        console.log(firstItemHtml);

    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
}

run();
