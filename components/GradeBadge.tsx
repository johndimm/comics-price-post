import { GradeCategory } from "@/lib/types";

interface GradeBadgeProps {
    category: GradeCategory;
    cgcGrade?: string;
    grade?: number;
}

const labels: Record<GradeCategory, string> = {
    slabbed: "Slabbed",
    community: "Community",
    raw: "Raw",
};

const styles: Record<GradeCategory, string> = {
    slabbed: "badge-slabbed",
    community: "badge-community",
    raw: "badge-raw",
};

export default function GradeBadge({ category, cgcGrade, grade }: GradeBadgeProps) {
    const label = labels[category];
    const detail = category === "slabbed" && cgcGrade
        ? `CGC ${cgcGrade}`
        : grade !== undefined
            ? `${grade.toFixed(1)}`
            : "";

    return (
        <span className={`badge ${styles[category]}`}>
            {label}
            {detail ? <span className="badge-detail">{detail}</span> : null}
        </span>
    );
}
