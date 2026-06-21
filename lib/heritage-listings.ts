import fs from 'fs';
import path from 'path';

export interface HeritageListing {
    filename: string;
    comicId: string | null;
    title: string;
    status: string;
    price: string | null;
    reserve: string | null;
}

const LISTINGS_DIR = path.join(process.cwd(), 'data', 'listings');

export function readHeritageListings(): HeritageListing[] {
    if (!fs.existsSync(LISTINGS_DIR)) return [];
    const files = fs.readdirSync(LISTINGS_DIR).filter(f => f.endsWith('.md'));
    return files.map(filename => {
        const content = fs.readFileSync(path.join(LISTINGS_DIR, filename), 'utf-8');
        const titleMatch = content.match(/^# (.+)/m);
        const idMatch = content.match(/\/comic\/(\d+)/);
        const reserveMatch = content.match(/Reserve[:\s]+\$?([\d,]+)/i);

        // Parse sales activity table for Heritage row
        const heritageRow = content.match(/\|\s*Heritage\s*\|[^|]*\|[^|]*\|([^|]+)\|/);
        const status = heritageRow ? heritageRow[1].trim() : 'Draft';

        // Look for a sold price in the table
        const soldMatch = content.match(/Heritage[^|]*\|\s*\$?([\d,]+)\s*\|[^|]*sold/i);

        return {
            filename,
            comicId: idMatch ? idMatch[1] : null,
            title: titleMatch ? titleMatch[1] : filename.replace('.md', ''),
            status,
            price: soldMatch ? `$${soldMatch[1]}` : null,
            reserve: reserveMatch ? `$${reserveMatch[1]}` : null,
        };
    });
}
