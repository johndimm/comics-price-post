import { ImapFlow } from 'imapflow';
import { findByTitle, ShortboxedEntry } from './shortboxed-catalog';
import fs from 'fs';
import path from 'path';

export interface ShortboxedSaleEmail {
    uid: number;
    subject: string;
    body: string;
    receivedAt: string;
    comic: ShortboxedEntry | null;
    priceFound: string | null;
}

export async function fetchShortboxedSaleEmails(processedUids: number[]): Promise<ShortboxedSaleEmail[]> {
    const client = new ImapFlow({
        host: 'imap.gmail.com',
        port: 993,
        secure: true,
        auth: {
            user: process.env.EBAY_EMAIL as string,
            pass: process.env.EBAY_EMAIL_PASSWORD as string,
        },
        logger: false,
    });

    const results: ShortboxedSaleEmail[] = [];

    await client.connect();
    try {
        await client.mailboxOpen('INBOX');

        // Search for emails from Shortboxed directly, or forwarded from owner's Yahoo
        const directUids = await client.search({ from: 'shortboxed.com' }, { uid: true }) as number[];
        const forwardedUids = await client.search({ subject: 'Ready to ship' }, { uid: true }) as number[];
        const uids = [...new Set([...directUids, ...forwardedUids])];

        for (const uid of uids as number[]) {
            if (processedUids.includes(uid)) continue;

            const msg = await client.fetchOne(String(uid), { source: true, envelope: true }, { uid: true });
            if (!msg) continue;

            const raw = msg.source?.toString() ?? '';
            const subject = msg.envelope?.subject ?? '';
            const date = msg.envelope?.date?.toISOString() ?? new Date().toISOString();

            // Log raw email for first-time debugging
            const debugPath = path.join(process.cwd(), 'data', 'shortboxed-email-debug.log');
            if (!fs.existsSync(debugPath)) {
                fs.writeFileSync(debugPath, `=== UID ${uid} ===\n${raw}\n\n`);
            }

            // Only process Shortboxed "Ready to ship" sale notifications
            const isSaleEmail = /ready to ship/i.test(subject) || /you have sold the following/i.test(raw);
            if (!isSaleEmail) {
                results.push({ uid, subject, body: raw, receivedAt: date, comic: null, priceFound: null });
                continue;
            }

            // Parse item line: "X-Men 23   4659391011   CGC   5" or similar
            // Format: <title with space before number>   <cert>   CGC   <grade>
            const itemMatch = raw.match(/([A-Za-z][A-Za-z\- ']+\s+\d+)\s+\d{10}\s+CGC\s+([\d.]+)/);
            const rawTitle = itemMatch ? itemMatch[1].trim() : '';
            const gradeNum = itemMatch ? itemMatch[2] : '';

            // Normalize "X-Men 23" → "X-Men #23"
            const normalizedTitle = rawTitle.replace(/\s+(\d+)$/, ' #$1');

            const comic = findByTitle(normalizedTitle + (gradeNum ? ` CGC ${gradeNum}` : ''));
            const priceMatch = raw.match(/Sold at \$?([\d,]+)/i) ?? raw.match(/\$([\d,]+(?:\.\d{2})?)/);
            const priceFound = priceMatch ? `$${priceMatch[1]}` : null;

            results.push({ uid, subject, body: raw, receivedAt: date, comic, priceFound });
        }
    } finally {
        await client.logout();
    }

    return results;
}
