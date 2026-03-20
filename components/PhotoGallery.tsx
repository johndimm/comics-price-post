"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

interface PhotoGalleryProps {
    photos: string[];
    title: string;
}

export default function PhotoGallery({ photos, title }: PhotoGalleryProps) {
    const [active, setActive] = useState(0);
    const [lightbox, setLightbox] = useState(false);

    useEffect(() => {
        if (!lightbox) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === "ArrowRight") setActive(a => (a + 1) % photos.length);
            else if (e.key === "ArrowLeft") setActive(a => (a - 1 + photos.length) % photos.length);
            else if (e.key === "Escape") setLightbox(false);
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [lightbox, photos.length]);

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
        <>
        <div className="evidence-photos">
            <div className="evidence-photo-main">
                <div onClick={() => setLightbox(true)} style={{ display: "block", position: "relative", aspectRatio: "2/3", borderRadius: "var(--radius)", border: "1px solid var(--border)", overflow: "hidden", cursor: "zoom-in" }}>
                    <Image
                        src={photos[active]}
                        alt={title}
                        key={photos[active]}
                        fill
                        style={{ objectFit: "contain" }}
                        priority
                    />
                </div>
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
        {lightbox && (
            <div
                onClick={() => setLightbox(false)}
                style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", cursor: "zoom-out" }}
            >
                <img
                    src={photos[active]}
                    alt={title}
                    style={{ maxWidth: "90vw", maxHeight: "90vh", objectFit: "contain", borderRadius: 8 }}
                    onClick={e => e.stopPropagation()}
                />
                <button
                    onClick={() => setLightbox(false)}
                    style={{ position: "absolute", top: 20, right: 24, background: "none", border: "none", color: "#fff", fontSize: 28, cursor: "pointer", lineHeight: 1 }}
                >✕</button>
                {photos.length > 1 && (
                    <>
                    <button onClick={e => { e.stopPropagation(); setActive(a => (a - 1 + photos.length) % photos.length); }}
                        style={{ position: "absolute", left: 20, background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", fontSize: 28, padding: "8px 16px", borderRadius: 6, cursor: "pointer" }}>‹</button>
                    <button onClick={e => { e.stopPropagation(); setActive(a => (a + 1) % photos.length); }}
                        style={{ position: "absolute", right: 20, background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", fontSize: 28, padding: "8px 16px", borderRadius: 6, cursor: "pointer" }}>›</button>
                    </>
                )}
            </div>
        )}
        </>
    );
}
