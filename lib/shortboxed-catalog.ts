// Canonical catalog of Shortboxed listings.
// Key: normalized title (lowercase, no punctuation) → { marvelId, grade, title }
// Used by the sales agent to match Shortboxed sale emails to specific comics.

export interface ShortboxedEntry {
    title: string;
    marvelId: string;
    grade: string;
    price: string;
    status: 'active' | 'sold';
    url?: string;
}

export const SHORTBOXED_CATALOG: ShortboxedEntry[] = [
    { title: "Fantastic Four #55",        marvelId: "13261", grade: "CGC 9.2", price: "$1,695", status: "active" },
    { title: "Fantastic Four #46",        marvelId: "13251", grade: "CGC 9.0", price: "$1,332", status: "active" },
    { title: "Fantastic Four #39",        marvelId: "13216", grade: "CGC 9.0", price: "$804",   status: "active" },
    { title: "Fantastic Four #58",        marvelId: "13264", grade: "CGC 9.2", price: "$595",   status: "active" },
    { title: "Fantastic Four #67",        marvelId: "13274", grade: "CGC 8.0", price: "$324",   status: "active" },
    { title: "Fantastic Four #56",        marvelId: "13262", grade: "CGC 7.5", price: "$127",   status: "active" },
    { title: "Fantastic Four #47",        marvelId: "13252", grade: "CGC 9.0", price: "$386",   status: "active" },
    { title: "Fantastic Four #44",        marvelId: "13249", grade: "CGC 9.2", price: "$375",   status: "active" },
    { title: "Fantastic Four #41",        marvelId: "13239", grade: "CGC 9.0", price: "$295",   status: "active" },
    { title: "Fantastic Four #38",        marvelId: "13205", grade: "CGC 8.5", price: "$342",   status: "active" },
    { title: "Amazing Spider-Man #19",    marvelId: "6582",  grade: "CGC 9.0", price: "$1,899", status: "active" },
    { title: "Amazing Spider-Man #30",    marvelId: "6705",  grade: "CGC 7.5", price: "$294",   status: "active" },
    { title: "Amazing Spider-Man #27",    marvelId: "6671",  grade: "CGC 8.0", price: "$560",   status: "active" },
    { title: "Amazing Spider-Man #13",    marvelId: "6516",  grade: "RAW",     price: "$445",   status: "active" },
    { title: "Mighty Thor #134",          marvelId: "11462", grade: "CGC 5.5", price: "$67",    status: "active", url: "https://shortboxed.com/product/UHJvZHVjdDplY2ZlMTZkYy1hMzkxLTQzZmQtYmE1MS1kZmFkMTFmM2U3NWU=" },
    { title: "Journey Into Mystery #118", marvelId: "9693",  grade: "CGC 9.2", price: "$1,020", status: "active" },
    { title: "Journey Into Mystery #116", marvelId: "9691",  grade: "CGC 8.0", price: "$189",   status: "active" },
    { title: "Journey Into Mystery #115", marvelId: "9690",  grade: "CGC 9.0", price: "$380",   status: "active" },
    { title: "Journey Into Mystery #114", marvelId: "9689",  grade: "CGC 7.0", price: "$250",   status: "active" },
    { title: "X-Men #23",                 marvelId: "12470", grade: "CGC 5.0", price: "$105",   status: "sold"   },
    { title: "X-Men #18",                 marvelId: "12464", grade: "CGC 5.0", price: "$156",   status: "active" },
    { title: "X-Men #16",                 marvelId: "12462", grade: "CGC 5.0", price: "$216",   status: "active" },
    { title: "X-Men #13",                 marvelId: "12447", grade: "CGC 6.0", price: "$400",   status: "active" },
    { title: "X-Men #11",                 marvelId: "12425", grade: "CGC 6.5", price: "$324",   status: "active" },
    { title: "X-Men #10",                 marvelId: "12414", grade: "CGC 7.0", price: "$368",   status: "active" },
];

// Normalize a title for fuzzy matching (lowercase, collapse spaces, strip punctuation)
function normalize(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9 #]/g, '').replace(/\s+/g, ' ').trim();
}

export function findByTitle(emailText: string): ShortboxedEntry | null {
    const norm = normalize(emailText);
    // Try longest-match first
    const sorted = [...SHORTBOXED_CATALOG].sort((a, b) => b.title.length - a.title.length);
    for (const entry of sorted) {
        if (norm.includes(normalize(entry.title))) return entry;
    }
    return null;
}
