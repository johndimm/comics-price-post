/**
 * Fetch comic metadata (plot, creators) from Marvel Fandom wiki
 * and store in comic_metadata table.
 *
 * URL pattern: https://marvel.fandom.com/wiki/{Title_Vol_1_Number}
 * e.g. Fantastic_Four_Vol_1_50, Amazing_Spider-Man_Vol_1_36
 */
import puppeteer from 'puppeteer';
import db from '../lib/db';
import { getAllComics } from '../lib/comics';

const DELAY_MS = 1500;

const TITLE_MAP: Record<string, string> = {
    'Amazing Spider-Man': 'Amazing_Spider-Man',
    'Fantastic Four': 'Fantastic_Four',
    'Mighty Thor': 'Thor',
    'Journey into Mystery': 'Journey_into_Mystery',
    'Tales of Suspense': 'Tales_of_Suspense',
    'Tales to Astonish': 'Tales_to_Astonish',
    'Strange Tales': 'Strange_Tales',
    'Avengers': 'Avengers',
    'X-Men': 'X-Men',
    'Daredevil': 'Daredevil',
    'Incredible Hulk': 'Incredible_Hulk',
    'Iron Man': 'Iron_Man',
    'Captain America': 'Captain_America',
    'Nick Fury': 'Nick_Fury,_Agent_of_S.H.I.E.L.D.',
    'Sgt. Fury and his Howling Commandos': 'Sgt._Fury_and_His_Howling_Commandos',
    'Not Brand Echh': 'Not_Brand_Echh',
    'Marvel Super-Heroes': 'Marvel_Super-Heroes',
    'Rawhide Kid': 'Rawhide_Kid',
    'Two-Gun Kid': 'Two-Gun_Kid',
    'Battlefield': 'Battlefield',
};

function toWikiTitle(title: string, number: string): string {
    const wikiTitle = TITLE_MAP[title] || title.replace(/ /g, '_');
    return `${wikiTitle}_Vol_1_${number}`;
}

const insert = db.prepare(`
    INSERT OR REPLACE INTO comic_metadata
      (marvel_id, description, writers, pencilers, inkers, colorists, letterers, editors, characters, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
`);

async function fetchMetadata(page: any, marvelId: string, title: string, number: string): Promise<boolean> {
    const wikiSlug = toWikiTitle(title, number);
    const url = `https://marvel.fandom.com/wiki/${wikiSlug}`;

    try {
        const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
        if (!response || response.status() === 404) {
            return false;
        }

        const data = await page.evaluate(() => {
            const headings = Array.from(document.querySelectorAll('h2'));

            // Synopsis: h2 containing "Synopsis for"
            const synopsisH2 = headings.find(h => h.textContent?.includes('Synopsis for'));
            let plot = '';
            if (synopsisH2) {
                let el = synopsisH2.nextElementSibling;
                const parts: string[] = [];
                while (el && el.tagName !== 'H2') {
                    const text = el.textContent?.trim();
                    if (text) parts.push(text);
                    el = el.nextElementSibling;
                }
                plot = parts.join(' ');
            }

            // Characters: h2 containing "Appearing in"
            const appearingH2 = headings.find(h => h.textContent?.includes('Appearing in'));
            let characters = '';
            if (appearingH2) {
                let el = appearingH2.nextElementSibling;
                const chars: string[] = [];
                while (el && el.tagName !== 'H2') {
                    el.querySelectorAll('li').forEach(li => {
                        const text = li.textContent?.trim();
                        if (text) chars.push(text);
                    });
                    el = el.nextElementSibling;
                }
                characters = chars.join(', ');
            }

            // Creators from infobox (inside the story section, not the issue infobox)
            const creators: Record<string, string> = {};
            document.querySelectorAll('.pi-data').forEach(el => {
                const label = el.querySelector('.pi-data-label')?.textContent?.trim() ?? '';
                const value = el.querySelector('.pi-data-value')?.textContent?.trim() ?? '';
                if (label && value) creators[label] = value;
            });

            return { plot, characters, creators };
        });

        const c = data.creators;
        insert.run(
            marvelId,
            data.plot.slice(0, 4000) || null,
            c['Writer(s)'] || c['Writer'] || null,
            c['Penciler(s)'] || c['Penciler'] || null,
            c['Inker(s)'] || c['Inker'] || null,
            c['Colorist(s)'] || c['Colorist'] || null,
            c['Letterer(s)'] || c['Letterer'] || null,
            c['Editor(s)'] || c['Editor'] || null,
            data.characters.slice(0, 2000) || null,
        );

        return true;
    } catch (e) {
        return false;
    }
}

async function main() {
    const comics = getAllComics();
    const existing = new Set(
        (db.prepare('SELECT marvel_id FROM comic_metadata').all() as any[]).map(r => r.marvel_id)
    );

    const toFetch = comics.filter(c => !existing.has(c.marvel_id));
    console.log(`Fetching metadata for ${toFetch.length} comics (${existing.size} already cached)`);

    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    let ok = 0, fail = 0;
    for (let i = 0; i < toFetch.length; i++) {
        const c = toFetch[i];
        process.stdout.write(`[${i + 1}/${toFetch.length}] ${c.title} #${c.number}... `);
        const success = await fetchMetadata(page, c.marvel_id, c.title, c.number);
        if (success) { ok++; console.log('ok'); }
        else { fail++; console.log('not found'); }
        await new Promise(r => setTimeout(r, DELAY_MS));
    }

    await browser.close();
    console.log(`\nDone: ${ok} fetched, ${fail} not found`);
}

main().catch(console.error);
