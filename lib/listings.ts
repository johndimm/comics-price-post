import fs from 'fs';
import path from 'path';

export interface ListingFile {
    filename: string;
    comicId: string;
    content: string;
}

const LISTINGS_DIR = path.join(process.cwd(), 'data', 'listings');

function extractComicId(content: string): string | null {
    const match = content.match(/\/comic\/(\d+)/);
    return match ? match[1] : null;
}

export function getListingForComic(comicId: string): ListingFile | null {
    if (!fs.existsSync(LISTINGS_DIR)) return null;
    const files = fs.readdirSync(LISTINGS_DIR).filter(f => f.endsWith('.md'));
    for (const filename of files) {
        const content = fs.readFileSync(path.join(LISTINGS_DIR, filename), 'utf-8');
        const id = extractComicId(content);
        if (id === comicId) {
            return { filename, comicId, content };
        }
    }
    return null;
}

export function getAllListings(): ListingFile[] {
    if (!fs.existsSync(LISTINGS_DIR)) return [];
    const files = fs.readdirSync(LISTINGS_DIR).filter(f => f.endsWith('.md'));
    return files.flatMap(filename => {
        const content = fs.readFileSync(path.join(LISTINGS_DIR, filename), 'utf-8');
        const comicId = extractComicId(content);
        if (!comicId) return [];
        return [{ filename, comicId, content }];
    });
}

/** Convert markdown to HTML (tables, bold, headings, lists, paragraphs) */
export function markdownToHtml(md: string): string {
    const lines = md.split('\n');
    const out: string[] = [];
    let inTable = false;
    let inList = false;
    let tableHeaderDone = false;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        // Headings
        const h3 = line.match(/^### (.+)/);
        const h2 = line.match(/^## (.+)/);
        const h1 = line.match(/^# (.+)/);
        if (inTable && !line.startsWith('|')) { out.push('</tbody></table>'); inTable = false; tableHeaderDone = false; }
        if (inList && !line.match(/^[-*] /)) { out.push('</ul>'); inList = false; }

        if (h1) { out.push(`<h1>${inline(h1[1])}</h1>`); continue; }
        if (h2) { out.push(`<h2>${inline(h2[1])}</h2>`); continue; }
        if (h3) { out.push(`<h3>${inline(h3[1])}</h3>`); continue; }

        // Table
        if (line.startsWith('|')) {
            const isSep = /^\|[-| :]+\|$/.test(line.trim());
            if (isSep) { tableHeaderDone = true; continue; }
            const cells = line.split('|').slice(1, -1).map(c => c.trim());
            if (!inTable) {
                out.push('<table><thead><tr>' + cells.map(c => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>');
                inTable = true; tableHeaderDone = false;
            } else if (!tableHeaderDone) {
                // still in thead — skip (separator already removed)
            } else {
                out.push('<tr>' + cells.map(c => `<td>${inline(c)}</td>`).join('') + '</tr>');
            }
            continue;
        }

        // List
        const listMatch = line.match(/^[-*] (.+)/);
        if (listMatch) {
            if (!inList) { out.push('<ul>'); inList = true; }
            out.push(`<li>${inline(listMatch[1])}</li>`);
            continue;
        }

        // Blank line
        if (line.trim() === '') { out.push(''); continue; }

        // Paragraph
        out.push(`<p>${inline(line)}</p>`);
    }
    if (inTable) out.push('</tbody></table>');
    if (inList) out.push('</ul>');
    return out.join('\n');
}

function inline(text: string): string {
    return text
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code>$1</code>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}
