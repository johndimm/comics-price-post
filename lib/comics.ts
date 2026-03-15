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
    const marvel_id = row[idx("marvel_id")]?.trim() ?? "";
    if (!marvel_id || marvel_id === "#N/A") continue;

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
    const id = comic_id.trim();
    if (!images[id]) images[id] = [];
    images[id].push(photo.trim());
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

let _cache: Comic[] | null = null;

export function getAllComics(): Comic[] {
  if (_cache && process.env.NODE_ENV !== "development") return _cache;

  const comicsMap = parseComicsCSV();
  const imagesMap = parseImagesCSV();
  const thumbsMap = parseMarvelThumbnails();

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
      resultComic.recommended_ask = baseFmv.recommendedAsk
        ? Math.round(baseFmv.recommendedAsk * resultComic.fmv_multiplier)
        : null;
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
