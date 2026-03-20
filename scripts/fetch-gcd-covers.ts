/**
 * Fetch cover images from Grand Comics Database (comics.org) for local- comics
 * and append to public/comic-photos/comics-images.csv
 */
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import path from 'path';
import fs from 'fs';
import Papa from 'papaparse';
import { getAllComics } from '../lib/comics';

puppeteer.use(StealthPlugin());

const DELAY_MS = 1500;
const CSV_PATH = path.join(process.cwd(), 'public', 'comic-photos', 'comics-images.csv');

function loadExistingIds(): Set<string> {
    const content = fs.readFileSync(CSV_PATH, 'utf-8');
    const result = Papa.parse<string[]>(content, { skipEmptyLines: true });
    return new Set(result.data.slice(1).map(r => r[0]?.trim()));
}

function appendToCSV(comic_id: string, url: string) {
    fs.appendFileSync(CSV_PATH, `\n${comic_id},,${url}`);
}

async function fetchCover(page: any, title: string, number: string): Promise<string | null> {
    // GCD advanced search
    const q = encodeURIComponent(title);
    const url = `https://www.comics.org/search/advanced/process/?title=${q}&number=${encodeURIComponent(number)}&type=issue`;

    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });

        // Check if we landed on a single issue page directly
        const coverImg = await page.$('img.cover_img, img[src*="covers_by_id"]');
        if (coverImg) {
            const src = await page.evaluate((el: any) => el.src, coverImg);
            if (src && src.includes('comics.org')) return src;
        }

        // Otherwise we're on a search results page — click first result
        const firstLink = await page.$('table.listing td.issue a');
        if (!firstLink) return null;

        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }),
            firstLink.click(),
        ]);

        const img = await page.$('img.cover_img, img[src*="covers_by_id"]');
        if (!img) return null;
        const src = await page.evaluate((el: any) => el.src, img);
        return src || null;
    } catch {
        return null;
    }
}

async function main() {
    const allComics = getAllComics();
    const localComics = allComics.filter(c => c.marvel_id.startsWith('local-'));
    const existingIds = loadExistingIds();
    const toFetch = localComics.filter(c => !existingIds.has(c.marvel_id));

    console.log(`${localComics.length} local comics, ${toFetch.length} need covers`);

    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    let ok = 0, fail = 0;
    for (let i = 0; i < toFetch.length; i++) {
        const c = toFetch[i];
        process.stdout.write(`[${i + 1}/${toFetch.length}] ${c.title} #${c.number}... `);
        const url = await fetchCover(page, c.title, c.number);
        if (url) {
            appendToCSV(c.marvel_id, url);
            ok++;
            console.log('ok');
        } else {
            fail++;
            console.log('not found');
        }
        await new Promise(r => setTimeout(r, DELAY_MS));
    }

    await browser.close();
    console.log(`\nDone: ${ok} covers found, ${fail} not found`);
}

main().catch(console.error);
