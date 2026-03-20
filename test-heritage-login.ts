import 'dotenv/config';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function main() {
    const browser = await puppeteer.launch({ headless: false, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    // Step 1: Go to login page
    console.log('Going to login page...');
    await page.goto('https://www.ha.com/c/login.zx', { waitUntil: 'networkidle2', timeout: 30000 });
    // Wait for Vue to render the login form
    await page.waitForSelector('#username', { timeout: 15000 });
    console.log('Form ready');

    // Log in
    await page.type('#username', process.env.HERITAGE_EMAIL!);
    await page.type('#password', process.env.HERITAGE_PASSWORD!);

    // Submit
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }),
        page.click('#loginButton')
    ]);

    const postLoginUrl = page.url();
    const postLoginTitle = await page.title();
    console.log('After login URL:', postLoginUrl);
    console.log('After login title:', postLoginTitle);

    // Now try a search for sold FF#55 CGC
    console.log('\nFetching search results...');
    await page.goto('https://comics.ha.com/c/search-results.zx?N=0+790+4294967153&Nty=1&Ntt=fantastic+four+55+cgc+1966',
        { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));

    // Now check if prices are visible
    const lots = await page.evaluate(() => {
        const items = document.querySelectorAll('li.item-block');
        return Array.from(items).slice(0, 5).map(item => ({
            title: item.querySelector('.item-title')?.textContent?.trim().slice(0, 100),
            lotno: item.querySelector('.lotno')?.textContent?.trim(),
            price: item.querySelector('.current-amount')?.textContent?.trim().slice(0, 100),
        }));
    });
    console.log('\nLots after login:', JSON.stringify(lots, null, 2));

    await browser.close();
}

main().catch(console.error);
