/**
 * Fetch cover images from Comic Vine API for local- comics
 * and append to public/comic-photos/comics-images.csv
 */
import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import Papa from 'papaparse';
import { getAllComics } from '../lib/comics';

const API_KEY = process.env.COMIC_VINE_API_KEY!;
const CSV_PATH = path.join(process.cwd(), 'public', 'comic-photos', 'comics-images.csv');
const DELAY_MS = 1100; // Comic Vine rate limit: 200 req/hour

function loadExistingIds(): Set<string> {
    const content = fs.readFileSync(CSV_PATH, 'utf-8');
    const result = Papa.parse<string[]>(content, { skipEmptyLines: true });
    return new Set(result.data.slice(1).map(r => r[0]?.trim()));
}

function appendToCSV(comic_id: string, url: string) {
    fs.appendFileSync(CSV_PATH, `\n${comic_id},,${url}`);
}

const volumeCache: Record<string, number | null> = {};

async function getVolumeId(title: string): Promise<number | null> {
    if (title in volumeCache) return volumeCache[title];
    const url = `https://comicvine.gamespot.com/api/volumes/?api_key=${API_KEY}&format=json&filter=name:${encodeURIComponent(title)}&field_list=id,name,count_of_issues`;
    const res = await fetch(url, { headers: { 'User-Agent': 'comics-price-post/1.0' } });
    if (!res.ok) { volumeCache[title] = null; return null; }
    const data = await res.json();
    const results: any[] = data.results ?? [];
    // Pick the volume whose name most closely matches
    const normTitle = title.toLowerCase();
    const match = results.find(r => r.name?.toLowerCase() === normTitle)
        ?? results.find(r => r.name?.toLowerCase().includes(normTitle.slice(0, 8)))
        ?? results[0] ?? null;
    volumeCache[title] = match?.id ?? null;
    return volumeCache[title];
}

async function fetchCover(title: string, number: string): Promise<string | null> {
    const volumeId = await getVolumeId(title);
    if (!volumeId) return null;
    await new Promise(r => setTimeout(r, DELAY_MS)); // second API call needs its own delay

    const url = `https://comicvine.gamespot.com/api/issues/?api_key=${API_KEY}&format=json&filter=volume:${volumeId},issue_number:${encodeURIComponent(number)}&field_list=id,issue_number,image`;
    const res = await fetch(url, { headers: { 'User-Agent': 'comics-price-post/1.0' } });
    if (!res.ok) return null;
    const data = await res.json();
    const issue = data.results?.[0];
    return issue?.image?.medium_url ?? issue?.image?.original_url ?? null;
}

async function main() {
    if (!API_KEY) { console.error('Missing COMIC_VINE_API_KEY'); process.exit(1); }

    const allComics = getAllComics();
    const localComics = allComics.filter(c => c.marvel_id.startsWith('local-'));
    const existingIds = loadExistingIds();
    const toFetch = localComics.filter(c => !existingIds.has(c.marvel_id));

    console.log(`${localComics.length} local comics, ${toFetch.length} need covers`);

    let ok = 0, fail = 0;
    for (let i = 0; i < toFetch.length; i++) {
        const c = toFetch[i];
        process.stdout.write(`[${i + 1}/${toFetch.length}] ${c.title} #${c.number}... `);
        try {
            const url = await fetchCover(c.title, c.number);
            if (url) {
                appendToCSV(c.marvel_id, url);
                ok++;
                console.log('ok');
            } else {
                fail++;
                console.log('not found');
            }
        } catch (e) {
            fail++;
            console.log(`error: ${e}`);
        }
        await new Promise(r => setTimeout(r, DELAY_MS));
    }

    console.log(`\nDone: ${ok} covers found, ${fail} not found`);
}

main().catch(console.error);
