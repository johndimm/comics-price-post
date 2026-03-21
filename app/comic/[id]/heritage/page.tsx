import { notFound } from "next/navigation";
import Link from "next/link";
import { getComicById } from "@/lib/comics";
import { getListingForComic, markdownToHtml } from "@/lib/listings";
import { getAllComics } from "@/lib/comics";

interface Params {
    params: Promise<{ id: string }>;
}

export async function generateStaticParams() {
    const comics = getAllComics();
    return comics.map((c) => ({ id: c.marvel_id }));
}

export default async function HeritagePage({ params }: Params) {
    const { id } = await params;
    const comic = getComicById(id);
    if (!comic) notFound();

    const listing = getListingForComic(id);
    if (!listing) notFound();

    const html = markdownToHtml(listing.content);

    return (
        <>
            <div className="evidence-header">
                <Link href={`/comic/${id}`} className="evidence-back">
                    ← Back to {comic.title} #{comic.number}
                </Link>
                <div className="evidence-title-row">
                    <span className="evidence-title">Heritage Listing</span>
                </div>
            </div>

            <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px' }}>
                <style>{`
                    .heritage-body h1 { font-size: 22px; font-weight: bold; margin: 0 0 16px; color: #fff; }
                    .heritage-body h2 { font-size: 17px; font-weight: bold; margin: 28px 0 10px; color: #e2c97e; border-bottom: 1px solid #333; padding-bottom: 4px; }
                    .heritage-body h3 { font-size: 15px; font-weight: bold; margin: 20px 0 8px; color: #aaa; }
                    .heritage-body p { margin: 0 0 10px; line-height: 1.6; color: #ccc; font-size: 14px; }
                    .heritage-body strong { color: #fff; }
                    .heritage-body ul { margin: 0 0 12px 20px; padding: 0; }
                    .heritage-body li { margin: 4px 0; color: #ccc; font-size: 14px; line-height: 1.5; }
                    .heritage-body table { width: 100%; border-collapse: collapse; margin: 12px 0 20px; font-size: 13px; }
                    .heritage-body th { background: #222; color: #aaa; padding: 6px 10px; text-align: left; border-bottom: 1px solid #444; }
                    .heritage-body td { padding: 6px 10px; border-bottom: 1px solid #2a2a2a; color: #ccc; }
                    .heritage-body tr:hover td { background: #1a1a1a; }
                    .heritage-body a { color: var(--blue); }
                `}</style>
                <div
                    className="heritage-body evidence-details"
                    dangerouslySetInnerHTML={{ __html: html }}
                />
            </div>
        </>
    );
}
