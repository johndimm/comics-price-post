// Shared types that can be imported by both client and server components.
// Do NOT import from 'lib/comics' (which uses fs) in client components — import from here.

export type GradeCategory = "slabbed" | "community" | "raw";

export interface Comic {
    marvel_id: string;
    year: number;
    month: string;
    date: string;
    publisher: string;
    genre: string;
    price: string;
    title: string;
    number: string;
    box: string;
    norm_grade: number;
    grade: number;
    cgc: string;
    community_url: string;
    community_low: string;
    community_high: string;
    qualified: string;
    for_sale: string;
    sold_price: string;
    sold_date: string;
    artist: string;
    nice_panels: string;
    notes: string;
    // joined
    photos: string[];
    grade_category: GradeCategory;
    is_qualified: boolean;
    fmv_multiplier: number;
    fmv?: number | null;
    recommended_ask?: number | null;
}

export function getGradeLabel(grade: number): string {
    if (grade >= 9.8) return "NM/MT 9.8";
    if (grade >= 9.6) return "NM+ 9.6";
    if (grade >= 9.4) return "NM 9.4";
    if (grade >= 9.2) return "NM- 9.2";
    if (grade >= 9.0) return "VF/NM 9.0";
    if (grade >= 8.5) return "VF+ 8.5";
    if (grade >= 8.0) return "VF 8.0";
    if (grade >= 7.5) return "VF- 7.5";
    if (grade >= 7.0) return "FN/VF 7.0";
    if (grade >= 6.5) return "FN+ 6.5";
    if (grade >= 6.0) return "FN 6.0";
    if (grade >= 5.5) return "FN- 5.5";
    if (grade >= 5.0) return "VG/FN 5.0";
    if (grade >= 4.5) return "VG+ 4.5";
    if (grade >= 4.0) return "VG 4.0";
    if (grade >= 3.5) return "VG- 3.5";
    if (grade >= 3.0) return "GD/VG 3.0";
    if (grade >= 2.5) return "GD+ 2.5";
    if (grade >= 2.0) return "GD 2.0";
    if (grade >= 1.8) return "GD- 1.8";
    if (grade >= 1.5) return "FR/GD 1.5";
    if (grade >= 1.0) return "FR 1.0";
    return "PR 0.5";
}
