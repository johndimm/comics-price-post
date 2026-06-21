"use client";
import { useState } from "react";
import { GradeCategory } from "@/lib/types";

interface Props {
    marvelId: string;
    comicTitle: string;
    gradeCategory: GradeCategory;
}

const ACTION: Record<GradeCategory, { label: string; title: string }> = {
    raw: {
        label: "Submit for Grading →",
        title: "Submit for community grading or CGC",
    },
    community: {
        label: "Submit to CGC →",
        title: "Submit to CGC for slabbing",
    },
    slabbed: {
        label: "Post to eBay →",
        title: "Post to eBay",
    },
};

export default function RequestGradingButton({ marvelId, comicTitle, gradeCategory }: Props) {
    const [done, setDone] = useState(false);
    const [loading, setLoading] = useState(false);

    const action = ACTION[gradeCategory];

    async function handleClick() {
        if (done || loading) return;
        setLoading(true);
        await fetch("/api/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                type: "grade",
                title: action.title,
                marvelId,
                comicTitle,
            }),
        });
        setLoading(false);
        setDone(true);
    }

    return (
        <button
            className="btn"
            style={{ fontSize: 12, opacity: done ? 0.5 : 1 }}
            onClick={handleClick}
            disabled={done || loading}
        >
            {done ? "Task created ✓" : loading ? "…" : action.label}
        </button>
    );
}
