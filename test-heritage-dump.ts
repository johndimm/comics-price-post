import 'dotenv/config';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function main() {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    await page.goto('https://www.ha.com/c/login.zx', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 5000));

    const url = page.url();
    const title = await page.title();
    console.log('URL:', url);
    console.log('Title:', title);

    const html = await page.content();
    // Find the login-related HTML
    const loginIdx = html.indexOf('login');
    console.log('\nHTML around "login":', html.slice(Math.max(0, loginIdx - 200), loginIdx + 1000));

    const inputs = await page.evaluate(() =>
        Array.from(document.querySelectorAll('input, form')).map(el => ({
            tag: el.tagName, id: (el as any).id, name: (el as any).name, type: (el as any).type, class: el.className
        }))
    );
    console.log('\nInputs/forms found:', JSON.stringify(inputs.slice(0, 20), null, 2));

    await browser.close();
}
main().catch(console.error);
