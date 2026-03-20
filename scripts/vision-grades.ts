/**
 * Use Claude vision to extract grades from eBay listing images
 * for listings where grade is still 0/null after title parsing.
 * Prioritizes slabbed listings (CGC label is unambiguous).
 */
import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import db from '../lib/db';

const client = new Anthropic();
const DELAY_MS = 500;

async function getGradeFromImage(imageUrl: string): Promise<number | null> {
    // Upgrade to higher resolution
    const highResUrl = imageUrl
        .replace(/s-l\d+\.(webp|jpg)/, 's-l500.jpg')
        .replace(/s-l\d+\.webp/, 's-l500.jpg');

    let imageData: string;
    let mediaType: 'image/jpeg' | 'image/png' | 'image/webp';
    try {
        const res = await fetch(highResUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        if (!res.ok) return null;
        const buffer = await res.arrayBuffer();
        imageData = Buffer.from(buffer).toString('base64');
        mediaType = highResUrl.endsWith('.png') ? 'image/png' : 'image/jpeg';
    } catch {
        return null;
    }

    const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 64,
        messages: [{
            role: 'user',
            content: [
                {
                    type: 'image',
                    source: { type: 'base64', media_type: mediaType, data: imageData },
                },
                {
                    type: 'text',
                    text: 'This is an eBay listing image for a comic book. If this is a CGC/CBCS/PGX graded slab, what is the numeric grade shown on the label? Reply with ONLY the number (e.g. "7.0" or "9.4"). If no grade is visible or it is not a graded slab, reply "none".',
                },
            ],
        }],
    });

    const text = (response.content[0] as any).text?.trim() ?? '';
    if (text === 'none' || !text) return null;
    const val = parseFloat(text);
    return !isNaN(val) && val >= 0.5 && val <= 10.0 ? val : null;
}

async function main() {
    // Only process slabbed listings (CGC/CBCS/PGX in title) with no grade
    const rows = db.prepare(`
        SELECT item_id, raw_title, image_url
        FROM ebay_listings
        WHERE (grade IS NULL OR grade = 0)
          AND is_slabbed = 1
          AND image_url IS NOT NULL
        ORDER BY RANDOM()
    `).all() as { item_id: string; raw_title: string; image_url: string }[];

    console.log(`${rows.length} slabbed listings with no grade`);

    const update = db.prepare('UPDATE ebay_listings SET grade = ? WHERE item_id = ?');
    let fixed = 0, skipped = 0;

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        process.stdout.write(`[${i + 1}/${rows.length}] ${row.raw_title.slice(0, 60)}... `);

        try {
            const grade = await getGradeFromImage(row.image_url);
            if (grade !== null) {
                update.run(grade, row.item_id);
                console.log(`grade=${grade}`);
                fixed++;
            } else {
                console.log('no grade found');
                skipped++;
            }
        } catch (e) {
            console.log(`error: ${e}`);
            skipped++;
        }

        await new Promise(r => setTimeout(r, DELAY_MS));
    }

    console.log(`\nDone: ${fixed} graded, ${skipped} not found`);
}

main().catch(console.error);
