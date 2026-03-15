"use client";

import Image from "next/image";
import Link from "next/link";
import { Comic, getGradeLabel } from "@/lib/types";
import GradeBadge from "./GradeBadge";
import StatusBadge from "./StatusBadge";

interface ComicCardProps {
    comic: Comic;
}

export default function ComicCard({ comic }: ComicCardProps) {
    const photo = comic.photos[0];
    const gradeLabel = getGradeLabel(comic.grade);

    return (
        <Link href={`/comic/${comic.marvel_id}`} className="comic-card">
            <div className="comic-card-image">
                {photo ? (
                    <Image
                        src={photo}
                        alt={`${comic.title} #${comic.number}`}
                        fill
                        style={{ objectFit: "cover" }}
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    />
                ) : (
                    <div className="comic-card-no-image">
                        <span>No Image</span>
                    </div>
                )}
            </div>
            <div className="comic-card-body">
                <div className="comic-card-title">{comic.title}</div>
                <div className="comic-card-number">#{comic.number}</div>
                <div className="comic-card-year">{comic.year}</div>
                <div className="comic-card-badges">
                    <GradeBadge
                        category={comic.grade_category}
                        cgcGrade={comic.cgc}
                        grade={comic.grade}
                    />
                    <StatusBadge status={comic.for_sale || "NFS"} />
                </div>
                {comic.grade > 0 && (
                    <div className="comic-card-grade">{gradeLabel}</div>
                )}
                {comic.fmv != null && (
                    <div className="comic-card-fmv">${comic.fmv.toLocaleString()}</div>
                )}
                {comic.is_qualified && (
                    <div className="comic-card-qualified">Qualified</div>
                )}
            </div>
        </Link>
    );
}
