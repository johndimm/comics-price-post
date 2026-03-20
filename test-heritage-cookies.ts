import 'dotenv/config';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';

puppeteer.use(StealthPlugin());

async function main() {
    const cookies = JSON.parse(fs.readFileSync('data/heritage-cookies.json', 'utf-8'));

    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    await page.setCookie(...cookies);

    // Use the redirected URL format with mode=archive
    const url = 'https://comics.ha.com/c/search/results.zx?term=fantastic+four+55+cgc+1966&mode=archive';
    console.log('URL:', url);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));

    const count = await page.evaluate(() => document.querySelectorAll('li.item-block').length);
    console.log('item-block count:', count);

    const lots = await page.evaluate(() => {
        const items = document.querySelectorAll('li.item-block');
        return Array.from(items).slice(0, 8).map(item => ({
            title: item.querySelector('.item-title b, .item-title')?.textContent?.trim().slice(0, 100),
            lotno: item.querySelector('.lotno')?.textContent?.trim(),
            price: item.querySelector('.current-amount')?.textContent?.trim().slice(0, 80),
        }));
    });
    lots.forEach(l => console.log(JSON.stringify(l)));

    await browser.close();
}
main().catch(console.error);
