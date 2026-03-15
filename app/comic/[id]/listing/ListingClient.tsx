"use client";

import { useState } from "react";
import Image from "next/image";

interface ListingClientProps {
    title: string;
    askPrice: number | null;
    condition: string;
    photos: string[];
    specifics: [string, string][];
    description: string;
    comicTitle: string;
    comicNumber: string;
}

export default function ListingClient({
    title,
    askPrice,
    condition,
    photos,
    specifics,
    description,
    comicTitle,
    comicNumber,
}: ListingClientProps) {
    const [activePhoto, setActivePhoto] = useState(0);
    const [copied, setCopied] = useState<"title" | "desc" | null>(null);

    function copy(text: string, which: "title" | "desc") {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(which);
            setTimeout(() => setCopied(null), 2000);
        });
    }

    return (
        <div className="ebay-listing">
            {/* eBay-style header bar */}
            <div className="ebay-header-bar">
                <span className="ebay-breadcrumb">
                    Comics &rsaquo; Silver Age &rsaquo; Marvel &rsaquo; {comicTitle} &rsaquo; #{comicNumber}
                </span>
            </div>

            <div className="ebay-body">
                {/* Left: photos */}
                <div className="ebay-photos">
                    <div className="ebay-main-photo">
                        {photos[activePhoto] ? (
                            <Image src={photos[activePhoto]} alt={title} fill style={{ objectFit: "contain" }} priority />
                        ) : (
                            <div className="ebay-no-photo">No photo available</div>
                        )}
                    </div>
                    {photos.length > 1 && (
                        <div className="ebay-thumbs">
                            {photos.map((p, i) => (
                                <Image
                                    key={i}
                                    src={p}
                                    alt=""
                                    width={60}
                                    height={80}
                                    className={`ebay-thumb ${activePhoto === i ? "active" : ""}`}
                                    onClick={() => setActivePhoto(i)}
                                    style={{ objectFit: "cover", cursor: "pointer" }}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Right: listing details */}
                <div className="ebay-details">
                    <div className="ebay-title-row">
                        <h1 className="ebay-title">{title}</h1>
                        <button
                            className="btn btn-sm"
                            onClick={() => copy(title, "title")}
                            title="Copy title to clipboard"
                        >
                            {copied === "title" ? "✓ Copied" : "Copy Title"}
                        </button>
                    </div>
                    <div className="ebay-char-count" style={{ color: title.length > 80 ? "#e53" : "#888", fontSize: 12 }}>
                        {title.length}/80 characters
                    </div>

                    <div className="ebay-price-block">
                        {askPrice != null ? (
                            <>
                                <span className="ebay-price-label">Buy It Now</span>
                                <span className="ebay-price">${askPrice.toLocaleString()}.00</span>
                            </>
                        ) : (
                            <span className="ebay-price-label">Price not determined</span>
                        )}
                    </div>

                    <div className="ebay-condition">
                        <span className="ebay-field-label">Condition:</span>
                        <span className="ebay-field-value">{condition}</span>
                    </div>

                    <div className="ebay-specifics">
                        <div className="ebay-specifics-title">Item Specifics</div>
                        <table className="ebay-specifics-table">
                            <tbody>
                                {specifics.map(([k, v]) => (
                                    <tr key={k}>
                                        <td className="ebay-spec-key">{k}</td>
                                        <td className="ebay-spec-val">
                                            {k === "CGC Cert #" && /^\d+$/.test(v) ? (
                                                <a
                                                    href={`https://www.cgccomics.com/certlookup/${v}/`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{ color: 'var(--blue)' }}
                                                >
                                                    {v}
                                                </a>
                                            ) : v}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Description section */}
            <div className="ebay-description-section">
                <div className="ebay-description-header">
                    <h2>Item Description</h2>
                    <button
                        className="btn btn-sm"
                        onClick={() => {
                            // Copy as plain text (strip HTML tags)
                            const plain = description.replace(/<[^>]+>/g, "").replace(/\n{3,}/g, "\n\n").trim();
                            copy(plain, "desc");
                        }}
                    >
                        {copied === "desc" ? "✓ Copied" : "Copy Description"}
                    </button>
                </div>
                <div
                    className="ebay-description"
                    dangerouslySetInnerHTML={{ __html: description }}
                />
            </div>
        </div>
    );
}
