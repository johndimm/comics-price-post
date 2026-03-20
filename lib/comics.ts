import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { Comic, GradeCategory } from "./types";
import { getListingsByComic, calcFMV, getGradeCurvePoints } from "./db";

// Re-export types for server-side convenience
export type { Comic, GradeCategory };
export { getGradeLabel } from "./types";

function parseComicsCSV(): Record<string, Omit<Comic, "photos" | "grade_category" | "is_qualified" | "fmv_multiplier">> {
  const csvPath = path.join(
    process.cwd(),
    "public",
    "Silver Age Marvels - 2026 all comics.csv"
  );
  const content = fs.readFileSync(csvPath, "utf-8");

  const result = Papa.parse<string[]>(content, { skipEmptyLines: true });
  const rows = result.data;
  const headers = rows[0];

  const idx = (name: string) => headers.indexOf(name);

  const comics: Record<string, Omit<Comic, "photos" | "grade_category" | "is_qualified" | "fmv_multiplier">> = {};

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    let marvel_id = row[idx("marvel_id")]?.trim() ?? "";
    if (!marvel_id) continue;
    if (marvel_id === "#N/A") {
      // Generate a stable local ID from title + number
      const title = row[idx("title")]?.trim() ?? "";
      const number = row[idx("number")]?.trim() ?? "";
      if (!title) continue;
      const slug = (title + "-" + number)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      marvel_id = "local-" + slug;
    }

    comics[marvel_id] = {
      marvel_id,
      year: parseInt(row[idx("year")] ?? "0", 10),
      month: row[idx("month")]?.trim() ?? "",
      date: row[idx("date")]?.trim() ?? "",
      publisher: row[idx("publisher")]?.trim() ?? "",
      genre: row[idx("genre")]?.trim() ?? "",
      price: row[idx("price")]?.trim() ?? "",
      title: row[idx("title")]?.trim() ?? "",
      number: row[idx("number")]?.trim() ?? "",
      box: row[idx("box")]?.trim() ?? "",
      norm_grade: parseFloat(row[idx("norm grade")] ?? "0") || 0,
      grade: parseFloat(row[idx("grade")] ?? "0") || 0,
      cgc: row[idx("CGC")]?.trim() ?? "",
      community_url: row[idx("community url")]?.trim() ?? "",
      community_low: row[idx("community low")]?.trim() ?? "",
      community_high: row[idx("community high")]?.trim() ?? "",
      qualified: row[idx("qualified")]?.trim() ?? "",
      for_sale: row[idx("For Sale")]?.trim() ?? "",
      sold_price: row[idx("Sold Price")]?.trim() ?? "",
      sold_date: row[idx("Sold Date")]?.trim() ?? "",
      artist: row[idx("artist")]?.trim() ?? "",
      nice_panels: row[idx("nice panels")]?.trim() ?? "",
      notes: row[idx("notes")]?.trim() ?? "",
    };
  }

  return comics;
}

function parseImagesCSV(): Record<string, string[]> {
  const csvPath = path.join(
    process.cwd(),
    "public",
    "comic-photos",
    "comics-images.csv"
  );
  const content = fs.readFileSync(csvPath, "utf-8");
  const result = Papa.parse<string[]>(content, { skipEmptyLines: true });
  const rows = result.data;

  const images: Record<string, string[]> = {};
  for (let i = 1; i < rows.length; i++) {
    const [comic_id, , photo] = rows[i];
    if (!comic_id || !photo) continue;
    const p = photo.trim();
    // Skip local paths — only keep absolute URLs (GitHub raw etc.)
    if (!p.startsWith("http")) continue;
    const id = comic_id.trim();
    if (!images[id]) images[id] = [];
    images[id].push(p);
  }
  return images;
}

function parseMarvelThumbnails(): Record<string, string> {
  const csvPath = path.join(
    process.cwd(),
    "public",
    "comic-photos",
    "comics.csv"
  );
  if (!fs.existsSync(csvPath)) return {};

  const content = fs.readFileSync(csvPath, "utf-8");
  const result = Papa.parse<string[]>(content, { skipEmptyLines: true });
  const rows = result.data;
  const headers = rows[0];
  const idIdx = headers.indexOf("id");
  const thumbIdx = headers.indexOf("thumbnail");

  const thumbs: Record<string, string> = {};
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const id = row[idIdx];
    const thumb = row[thumbIdx];
    if (id && thumb && thumb !== "http://i.annihil.us/u/prod/marvel/i/mg/b/40/image_not_available/portrait_uncanny.jpg") {
      thumbs[id] = thumb.replace("http://", "https://");
    }
  }
  return thumbs;
}

function classifyGrade(comic: Omit<Comic, "photos" | "grade_category" | "is_qualified" | "fmv_multiplier">): GradeCategory {
  if (comic.cgc && comic.cgc.length > 0) return "slabbed";
  if (comic.community_url && comic.community_url.length > 0) return "community";
  return "raw";
}

function evalCurve(pts: { x: number; y: number }[], grade: number): number | null {
  if (!pts || pts.length < 2) return null;
  const sorted = [...pts].sort((a, b) => a.x - b.x);
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

let _cache: Comic[] | null = null;

function loadPricechartingMap(): Record<string, { used: number | null; graded: number | null }> {
  const pcPath = path.join(process.cwd(), 'data', 'pricecharting.json');
  if (!fs.existsSync(pcPath)) return {};
  try {
    const raw = JSON.parse(fs.readFileSync(pcPath, 'utf-8'));
    const map: Record<string, { used: number | null; graded: number | null }> = {};
    for (const [id, val] of Object.entries(raw as Record<string, any>)) {
      map[id] = { used: val.used ?? null, graded: val.graded ?? null };
    }
    return map;
  } catch { return {}; }
}

export function getAllComics(): Comic[] {
  if (_cache && process.env.NODE_ENV !== "development") return _cache;

  const comicsMap = parseComicsCSV();
  const imagesMap = parseImagesCSV();
  const thumbsMap = parseMarvelThumbnails();
  const pcMap = loadPricechartingMap();

  _cache = Object.values(comicsMap).map((c) => {
    const rawPhotos = imagesMap[c.marvel_id] ?? [];
    // Sort: slab OBV first, slab REV second, everything else after
    const photoRank = (p: string) =>
      p.includes("slabbed") && p.includes("_OBV") ? 0 :
      p.includes("slabbed") && p.includes("_REV") ? 1 : 2;
    const photos = [...rawPhotos].sort((a, b) => photoRank(a) - photoRank(b));
    // If no local photos, use Marvel thumbnail as fallback
    if (photos.length === 0 && thumbsMap[c.marvel_id]) {
      photos.push(thumbsMap[c.marvel_id]);
    }

    const is_qualified = c.qualified?.toLowerCase() === "qualified" ||
      c.notes?.toLowerCase().includes("qualified") ||
      c.notes?.toLowerCase().includes("detached pinup") ||
      c.notes?.toLowerCase().includes("missing page");

    const resultComic: Comic = {
      ...c,
      photos,
      grade_category: classifyGrade(c as any),
      is_qualified,
      fmv_multiplier: is_qualified ? 0.8 : 1.0,
    };

    try {
      const listings = getListingsByComic(c.marvel_id);
      const soldListings = listings.filter(l => l.type === 'sold');
      const askingListings = listings.filter(l => l.type === 'asking');

      const gradeCurves = getGradeCurvePoints(c.marvel_id);
      const isSlabbed = resultComic.grade_category === 'slabbed';
      const baseFmv = calcFMV(c.sold_price, soldListings, askingListings, c.grade, gradeCurves, isSlabbed);
      const finalFmv = baseFmv.value !== null ? Math.round(baseFmv.value * resultComic.fmv_multiplier) : null;

      resultComic.fmv = finalFmv;
      resultComic.fmv_low = baseFmv.low !== null ? Math.round(baseFmv.low * resultComic.fmv_multiplier) : null;
      resultComic.fmv_high = baseFmv.high !== null ? Math.round(baseFmv.high * resultComic.fmv_multiplier) : null;
      if (baseFmv.recommendedAsk && finalFmv) {
        const rawAsk = Math.round(baseFmv.recommendedAsk * resultComic.fmv_multiplier);
        resultComic.recommended_ask = Math.min(Math.max(rawAsk, Math.round(finalFmv * 1.1)), Math.round(finalFmv * 1.2));
      } else {
        resultComic.recommended_ask = null;
      }

      // PriceCharting reference prices
      const pc = pcMap[c.marvel_id];
      if (pc) {
        resultComic.pc_ungraded = pc.used;
        resultComic.pc_graded = pc.graded;
      }

      // Slab upside: difference between slabbed and raw FMV curves at this grade (non-slabbed only)
      if (resultComic.grade_category !== 'slabbed' && c.grade > 0) {
        const slabbedFmv = evalCurve(gradeCurves.sold.slabbed, c.grade);
        const rawFmv = evalCurve(gradeCurves.sold.raw, c.grade) ?? resultComic.fmv ?? null;
        if (slabbedFmv != null && rawFmv != null) {
          resultComic.slab_upside = slabbedFmv - rawFmv;
        }
      }
    } catch (e) {
      // Handle gracefully if DB isn't initialized yet
    }

    return resultComic;
  });

  return _cache;
}

export function getComicById(id: string): Comic | undefined {
  return getAllComics().find((c) => c.marvel_id === id);
}
