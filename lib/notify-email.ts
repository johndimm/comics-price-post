import nodemailer from 'nodemailer';
import { TaskEntry } from './task-ledger';

function getTransport() {
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EBAY_EMAIL,
            pass: process.env.EBAY_EMAIL_PASSWORD,
        },
    });
}

export async function notifyEbaySale(task: TaskEntry): Promise<void> {
    const dueStr = task.dueAt ? new Date(task.dueAt).toDateString() : 'ASAP';
    const subject = `[ACTION REQUIRED] eBay Sale: ${task.comicTitle} — Ship by ${dueStr}`;
    const text = [
        `Comic: ${task.comicTitle}`,
        `Sale Price: ${task.salePrice ?? '—'}`,
        `Buyer: ${task.buyerName ?? '—'}`,
        `Ship to:\n  ${(task.buyerAddress ?? '—').replace(/, /g, '\n  ')}`,
        `Ship by: ${dueStr}`,
        '',
        'Next steps:',
        '  1. Pack and ship the comic',
        '  2. Mark as shipped on eBay',
        task.marvelId ? `  3. Remove from Shortboxed if cross-listed` : '',
        '',
        `View tasks: http://localhost:3000/tasks`,
        task.ebayOrderId ? `eBay order ID: ${task.ebayOrderId}` : '',
    ].filter(l => l !== undefined).join('\n');

    await getTransport().sendMail({
        from: process.env.EBAY_EMAIL,
        to: process.env.EBAY_EMAIL,
        subject,
        text,
    });
}

export async function notifyShortboxedSale(task: TaskEntry, ebayEnded: boolean, ebayItemId?: string): Promise<void> {
    const subject = `[ACTION REQUIRED] Shortboxed Sale: ${task.comicTitle}${ebayEnded ? ' — eBay listing ended' : ' — CHECK eBay listing'}`;
    const text = [
        `Comic: ${task.comicTitle}`,
        `Sale Price: ${task.salePrice ?? '—'}`,
        `Marketplace: Shortboxed`,
        '',
        'Automatic actions taken:',
        ebayEnded
            ? `  ✓ eBay listing ${ebayItemId ? '#' + ebayItemId : ''} ended`
            : `  ✗ Could not auto-end eBay listing — please end it manually`,
        '',
        'Next steps:',
        '  1. Ship comic to Shortboxed buyer',
        !ebayEnded ? '  2. Manually end eBay listing' : '',
        '',
        `View tasks: http://localhost:3000/tasks`,
    ].filter(l => l !== undefined).join('\n');

    await getTransport().sendMail({
        from: process.env.EBAY_EMAIL,
        to: process.env.EBAY_EMAIL,
        subject,
        text,
    });
}
