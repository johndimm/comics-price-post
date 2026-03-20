/**
 * Fetch ungraded + graded market prices from pricecharting.com
 * Stores results in data/pricecharting.json keyed by marvel_id
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { getAllComics } from '../lib/comics';

const OUT_PATH = path.join(process.cwd(), 'data', 'pricecharting.json');
const DELAY_MS = 1500;

function titleToSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function buildUrl(title: string, number: string, year: number): string {
  const slug = titleToSlug(title);
  const num = number.replace(/[^0-9a-z]/gi, '').toLowerCase();
  return `https://www.pricecharting.com/game/comic-books-${slug}/${slug}-${num}-${year}`;
}

function buildSearchUrl(title: string, number: string): string {
  const q = encodeURIComponent(`${title} ${number}`);
  return `https://www.pricecharting.com/search-products?q=${q}&type=prices&view=table`;
}

interface ChartEntry { timestamp: number; price: number; }
interface PriceData {
  url: string;
  used: number | null;    // ungraded, cents → dollars
  graded: number | null;  // CGC graded
  cib: number | null;     // "complete" / mid-grade
  fetched_at: string;
}

function extractLatestPrice(arr: [number, number][]): number | null {
  if (!arr || arr.length === 0) return null;
  const last = arr[arr.length - 1];
  return last[1] > 0 ? Math.round(last[1] / 100) : null;
}

async function fetchPriceData(url: string): Promise<PriceData | null> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; personal comics collection tool)',
      'Accept': 'text/html',
    },
  });
  if (!res.ok) return null;
  const html = await res.text();

  // Extract VGPC.chart_data = {...};
  const match = html.match(/VGPC\.chart_data\s*=\s*(\{.*?\});/s);
  if (!match) return null;

  let data: Record<string, [number, number][]>;
  try {
    data = JSON.parse(match[1]);
  } catch {
    return null;
  }

  return {
    url,
    used: extractLatestPrice(data.used),
    graded: extractLatestPrice(data.graded),
    cib: extractLatestPrice(data.cib),
    fetched_at: new Date().toISOString(),
  };
}

async function findViaSearch(title: string, number: string): Promise<string | null> {
  const url = buildSearchUrl(title, number);
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; personal comics collection tool)' },
  });
  if (!res.ok) return null;
  const html = await res.text();
  // Find first comic-books result link
  const m = html.match(/href="(\/game\/comic-books-[^"]+)"/);
  return m ? `https://www.pricecharting.com${m[1]}` : null;
}

async function main() {
  const existing: Record<string, PriceData> = fs.existsSync(OUT_PATH)
    ? JSON.parse(fs.readFileSync(OUT_PATH, 'utf-8'))
    : {};

  const comics = getAllComics().filter(c => c.year && c.number);
  console.log(`${comics.length} comics total, ${Object.keys(existing).length} already fetched`);

  let ok = 0, miss = 0, skip = 0;

  for (let i = 0; i < comics.length; i++) {
    const c = comics[i];
    if (existing[c.marvel_id]) { skip++; continue; }

    const url = buildUrl(c.title, String(c.number), Number(c.year));
    process.stdout.write(`[${i + 1}/${comics.length}] ${c.title} #${c.number}... `);

    let data = await fetchPriceData(url);

    if (!data) {
      // Try search fallback
      await new Promise(r => setTimeout(r, DELAY_MS));
      const searchUrl = await findViaSearch(c.title, String(c.number));
      if (searchUrl) {
        await new Promise(r => setTimeout(r, DELAY_MS));
        data = await fetchPriceData(searchUrl);
      }
    }

    if (data) {
      existing[c.marvel_id] = data;
      console.log(`used=$${data.used} graded=$${data.graded}`);
      ok++;
    } else {
      console.log('not found');
      miss++;
    }

    // Save after each fetch
    fs.writeFileSync(OUT_PATH, JSON.stringify(existing, null, 2));
    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  console.log(`\nDone: ${ok} found, ${miss} not found, ${skip} skipped`);
}

main().catch(console.error);
