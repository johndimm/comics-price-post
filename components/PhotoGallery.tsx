"use client";

import { useState } from "react";
import Image from "next/image";

interface PhotoGalleryProps {
    photos: string[];
    title: string;
}

export default function PhotoGallery({ photos, title }: PhotoGalleryProps) {
    const [active, setActive] = useState(0);

    if (photos.length === 0) {
        return (
            <div className="evidence-photo-main">
                <div
                    style={{
                        width: "100%",
                        aspectRatio: "2/3",
                        background: "var(--bg3)",
                        borderRadius: "var(--radius)",
                        border: "1px solid var(--border)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--text-dim)",
                        fontSize: 13,
                    }}
                >
                    No photos available
                </div>
            </div>
        );
    }

    return (
        <div className="evidence-photos">
            <div className="evidence-photo-main">
                <a href={photos[active]} target="_blank" rel="noopener noreferrer" style={{ display: "block", position: "relative", aspectRatio: "2/3", borderRadius: "var(--radius)", border: "1px solid var(--border)", overflow: "hidden" }}>
                    <Image
                        src={photos[active]}
                        alt={title}
                        key={photos[active]}
                        fill
                        style={{ objectFit: "contain", cursor: "zoom-in" }}
                        priority
                    />
                </a>
            </div>
            {photos.length > 1 && (
                <div className="evidence-photo-thumbs">
                    {photos.map((p, i) => (
                        <Image
                            key={p}
                            src={p}
                            alt={`Photo ${i + 1}`}
                            width={56}
                            height={80}
                            onClick={() => setActive(i)}
                            style={{
                                objectFit: "cover",
                                borderColor: i === active ? "var(--gold)" : undefined,
                                cursor: "pointer",
                            }}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
