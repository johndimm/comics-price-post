import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = process.env.SQLITE_PATH || 'data/comics.db';

// Ensure directory exists
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const db = new Database(dbPath);

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS ebay_listings (
    item_id TEXT PRIMARY KEY,
    marvel_id TEXT NOT NULL,
    type TEXT NOT NULL, -- 'sold' or 'asking'
    price REAL NOT NULL,
    currency TEXT DEFAULT 'USD',
    sale_date TEXT,
    grade REAL,
    is_slabbed INTEGER, -- 0 or 1
    raw_title TEXT,
    listing_url TEXT,
    image_url TEXT,
    synced_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sync_log (
    marvel_id TEXT PRIMARY KEY,
    last_sold_sync TEXT,
    last_asking_sync TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_ebay_marvel_id ON ebay_listings(marvel_id);

  CREATE TABLE IF NOT EXISTS comic_metadata (
    marvel_id TEXT PRIMARY KEY,
    description TEXT,
    writers TEXT,
    pencilers TEXT,
    inkers TEXT,
    colorists TEXT,
    letterers TEXT,
    editors TEXT,
    characters TEXT,
    fetched_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

export interface eBayListing {
  item_id: string;
  marvel_id: string;
  type: 'sold' | 'asking';
  price: number;
  currency: string;
  sale_date: string | null;
  grade: number | null;
  is_slabbed: number;
  raw_title: string | null;
  listing_url: string | null;
  image_url: string | null;
  synced_at: string;
}

const FACSIMILE_KEYWORDS = ['facsimile', 'reprint', 'replica', ' svg ', 'facsimile edition'];
function isFacsimile(title: string | null): boolean {
  if (!title) return false;
  const t = title.toLowerCase();
  return FACSIMILE_KEYWORDS.some(kw => t.includes(kw));
}

export interface ComicMetadata {
  description: string | null;
  writers: string | null;
  pencilers: string | null;
  inkers: string | null;
  colorists: string | null;
  letterers: string | null;
  editors: string | null;
  characters: string | null;
}

export function getComicMetadata(marvelId: string): ComicMetadata | null {
  const row = db.prepare('SELECT * FROM comic_metadata WHERE marvel_id = ?').get(marvelId) as any;
  return row ?? null;
}

export function getListingsByComic(marvelId: string): eBayListing[] {
  const stmt = db.prepare('SELECT * FROM ebay_listings WHERE marvel_id = ? ORDER BY sale_date DESC, synced_at DESC');
  const all = stmt.all(marvelId) as eBayListing[];
  return all.filter(l => !isFacsimile(l.raw_title));
}

function median(prices: number[]): number {
  const sorted = [...prices].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function gradeFilteredPrices(listings: eBayListing[], targetGrade: number, windowSize: number): number[] {
  return listings
    .filter(l => l.grade !== null && l.grade !== undefined && Math.abs(l.grade - targetGrade) <= windowSize)
    .map(l => l.price);
}

export function calcFMV(spreadsheetPrice: string | null, ebaySold: eBayListing[], ebayAsking: eBayListing[], targetGrade: number, gradeCurves?: GradeCurves, isSlabbed?: boolean): { value: number | null; method: string; source: 'sold' | 'asking' | 'none', recommendedAsk?: number } {
  let method = "";

  // Interpolate a grade curve (array of {x,y} points) at a given grade
  function evalCurve(pts: GradeCurvePoint[], grade: number): number | null {
    if (!pts || pts.length < 2) return null;
    const sorted = [...pts].sort((a, b) => a.x - b.x);
    // Only extrapolate up to 1.0 grade beyond the curve's range
    if (grade < sorted[0].x - 1 || grade > sorted[sorted.length - 1].x + 1) return null;
    if (grade <= sorted[0].x) return sorted[0].y;
    if (grade >= sorted[sorted.length - 1].x) return sorted[sorted.length - 1].y;
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].x <= grade && grade <= sorted[i + 1].x) {
        const t = (grade - sorted[i].x) / (sorted[i + 1].x - sorted[i].x);
        return Math.round(sorted[i].y + t * (sorted[i + 1].y - sorted[i].y));
      }
    }
    return null;
  }

  // Pre-filter sold listings by type to avoid raw/slabbed contamination
  const typedSold = isSlabbed === true
    ? ebaySold.filter(l => l.is_slabbed === 1)
    : isSlabbed === false
    ? ebaySold.filter(l => l.is_slabbed === 0)
    : ebaySold;

  // 1. Spreadsheet-recorded sale price (our own sale, highest confidence)
  const spreadsheetSold: number[] = [];
  if (spreadsheetPrice) {
    const p = parseFloat(spreadsheetPrice.replace(/[^0-9.]/g, ""));
    if (!isNaN(p) && p > 0) {
      spreadsheetSold.push(p);
      method = "Includes spreadsheet-recorded sale. ";
    }
  }

  // 2. Tight near-grade eBay sold (±0.5) — same type only
  const tightSold = gradeFilteredPrices(typedSold, targetGrade, 0.5);
  if (tightSold.length >= 2 || (tightSold.length >= 1 && spreadsheetSold.length >= 1)) {
    const combined = [...spreadsheetSold, ...tightSold];
    let fmvValue = Math.round(median(combined));

    // Floor FMV at the highest recent sale (last 90 days) at this grade
    const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const recentTight = typedSold.filter(l =>
      l.grade !== null && l.grade !== undefined &&
      Math.abs(l.grade - targetGrade) <= 0.5 &&
      l.sale_date && new Date(l.sale_date).getTime() >= ninetyDaysAgo
    );
    let recentFloorNote = '';
    if (recentTight.length > 0) {
      const maxRecent = Math.max(...recentTight.map(l => l.price));
      if (maxRecent > fmvValue) {
        fmvValue = maxRecent;
        recentFloorNote = ` Floored at recent high $${maxRecent.toLocaleString()} (${recentTight.length} sale${recentTight.length > 1 ? 's' : ''} in 90 days).`;
      }
    }

    return {
      value: fmvValue,
      method: method + `Grade-matched eBay sold ±0.5 (${tightSold.length}).${recentFloorNote}`,
      source: 'sold',
    };
  }

  // 3. Grade curve prediction — type-aware: slabbed books must not fall back to raw curve
  //    For slabbed: sold_slabbed → asking_slabbed (discounted) → nothing
  //    For raw:     sold_raw → asking_raw (discounted) → nothing
  //    Unknown:     sold_slabbed → sold_raw (old behaviour)
  let soldCurvePred: number | null = null;
  let askingCurvePred: number | null = null;
  let curveFromAsking = false;

  if (isSlabbed === true) {
    soldCurvePred = evalCurve(gradeCurves?.sold.slabbed ?? [], targetGrade);
    askingCurvePred = evalCurve(gradeCurves?.asking.slabbed ?? [], targetGrade);
    if (soldCurvePred === null && askingCurvePred !== null) {
      soldCurvePred = Math.round(askingCurvePred * 0.85);
      curveFromAsking = true;
    }
  } else if (isSlabbed === false) {
    soldCurvePred = evalCurve(gradeCurves?.sold.raw ?? [], targetGrade);
    askingCurvePred = evalCurve(gradeCurves?.asking.raw ?? [], targetGrade);
    if (soldCurvePred === null && askingCurvePred !== null) {
      soldCurvePred = Math.round(askingCurvePred * 0.85);
      curveFromAsking = true;
    }
  } else {
    soldCurvePred =
      evalCurve(gradeCurves?.sold.slabbed ?? [], targetGrade) ??
      evalCurve(gradeCurves?.sold.raw ?? [], targetGrade);
    askingCurvePred =
      evalCurve(gradeCurves?.asking.slabbed ?? [], targetGrade) ??
      evalCurve(gradeCurves?.asking.raw ?? [], targetGrade);
  }

  if (soldCurvePred !== null) {
    const combined = spreadsheetSold.length > 0 ? [...spreadsheetSold, soldCurvePred] : [soldCurvePred];
    const extra = spreadsheetSold.length > 0 ? ' blended with spreadsheet sale' : '';
    const src = curveFromAsking ? 'asking curve (15% discount)' : 'sold curve';
    return {
      value: Math.round(median(combined)),
      method: method + `Grade ${src} prediction at gr${targetGrade}${extra}.`,
      source: curveFromAsking ? 'asking' : 'sold',
      recommendedAsk: askingCurvePred ?? undefined,
    };
  }

  // 4. Wider ±1.0 sold (fallback when no grade curve available)
  const nearSold = gradeFilteredPrices(typedSold, targetGrade, 1.0);
  if (nearSold.length >= 2 || (nearSold.length >= 1 && spreadsheetSold.length >= 1)) {
    const combined = [...spreadsheetSold, ...nearSold];
    let fmvValue = Math.round(median(combined));

    const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const recentNear = typedSold.filter(l =>
      l.grade !== null && l.grade !== undefined &&
      Math.abs(l.grade - targetGrade) <= 1.0 &&
      l.sale_date && new Date(l.sale_date).getTime() >= ninetyDaysAgo
    );
    let recentFloorNote = '';
    if (recentNear.length > 0) {
      const maxRecent = Math.max(...recentNear.map(l => l.price));
      if (maxRecent > fmvValue) {
        fmvValue = maxRecent;
        recentFloorNote = ` Floored at recent high $${maxRecent.toLocaleString()} (${recentNear.length} sale${recentNear.length > 1 ? 's' : ''} in 90 days).`;
      }
    }

    return {
      value: fmvValue,
      method: method + `Grade-matched eBay sold ±1.0 (${nearSold.length}).${recentFloorNote}`,
      source: 'sold',
    };
  }

  // 5. Grade-filtered asking prices — better than all-grade sold for high-grade books
  const askWindows = [0.5, 1.0, 2.0];
  for (const window of askWindows) {
    const prices = gradeFilteredPrices(ebayAsking, targetGrade, window);
    if (prices.length >= 3) {
      const med = median(prices);
      return {
        value: Math.round(med * 0.85),
        method: `Median of ${prices.length} asking prices within ±${window} grade. Applied 15% market discount.`,
        source: 'asking',
        recommendedAsk: Math.round(med),
      };
    }
  }

  // 6. Single near-grade sold + spreadsheet, or just spreadsheet
  if (spreadsheetSold.length > 0 || nearSold.length > 0) {
    const combined = [...spreadsheetSold, ...nearSold];
    return {
      value: Math.round(median(combined)),
      method: method + `Limited sold data (${combined.length} point(s)).`,
      source: 'sold',
    };
  }

  // 7. All-grade asking as last resort
  const allAsking = ebayAsking.filter(l => l.grade !== null && l.grade !== undefined);
  const askSource = allAsking.length >= 3 ? allAsking : ebayAsking;
  if (askSource.length > 0) {
    const med = median(askSource.map(l => l.price));
    return {
      value: Math.round(med * 0.85),
      method: `Median of ${askSource.length} asking prices (all grades). Applied 15% discount.`,
      source: 'asking',
      recommendedAsk: Math.round(med),
    };
  }

  return { value: null, method: "No recent sold or asking price data available.", source: 'none' };
}

// --- Price normalization ---

interface GradeCurve {
  points: { x: number; y: number }[];
  n: number;
}

interface NormCoeffs {
  beta_time: number;
  beta_grade: number;
  reference_date: string;
  per_title_beta_grade?: Record<string, number>;
  grade_curves?: Record<string, {
    sold_slabbed?: GradeCurve; sold_raw?: GradeCurve;
    asking_slabbed?: GradeCurve; asking_raw?: GradeCurve;
  }>;
}

export interface GradeCurvePoint { x: number; y: number; }
export interface GradeCurves {
  sold: { slabbed: GradeCurvePoint[]; raw: GradeCurvePoint[] };
  asking: { slabbed: GradeCurvePoint[]; raw: GradeCurvePoint[] };
}

export function getGradeCurvePoints(marvelId: string): GradeCurves {
  const empty: GradeCurves = {
    sold: { slabbed: [], raw: [] },
    asking: { slabbed: [], raw: [] },
  };
  const coeffs = getNormCoeffs();
  if (!coeffs?.grade_curves) return empty;
  const entry = coeffs.grade_curves[marvelId];
  if (!entry) return empty;

  return {
    sold: {
      slabbed: entry.sold_slabbed?.points ?? [],
      raw: entry.sold_raw?.points ?? [],
    },
    asking: {
      slabbed: entry.asking_slabbed?.points ?? [],
      raw: entry.asking_raw?.points ?? [],
    },
  };
}

let _normCoeffs: NormCoeffs | null = null;
let _normCoeffsMtime = 0;

export function getNormCoeffs(): NormCoeffs | null {
  const normPath = path.join(process.cwd(), 'data', 'price-norm.json');
  if (!fs.existsSync(normPath)) return null;
  const mtime = fs.statSync(normPath).mtimeMs;
  if (_normCoeffs && mtime === _normCoeffsMtime) return _normCoeffs;
  _normCoeffs = JSON.parse(fs.readFileSync(normPath, 'utf-8')) as NormCoeffs;
  _normCoeffsMtime = mtime;
  return _normCoeffs;
}

export function normalizePrice(
  price: number,
  grade: number,
  dateStr: string | null,
  targetGrade: number,
  coeffs: NormCoeffs,
  marvelId?: string
): number {
  const betaGrade = (marvelId ? coeffs.per_title_beta_grade?.[marvelId] : undefined) ?? coeffs.beta_grade;
  const today = new Date(coeffs.reference_date);
  const listingDate = dateStr ? new Date(dateStr) : today;
  const daysAgo = Math.max(0, (today.getTime() - listingDate.getTime()) / 86400000);
  const logNorm =
    Math.log(price) -
    coeffs.beta_time * daysAgo -
    betaGrade * grade +
    betaGrade * targetGrade;
  return Math.round(Math.exp(logNorm));
}

export default db;
