import { notFound } from "next/navigation";
import Link from "next/link";
import { getAllComics, getComicById, getGradeLabel } from "@/lib/comics";
import { getListingsByComic, calcFMV, getGradeCurvePoints, getComicMetadata } from "@/lib/db";
import { Comic } from "@/lib/types";
import ListingClient from "./ListingClient";

interface Params {
    params: Promise<{ id: string }>;
}

export async function generateStaticParams() {
    const comics = getAllComics();
    return comics.map((c) => ({ id: c.marvel_id }));
}

function comicEra(year: number): string {
    if (year >= 1938 && year <= 1955) return "Golden Age";
    if (year >= 1956 && year <= 1969) return "Silver Age";
    if (year >= 1970 && year <= 1979) return "Bronze Age";
    if (year >= 1980 && year <= 1991) return "Copper Age";
    return "Modern Age";
}

function ebayTitle(comic: Comic, gradeLabel: string): string {
    const era = comicEra(comic.year);
    const pub = comic.publisher || "Marvel Comics";
    const grade = comic.grade_category === "slabbed" && comic.grade > 0
        ? `CGC ${comic.grade.toFixed(1)}`
        : comic.grade > 0 ? gradeLabel : "";
    const qualified = comic.is_qualified ? " Qualified" : "";
    const parts = [
        `${comic.title} #${comic.number}`,
        grade + qualified,
        era,
        pub,
        String(comic.year),
    ].filter(Boolean);
    const title = parts.join(" ");
    return title.length > 80 ? title.slice(0, 77) + "…" : title;
}

function conditionFromGrade(grade: number): string {
    if (grade >= 9.8) return "Near Mint / Mint";
    if (grade >= 9.4) return "Near Mint";
    if (grade >= 9.0) return "Near Mint (-)";
    if (grade >= 8.5) return "Very Fine (+)";
    if (grade >= 8.0) return "Very Fine";
    if (grade >= 7.0) return "Fine / Very Fine";
    if (grade >= 6.0) return "Fine";
    if (grade >= 5.0) return "Very Good / Fine";
    if (grade >= 4.0) return "Very Good";
    if (grade >= 3.0) return "Good / Very Good";
    if (grade >= 2.0) return "Good";
    return "Fair / Poor";
}

function buildDescription(comic: Comic, gradeLabel: string, metadata: ReturnType<typeof getComicMetadata>): string {
    const era = comicEra(comic.year);
    const condition = conditionFromGrade(comic.grade);
    const isSlabbed = comic.grade_category === "slabbed";

    const lines: string[] = [];

    lines.push(`<h2>${comic.title} #${comic.number} — ${era} Marvel Comics (${comic.year})</h2>`);
    lines.push(`<p><strong>Condition:</strong> ${condition}${comic.is_qualified ? " (Qualified — see notes)" : ""}</p>`);

    if (isSlabbed) {
        const hasCert = comic.cgc && comic.cgc.toLowerCase() !== "yes";
        const certLink = hasCert
            ? ` Cert <a href="https://www.cgccomics.com/certlookup/${comic.cgc}/" target="_blank">#${comic.cgc}</a>.`
            : " (cert # not recorded — verify on CGC registry before listing).";
        lines.push(`<p><strong>CGC Graded:</strong> ${comic.grade.toFixed(1)} (${gradeLabel})${certLink} Professionally graded and encapsulated by CGC (Certified Guaranty Company). No restoration detected.</p>`);
        if (comic.community_url) {
            const range = (comic.community_low && comic.community_high)
                ? ` (community range: ${comic.community_low}–${comic.community_high})`
                : "";
            lines.push(`<p><strong>CGC Community Census:</strong> See how other collectors rate this issue${range}: <a href="${comic.community_url}">${comic.community_url}</a></p>`);
        }
    } else {
        // Raw or community-graded — community URL is primary evidence for the grade
        if (comic.community_url) {
            const range = (comic.community_low && comic.community_high)
                ? `${comic.community_low}–${comic.community_high}` : null;
            lines.push(`<p><strong>Grade: ${comic.grade.toFixed(1)} (${gradeLabel})</strong> — assigned based on the CGC Community grading census. The community consensus provides a reliable estimate of the grade this book would receive if professionally submitted to CGC.</p>`);
            lines.push(`<p>Community grade range${range ? `: <strong>${range}</strong>` : " available"} — view the full census and all community votes here: <a href="${comic.community_url}">${comic.community_url}</a></p>`);
        } else {
            lines.push(`<p><strong>Grade:</strong> ${comic.grade > 0 ? `${comic.grade.toFixed(1)} (${gradeLabel}) — raw ungraded copy.` : "Ungraded raw copy."}</p>`);
        }
    }

    if (comic.is_qualified) {
        lines.push(`<p><strong>⚠️ Qualified Grade:</strong> ${comic.notes || "See photos for details."}</p>`);
    }

    if (metadata?.description) {
        const sentences = metadata.description.match(/[^.!?]+[.!?]+/g) ?? [];
        const synopsis = sentences.slice(0, 4).join(" ").trim();
        if (synopsis) {
            lines.push(`<h3>Story Synopsis</h3><p>${synopsis}</p>`);
        }
    }

    if (metadata?.writers || metadata?.pencilers || metadata?.inkers) {
        lines.push(`<h3>Credits</h3><ul>`);
        if (metadata?.writers) lines.push(`<li><strong>Writer:</strong> ${metadata.writers}</li>`);
        if (metadata?.pencilers) lines.push(`<li><strong>Pencils:</strong> ${metadata.pencilers}</li>`);
        if (metadata?.inkers) lines.push(`<li><strong>Inks:</strong> ${metadata.inkers}</li>`);
        lines.push(`</ul>`);
    }

    if (comic.artist) {
        lines.push(`<p><strong>Cover Artist:</strong> ${comic.artist}</p>`);
    }

    if (comic.nice_panels) {
        lines.push(`<p><strong>Notable:</strong> ${comic.nice_panels}</p>`);
    }

    if (comic.notes && !comic.is_qualified) {
        lines.push(`<p><strong>Notes:</strong> ${comic.notes}</p>`);
    }

    lines.push(`<h3>What You're Getting</h3><ul>`);
    lines.push(`<li>The comic book shown in the photos</li>`);
    if (isSlabbed) {
        lines.push(`<li>CGC-certified slab — sealed and tamper-evident</li>`);
    }
    lines.push(`<li>Carefully packaged for safe shipping</li>`);
    lines.push(`</ul>`);

    lines.push(`<p><em>Please review all photos carefully before purchasing. Ask any questions before bidding. All sales final.</em></p>`);

    return lines.join("\n");
}

export default async function ListingPage({ params }: Params) {
    const { id } = await params;
    const comic = getComicById(id);
    if (!comic) notFound();

    const listings = getListingsByComic(id);
    const metadata = getComicMetadata(id);
    const soldListings = listings.filter(l => l.type === "sold");
    const askingListings = listings.filter(l => l.type === "asking");

    const gradeCurve = getGradeCurvePoints(id);
    const isSlabbed = comic.grade_category === "slabbed";
    const baseFmv = calcFMV(comic.sold_price, soldListings, askingListings, comic.grade, gradeCurve, isSlabbed);
    const fmvValue = baseFmv.value !== null ? Math.round(baseFmv.value * comic.fmv_multiplier) : null;
    const rawAsk = baseFmv.recommendedAsk ?? (fmvValue ? Math.round(fmvValue * 1.15) : null);
    const rawAskWithMultiplier = rawAsk != null ? Math.round(rawAsk * comic.fmv_multiplier) : null;
    const askPrice = rawAskWithMultiplier != null && fmvValue != null
        ? Math.min(Math.max(rawAskWithMultiplier, Math.round(fmvValue * 1.1)), Math.round(fmvValue * 1.2))
        : rawAskWithMultiplier;

    const gradeLabel = getGradeLabel(comic.grade);
    const title = ebayTitle(comic, gradeLabel);
    const condition = conditionFromGrade(comic.grade);
    const era = comicEra(comic.year);
    const description = buildDescription(comic, gradeLabel, metadata);

    const specifics: [string, string][] = [
        ["Publisher", comic.publisher || "Marvel Comics"],
        ["Publication Year", String(comic.year)],
        ["Issue Number", `#${comic.number}`],
        ["Era", era],
        ["Grade", comic.grade > 0 ? `${comic.grade.toFixed(1)} — ${gradeLabel}` : "Ungraded"],
        ...(isSlabbed ? [["CGC Cert #", comic.cgc && comic.cgc.toLowerCase() !== "yes" ? comic.cgc : "— add before listing"] as [string, string]] : []),
        ...(comic.artist ? [["Cover Artist", comic.artist] as [string, string]] : []),
        ["Genre", comic.genre || "Superhero"],
        ...(comic.is_qualified ? [["Condition Notes", "Qualified grade"] as [string, string]] : []),
    ];

    return (
        <div className="listing-page">
            <div className="listing-nav">
                <Link href={`/comic/${id}`} className="evidence-back">← Back to comic</Link>
                <span className="listing-nav-label">Simulated eBay Listing</span>
            </div>

            <ListingClient
                title={title}
                askPrice={askPrice}
                condition={condition}
                photos={comic.photos}
                specifics={specifics}
                description={description}
                comicTitle={comic.title}
                comicNumber={comic.number}
            />
        </div>
    );
}
