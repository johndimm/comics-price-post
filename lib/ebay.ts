export interface eBayAuthResponse {
    access_token: string;
    expires_in: number;
    token_type: string;
}

export interface eBayListing {
    itemId: string;
    title: string;
    price: number;
    currency: string;
    saleDate?: string;
    listingUrl: string;
    imageUrl?: string;
    isSlabbed: boolean;
    grade?: number;
    type: 'asking' | 'sold';
}

let cachedAccessToken: string | null = null;
let tokenExpiry: number = 0;

export async function getAccessToken(): Promise<string> {
    const now = Date.now();
    if (cachedAccessToken && now < tokenExpiry) {
        return cachedAccessToken;
    }

    const clientId = process.env.EBAY_CLIENT_ID;
    const clientSecret = process.env.EBAY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error("Missing eBay credentials in .env");
    }

    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": `Basic ${auth}`,
        },
        body: new URLSearchParams({
            grant_type: "client_credentials",
            scope: "https://api.ebay.com/oauth/api_scope",
        }),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Failed to get eBay token: ${response.statusText} - ${errorBody}`);
    }

    const data = (await response.json()) as eBayAuthResponse;
    cachedAccessToken = data.access_token;
    tokenExpiry = now + data.expires_in * 1000 - 60000;

    return cachedAccessToken;
}

function parseGrade(title: string, issueNumber?: string, year?: string | number): number | undefined {
    let t = title.toUpperCase();

    // Priority 1: CGC/CBCS/PGX grade — must run BEFORE issue-number removal
    // because "CGC 7.0" would become "CGC .0" if issue #7 is stripped first.
    // Handles: "CGC 7.0", "CGC7.0", "CGC .5", "CGC5.5", but NOT "CGC NG"/"CGC PG"/"CGC SS"
    const slabMatch = t.match(/\b(?:CGC|CBCS|PGX)\s*(\d+\.?\d*|\.\d+)\b(?!\s*(?:NG|PG|SS|OW|PQ)\b)/);
    if (slabMatch) {
        const val = parseFloat(slabMatch[1]);
        if (val >= 0.5 && val <= 10.0) return val;
    }

    // Remove the issue number, but NOT when followed by a decimal point
    // (avoids stripping the "7" from a bare "7.5" grade when issue is #7)
    if (issueNumber) {
        const numPattern = new RegExp(`\\b${issueNumber}(?!\\.)`, 'g');
        t = t.replace(numPattern, ' ');
    }
    if (year) {
        const yearPattern = new RegExp(`\\b${year}\\b`, 'g');
        t = t.replace(yearPattern, ' ');
    }

    // Priority 2: Bare decimal grade (9.6, 7.5, 4.0, 0.5, etc.)
    const numMatch = t.match(/\b(10\.0|\d\.\d)\b/);
    if (numMatch) {
        const val = parseFloat(numMatch[1]);
        if (val >= 0.5 && val <= 10.0) return val;
    }

    // Priority 2: Text-based mapping (Check specific/longer codes first)
    if (t.includes('VERY FINE/NEAR MINT') || t.includes('VF/NM')) return 9.0;
    if (t.includes('FINE/VERY FINE') || t.includes('FN/VF') || t.includes('F/VF')) return 7.0;
    if (t.includes('VERY GOOD/FINE') || t.includes('VG/FN') || t.includes('VG/F')) return 5.0;
    if (t.includes('GOOD/VERY GOOD') || t.includes('GD/VG') || t.includes('G/VG')) return 3.0;
    if (t.includes('FAIR/GOOD') || t.includes('FR/GD') || t.includes('F/G')) return 1.5;

    if (t.includes('NEAR MINT+') || t.includes('NM+')) return 9.6;
    if (t.includes('NEAR MINT-') || t.includes('NM-')) return 9.2;
    if (t.includes('NEAR MINT') || t.includes('NM')) return 9.4;
    if (t.includes('VERY FINE+') || t.includes('VF+')) return 8.5;
    if (t.includes('VERY FINE') || t.includes('VF')) return 8.0;
    if (t.includes('FINE+') || t.includes('FN+')) return 6.5;
    if (t.includes('FINE') || t.includes('FN')) return 6.0;
    if (t.includes('VERY GOOD') || t.includes('VG')) return 4.0;
    if (t.includes('GOOD') || t.includes('GD')) return 2.0;
    if (t.includes('FAIR') || t.includes('FR')) return 1.0;
    if (t.includes('POOR') || t.includes('PR')) return 0.5;
    if (t.includes('GEM MINT') || t.includes('GM')) return 10.0;
    if (t.includes('MINT') || t.includes('MT')) return 9.9;

    return undefined;
}

export async function searchActiveItems(query: string, limit: number = 20, issueNumber?: string, year?: string | number, requiredWords?: string[]): Promise<eBayListing[]> {
    const token = await getAccessToken();
    const encodedQuery = encodeURIComponent(query);
    const url = `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodedQuery}&limit=${limit}`;

    const response = await fetch(url, {
        headers: {
            "Authorization": `Bearer ${token}`
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`eBay Browse API Error: ${errorText}`);
        throw new Error(`eBay Browse API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const items = data.itemSummaries || [];

    return items.map((item: any): eBayListing => {
        const title = item.title || "";
        const isSlabbed = /CGC|CBCS|PGX/i.test(title);
        const grade = parseGrade(title, issueNumber, year);

        // Try to parse the itemCreationDate if it exists
        let saleDate = undefined;
        if (item.itemCreationDate) {
            try {
                saleDate = new Date(item.itemCreationDate).toISOString().split('T')[0];
            } catch (e) { }
        }

        return {
            itemId: (item.itemId as string)?.replace(/^v\d+\|/, '').replace(/\|\d+$/, '') ?? item.itemId,
            title,
            price: parseFloat(item.price?.value || "0"),
            currency: item.price?.currency || "USD",
            saleDate,
            listingUrl: item.itemWebUrl?.replace(/[?&]epid=[^&]+/, (m) => m.startsWith('?') ? '?' : ''),
            imageUrl: item.image?.imageUrl,
            isSlabbed,
            grade,
            type: 'asking'
        };
    }).filter((l: eBayListing) => {
        if (issueNumber && !new RegExp(`\\b${issueNumber}\\b`).test(l.title)) return false;
        if (requiredWords) {
            const t = l.title.toLowerCase();
            if (!requiredWords.every(w => t.includes(w.toLowerCase()))) return false;
        }
        return true;
    });
}

export async function searchSoldItems(query: string): Promise<eBayListing[]> {
    // Note: The Browse API item_summary search does NOT support a SOLD filter.
    // To get sold items, one typically needs the Marketplace Insights API.
    // For now, we will return an empty array for sold items to avoid mislabeling
    // active items as sold, which was a previous bug.
    return [];
}
