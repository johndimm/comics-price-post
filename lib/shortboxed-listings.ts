import fs from 'fs';
import path from 'path';

export interface ShortboxedListing {
    title: string;
    grade: string;
    price: string | null;
    status: 'listed' | 'sold' | 'unlisted';
}

export function readShortboxedListings(): ShortboxedListing[] {
    const file = path.join(process.cwd(), 'data', 'shortboxed-portfolio.txt');
    if (!fs.existsSync(file)) return [];
    const text = fs.readFileSync(file, 'utf-8');

    const results: ShortboxedListing[] = [];
    // Split into blocks by double newline
    const blocks = text.split(/\n{2,}/);

    for (const block of blocks) {
        const lines = block.split('\n').map(l => l.trim()).filter(l =>
            l && l !== 'chevron_right' && l !== 'favorite' && !/^\d+$/.test(l)
        );
        if (lines.length < 2) continue;

        const title = lines[0];
        const grade = lines[1];
        // Skip if first line looks like a grade (no letters typical of a title)
        if (!title || /^(CGC|RAW|FMV)/i.test(title)) continue;

        const priceOrStatus = lines[2] ?? null;
        let status: ShortboxedListing['status'] = 'unlisted';
        let price: string | null = null;

        if (!priceOrStatus || priceOrStatus === 'List for Sale') {
            status = 'unlisted';
        } else if (/sold/i.test(priceOrStatus)) {
            status = 'sold';
            price = null;
        } else if (/FMV/.test(priceOrStatus)) {
            // has FMV range — check if next line has a price
            const nextPrice = lines[3] ?? null;
            price = nextPrice?.startsWith('$') ? nextPrice : null;
            status = price ? 'listed' : 'unlisted';
        } else if (priceOrStatus.startsWith('$')) {
            price = priceOrStatus;
            status = 'listed';
        }

        results.push({ title, grade, price, status });
    }
    return results;
}
