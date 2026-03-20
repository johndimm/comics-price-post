import { notFound } from "next/navigation";
import Link from "next/link";
import { getAllComics, getComicById, getGradeLabel } from "@/lib/comics";
import { getListingsByComic, eBayListing, calcFMV, getGradeCurvePoints, getComicMetadata } from "@/lib/db";
import GradeBadge from "@/components/GradeBadge";
import StatusBadge from "@/components/StatusBadge";
import EvidenceClient from "@/components/EvidenceClient";
import PhotoGallery from "@/components/PhotoGallery";

interface Params {
    params: Promise<{ id: string }>;
}

// Pre-generate all comic pages at build time
export async function generateStaticParams() {
    const comics = getAllComics();
    return comics.map((c) => ({ id: c.marvel_id }));
}

export default async function EvidencePage({ params }: Params) {
    const { id } = await params;
    const comic = getComicById(id);
    if (!comic) notFound();

    const isReplica = /replica|facsimile|reprint/i.test(comic.title);
    const listings = isReplica ? [] : getListingsByComic(id);
    const metadata = getComicMetadata(id);
    const soldListings = listings.filter(l => l.type === 'sold');
    const askingListings = listings.filter(l => l.type === 'asking');

    const gradeCurve = getGradeCurvePoints(id);
    const isSlabbed = comic.grade_category === 'slabbed';
    const baseFmv = calcFMV(comic.sold_price, soldListings, askingListings, comic.grade, gradeCurve, isSlabbed);
    const fmvValue = baseFmv.value !== null ? Math.round(baseFmv.value * comic.fmv_multiplier) : null;
    // Prefer asking curve as recommendedAsk; fall back to 15% markup on FMV
    // Apply same qualified discount to recommended ask
    const rawRecommendedAsk = baseFmv.recommendedAsk ?? (fmvValue ? Math.round(fmvValue * 1.15) : undefined);
    const rawAskWithMultiplier = rawRecommendedAsk != null ? Math.round(rawRecommendedAsk * comic.fmv_multiplier) : undefined;
    const recommendedAsk = rawAskWithMultiplier != null && fmvValue != null
        ? Math.min(Math.max(rawAskWithMultiplier, Math.round(fmvValue * 1.1)), Math.round(fmvValue * 1.2))
        : rawAskWithMultiplier;
    const fmvLow = baseFmv.low !== null ? Math.round(baseFmv.low * comic.fmv_multiplier) : null;
    const fmvHigh = baseFmv.high !== null ? Math.round(baseFmv.high * comic.fmv_multiplier) : null;
    const fmv = {
        value: fmvValue,
        low: fmvLow,
        high: fmvHigh,
        method: comic.is_qualified
            ? `${baseFmv.method} (Adjusted by ${Math.round((1 - comic.fmv_multiplier) * 100)}% for Qualified grade)`
            : baseFmv.method,
        source: baseFmv.source
    };
    const gradeLabel = getGradeLabel(comic.grade);

    // Curve values at our grade (for hover display)
    function evalCurve(pts: {x: number; y: number}[], grade: number): number | null {
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
    const soldDotY =
        evalCurve(gradeCurve.sold.slabbed, comic.grade) ??
        evalCurve(gradeCurve.sold.raw, comic.grade) ??
        fmv.value ?? undefined;
    const askingDotY =
        evalCurve(gradeCurve.asking.slabbed, comic.grade) ??
        evalCurve(gradeCurve.asking.raw, comic.grade) ??
        recommendedAsk;

    // Prepare chart data
    const mapToListing = (l: eBayListing) => ({
        x: l.sale_date ? new Date(l.sale_date).getTime() : new Date(l.synced_at).getTime(),
        y: l.price,
        type: l.is_slabbed ? "slabbed" as const : "raw" as const,
        id: l.item_id,
        grade: l.grade ?? null,
        date: l.sale_date ?? l.synced_at,
    });

    const mapByGrade = (l: eBayListing) => ({
        x: l.grade || 0,
        y: l.price,
        type: l.is_slabbed ? "slabbed" as const : "raw" as const,
        id: l.item_id,
        grade: l.grade ?? null,
        date: l.sale_date ?? l.synced_at,
    });

    const soldByTime = soldListings.map(mapToListing);
    const soldByGrade = soldListings.map(mapByGrade);
    const askingByTime = askingListings.map(mapToListing);
    const askingByGrade = askingListings.map(mapByGrade);

    return (
        <>
            {/* Header */}
            <div className="evidence-header">
                <Link href="/" className="evidence-back">
                    ← Back to collection
                </Link>
                <div className="evidence-title-row">
                    <div>
                        <span className="evidence-title">{comic.title} </span>
                        <span className="evidence-issue">#{comic.number}</span>
                        {comic.is_qualified && (
                            <span style={{
                                marginLeft: 12,
                                background: '#eab308',
                                color: '#000',
                                padding: '2px 8px',
                                borderRadius: 4,
                                fontSize: 13,
                                fontWeight: 'bold'
                            }}>
                                QUALIFIED GRADE
                            </span>
                        )}
                    </div>
                    {listings.length > 0 && (
                        <div className="last-updated">
                            eBay Data Synced: {new Date(listings[0].synced_at).toLocaleDateString()}
                        </div>
                    )}
                </div>
                <div className="evidence-meta">
                    <span className="evidence-year">{comic.month} {comic.year}</span>
                    <GradeBadge
                        category={comic.grade_category}
                        cgcGrade={comic.cgc}
                        grade={comic.grade}
                    />
                    <StatusBadge status={comic.for_sale || "NFS"} />
                    {comic.artist && (
                        <span className="evidence-year">Art: {comic.artist}</span>
                    )}
                    <Link href={`/comic/${id}/listing`} className="btn" style={{ marginLeft: 'auto', fontSize: 12 }}>
                        eBay Listing →
                    </Link>
                </div>
            </div>

            {/* Body: photos + charts */}
            <div className="evidence-body">
                {/* Left: photos + detail */}
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <PhotoGallery photos={comic.photos} title={`${comic.title} #${comic.number}`} />

                    {/* Metadata: plot + creators */}
                    {metadata && (metadata.writers || metadata.pencilers || metadata.description) && (
                        <div className="evidence-details">
                            {metadata.writers && (
                                <div className="detail-row">
                                    <span className="detail-key">Writer</span>
                                    <span className="detail-val">{metadata.writers}</span>
                                </div>
                            )}
                            {metadata.pencilers && (
                                <div className="detail-row">
                                    <span className="detail-key">Pencils</span>
                                    <span className="detail-val">{metadata.pencilers}</span>
                                </div>
                            )}
                            {metadata.inkers && (
                                <div className="detail-row">
                                    <span className="detail-key">Inks</span>
                                    <span className="detail-val">{metadata.inkers}</span>
                                </div>
                            )}
                            {metadata.description && (() => {
                                const sentences = metadata.description.match(/[^.!?]+[.!?]+/g) ?? [];
                                const short = sentences.slice(0, 3).join(' ').trim();
                                return (
                                    <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.6, color: '#ccc' }}>
                                        {short}
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    {/* Detail card */}
                    <div className="evidence-details">
                        <h3>Comic Details</h3>
                        {[
                            ["Grade", comic.grade > 0 ? `${comic.grade.toFixed(1)} — ${gradeLabel}` : "—"],
                            ["Community Low", comic.community_low || "—"],
                            ["Community High", comic.community_high || "—"],
                            ["Publisher", comic.publisher || "—"],
                            ["Genre", comic.genre || "—"],
                            ["Box", comic.box || "—"],
                            ["Sold Price", comic.sold_price || "—"],
                            ["Sold Date", comic.sold_date || "—"],
                            ["Notes", comic.notes || "—"],
                            ["eBay Listings", listings.length > 0 ? listings.length.toString() : "None synced"],
                        ["PC Ungraded", comic.pc_ungraded ? `$${comic.pc_ungraded.toLocaleString()}` : "—"],
                        ["PC Graded", comic.pc_graded ? `$${comic.pc_graded.toLocaleString()}` : "—"],
                        ].flatMap(([k, v]) => {
                            const row = (
                                <div key={k} className="detail-row">
                                    <span className="detail-key">{k}</span>
                                    <span className="detail-val">{v}</span>
                                </div>
                            );
                            if (k === "Community High" && comic.community_url) {
                                return [row, (
                                    <div key="community-chat" className="detail-row">
                                        <span className="detail-key">Community Chat</span>
                                        <span className="detail-val">
                                            <a href={comic.community_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)' }}>
                                                View ↗
                                            </a>
                                        </span>
                                    </div>
                                )];
                            }
                            return [row];
                        })}
                        {/* CGC cert with lookup link */}
                        <div className="detail-row">
                            <span className="detail-key">CGC Slab</span>
                            <span className="detail-val">
                                {comic.cgc && comic.cgc.toLowerCase() !== "yes" ? (
                                    <a href={`https://www.cgccomics.com/certlookup/${comic.cgc}/`}
                                       target="_blank" rel="noopener noreferrer"
                                       style={{ color: 'var(--blue)' }}>
                                        {comic.cgc}
                                    </a>
                                ) : comic.cgc === "yes" ? "Slabbed (cert # pending)" : "Not slabbed"}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Right: charts + grid */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {isReplica && (
                        <div style={{ padding: '12px 16px', background: '#2a1a00', border: '1px solid #7a4a00', borderRadius: 8, color: '#f5a623', fontSize: 14 }}>
                            Replica / facsimile edition — no market price data available.
                        </div>
                    )}
                    <EvidenceClient
                        soldByTime={soldByTime}
                        soldByGrade={soldByGrade}
                        askingByTime={askingByTime}
                        askingByGrade={askingByGrade}
                        marketValue={fmv.value ?? undefined}
                        fmvLow={fmv.low ?? undefined}
                        fmvHigh={fmv.high ?? undefined}
                        recommendedAsk={recommendedAsk}
                        soldDotY={soldDotY}
                        askingDotY={askingDotY}
                        fmvMethod={fmv.method}
                        fmvSource={fmv.source}
                        currentGrade={comic.grade}
                        listings={listings}
                        gradeCurve={gradeCurve}
                    />
                </div>
            </div>
        </>
    );
}
