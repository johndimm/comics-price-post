import fs from 'fs';
import path from 'path';

export interface OfferEntry {
    createdAt: string;
    offerId: string;
    sku: string;
    title: string;
    price: string;
    images: number;
    marketplace: string;
    categoryId: string;
    marvelId?: string;
    listingId?: string;     // set when published
    publishedAt?: string;
    status?: 'draft' | 'published' | 'ended' | 'sold';
    endedAt?: string;
}

const LEDGER_PATH = path.join(process.cwd(), 'data', 'api_offer_ledger.jsonl');

export function readLedger(): OfferEntry[] {
    if (!fs.existsSync(LEDGER_PATH)) return [];
    return fs.readFileSync(LEDGER_PATH, 'utf-8')
        .split('\n')
        .filter(Boolean)
        .map(line => { try { return JSON.parse(line) as OfferEntry; } catch { return null; } })
        .filter((e): e is OfferEntry => e !== null);
}

export function getOffersForComic(marvelId: string): OfferEntry[] {
    return readLedger().filter(e => e.marvelId === marvelId);
}

export function appendToLedger(entry: OfferEntry): void {
    fs.appendFileSync(LEDGER_PATH, JSON.stringify(entry) + '\n');
}
