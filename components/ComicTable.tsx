"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useMemo } from "react";
import { Comic, getGradeLabel } from "@/lib/types";
import GradeBadge from "./GradeBadge";

// ---- Module-level filter components (never recreated on parent re-render) ----

function FilterIcon({ active }: { active: boolean }) {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24"
            fill={active ? "var(--blue)" : "currentColor"}
            style={{ marginLeft: '6px', cursor: 'pointer', opacity: active ? 1 : 0.5 }}>
            <path d="M3 4c0-1.1.9-2 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 1-.59 1.41L15 13.41V19a2 2 0 0 1-1.41 1.91l-2 1A2 2 0 0 1 9 20v-6.59L3.59 7.41A2 2 0 0 1 3 6V4z" />
        </svg>
    );
}

function RangeFilterDropdown({ initialMin, initialMax, onApply, onClear, onClose }: {
    initialMin?: number; initialMax?: number;
    onApply: (min?: number, max?: number) => void;
    onClear: () => void;
    onClose: () => void;
}) {
    const [min, setMin] = useState(initialMin != null ? String(initialMin) : "");
    const [max, setMax] = useState(initialMax != null ? String(initialMax) : "");
    return (
        <div className="filter-dropdown" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
            <div className="filter-dropdown-header">
                <span style={{ fontWeight: 600 }}>Range</span>
                <button className="btn-text" onClick={() => { setMin(""); setMax(""); onClear(); }}>Clear</button>
            </div>
            <div style={{ padding: '8px 12px', display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="number" placeholder="Min" value={min}
                    onChange={e => setMin(e.target.value)}
                    style={{ width: 80, padding: '4px 6px', border: '1px solid #444', borderRadius: 4, background: '#1a1a1a', color: '#eee' }} />
                <span>–</span>
                <input type="number" placeholder="Max" value={max}
                    onChange={e => setMax(e.target.value)}
                    style={{ width: 80, padding: '4px 6px', border: '1px solid #444', borderRadius: 4, background: '#1a1a1a', color: '#eee' }} />
            </div>
            <div className="filter-dropdown-footer">
                <button className="btn btn-blue" onClick={() => {
                    onApply(min ? Number(min) : undefined, max ? Number(max) : undefined);
                    onClose();
                }}>Apply</button>
            </div>
        </div>
    );
}

function CheckboxFilterDropdown({ uniqueValues, selected, onUpdate, onClose }: {
    uniqueValues: string[]; selected: Set<string>;
    onUpdate: (vals: Set<string>) => void;
    onClose: () => void;
}) {
    return (
        <div className="filter-dropdown" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
            <div className="filter-dropdown-header">
                <button className="btn-text" onClick={() => onUpdate(new Set())}>Clear</button>
                <button className="btn-text" onClick={() => onUpdate(new Set(uniqueValues))}>Select All</button>
            </div>
            <div className="filter-dropdown-list">
                {uniqueValues.map(val => (
                    <label key={val} className="filter-item">
                        <input type="checkbox" className="custom-checkbox-small"
                            checked={selected.has(val)}
                            onChange={(e) => {
                                const next = new Set(selected);
                                if (e.target.checked) next.add(val); else next.delete(val);
                                onUpdate(next);
                            }} />
                        <span>{val || "(Empty)"}</span>
                    </label>
                ))}
            </div>
            <div className="filter-dropdown-footer">
                <button className="btn btn-blue" onClick={onClose}>Done</button>
            </div>
        </div>
    );
}

export type SortKey = keyof Pick<Comic, "title" | "number" | "year" | "grade" | "fmv" | "recommended_ask" | "slab_upside" | "grade_category" | "artist">;

export type RangeFilter = { min?: number; max?: number };

interface ComicTableProps {
    comics: Comic[];
    selectedIds: Set<string>;
    columnFilters: Record<string, Set<string>>;
    rangeFilters: Record<string, RangeFilter>;
    sortKey?: SortKey;
    sortDir?: "asc" | "desc";
    onSortChange?: (key: SortKey, dir: "asc" | "desc") => void;
    onToggleSelection: (id: string) => void;
    onToggleAll: () => void;
    onSelectRange: (ids: string[]) => void;
    onUpdateColumnFilter: (column: string, values: Set<string>) => void;
    onUpdateRangeFilter: (column: string, range: RangeFilter) => void;
}

const NUMERIC_COLS = new Set<SortKey>(["fmv", "recommended_ask", "slab_upside", "grade", "year"]);

export default function ComicTable({
    comics,
    selectedIds,
    columnFilters,
    rangeFilters,
    sortKey: sortKeyProp,
    sortDir: sortDirProp,
    onSortChange,
    onToggleSelection,
    onToggleAll,
    onSelectRange,
    onUpdateColumnFilter,
    onUpdateRangeFilter,
}: ComicTableProps) {
    const [sortKeyLocal, setSortKeyLocal] = useState<SortKey>("title");
    const [sortDirLocal, setSortDirLocal] = useState<"asc" | "desc">("asc");
    const sortKey = sortKeyProp ?? sortKeyLocal;
    const sortDir = sortDirProp ?? sortDirLocal;
    const [lastClickedId, setLastClickedId] = useState<string | null>(null);
    const [activeFilterCol, setActiveFilterCol] = useState<string | null>(null);

    useEffect(() => {
        if (!activeFilterCol) return;
        const handler = () => setActiveFilterCol(null);
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [activeFilterCol]);

    function handleSort(key: SortKey) {
        const newDir = key === sortKey ? (sortDir === "asc" ? "desc" : "asc") : "asc";
        if (onSortChange) {
            onSortChange(key, newDir);
        } else {
            setSortKeyLocal(key);
            setSortDirLocal(newDir);
        }
    }

    const sorted = useMemo(() => {
        return [...comics].sort((a, b) => {
            let av: string | number = a[sortKey] ?? "";
            let bv: string | number = b[sortKey] ?? "";
            if (sortKey === "grade" || sortKey === "year" || sortKey === "fmv" || sortKey === "recommended_ask" || sortKey === "slab_upside") {
                av = Number(av) || 0;
                bv = Number(bv) || 0;
            } else if (sortKey === "number") {
                av = parseInt(String(av), 10) || 0;
                bv = parseInt(String(bv), 10) || 0;
            } else {
                av = String(av).toLowerCase();
                bv = String(bv).toLowerCase();
            }
            if (av < bv) return sortDir === "asc" ? -1 : 1;
            if (av > bv) return sortDir === "asc" ? 1 : -1;
            // Secondary sort by issue number when primary values are equal
            if (sortKey === "title") {
                return (parseInt(String(a.number), 10) || 0) - (parseInt(String(b.number), 10) || 0);
            }
            return 0;
        });
    }, [comics, sortKey, sortDir]);

    const handleCheckboxClick = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (e.shiftKey && lastClickedId) {
            const currentIndex = sorted.findIndex(c => c.marvel_id === id);
            const lastIndex = sorted.findIndex(c => c.marvel_id === lastClickedId);

            if (currentIndex !== -1 && lastIndex !== -1) {
                const start = Math.min(currentIndex, lastIndex);
                const end = Math.max(currentIndex, lastIndex);
                const rangeIds = sorted.slice(start, end + 1).map(c => c.marvel_id);
                onSelectRange(rangeIds);
            }
        } else {
            onToggleSelection(id);
        }
        setLastClickedId(id);
    };

    const arrow = (key: SortKey) =>
        sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : " ⬍";

    const allSelected = sorted.length > 0 && selectedIds.size === sorted.length;

    const renderHeader = (label: string, key: SortKey) => {
        const isNumeric = NUMERIC_COLS.has(key);
        const isActive = isNumeric
            ? (rangeFilters[key]?.min != null || rangeFilters[key]?.max != null)
            : (columnFilters[key]?.size || 0) > 0;
        const isOpen = activeFilterCol === key;
        const uniqueValues = isNumeric ? [] :
            Array.from(new Set(comics.map(c => String((c as any)[key] ?? ""))))
                .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

        return (
            <th className="sortable-header">
                <div className="header-content">
                    <span onClick={() => handleSort(key)}>{label}{arrow(key)}</span>
                    <div className="filter-trigger" onClick={(e) => {
                        e.stopPropagation();
                        setActiveFilterCol(isOpen ? null : key);
                    }}>
                        <FilterIcon active={isActive} />
                    </div>
                    {isOpen && isNumeric && (
                        <RangeFilterDropdown
                            key={key}
                            initialMin={rangeFilters[key]?.min}
                            initialMax={rangeFilters[key]?.max}
                            onApply={(min, max) => onUpdateRangeFilter(key, { min, max })}
                            onClear={() => onUpdateRangeFilter(key, {})}
                            onClose={() => setActiveFilterCol(null)}
                        />
                    )}
                    {isOpen && !isNumeric && (
                        <CheckboxFilterDropdown
                            key={key}
                            uniqueValues={uniqueValues}
                            selected={columnFilters[key] || new Set()}
                            onUpdate={(vals) => onUpdateColumnFilter(key, vals)}
                            onClose={() => setActiveFilterCol(null)}
                        />
                    )}
                </div>
            </th>
        );
    };

    return (
        <div className="table-wrapper">
            <table className="comic-table">
                <thead>
                    <tr>
                        <th className="selection-cell">
                            <input
                                type="checkbox"
                                className="custom-checkbox"
                                checked={allSelected}
                                onChange={onToggleAll}
                            />
                        </th>
                        <th>Thumb</th>
                        {renderHeader("Title", "title")}
                        {renderHeader("#", "number")}
                        {renderHeader("Year", "year")}
                        {renderHeader("Grade", "grade")}
                        {renderHeader("Category", "grade_category")}
                        {renderHeader("FMV", "fmv")}
                        {renderHeader("Ask", "recommended_ask")}
                        <th title="PriceCharting ungraded">PC Raw</th>
                        <th title="PriceCharting CGC graded">PC CGC</th>
                        {renderHeader("Artist", "artist")}
                        {renderHeader("Slab ↑", "slab_upside")}
                        <th>CGC</th>
                    </tr>
                </thead>
                <tbody>
                    {sorted.map((comic) => (
                        <tr
                            key={comic.marvel_id}
                            className={selectedIds.has(comic.marvel_id) ? "selected" : ""}
                            onClick={() => onToggleSelection(comic.marvel_id)}
                        >
                            <td className="selection-cell">
                                <input
                                    type="checkbox"
                                    className="custom-checkbox"
                                    checked={selectedIds.has(comic.marvel_id)}
                                    onClick={(e) => handleCheckboxClick(e, comic.marvel_id)}
                                    onChange={() => { }} // Handled by onClick for shift-key support
                                />
                            </td>
                            <td className="thumb-cell">
                                {comic.photos[0] ? (
                                    <Image
                                        src={comic.photos[0]}
                                        alt=""
                                        width={38}
                                        height={56}
                                        className="table-thumb"
                                    />
                                ) : (
                                    <div className="table-thumb-empty" />
                                )}
                            </td>
                            <td>
                                <Link
                                    href={`/comic/${comic.marvel_id}`}
                                    className="table-link"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {comic.title}
                                </Link>
                            </td>
                            <td className="num-cell">#{comic.number}</td>
                            <td className="num-cell">{comic.year}</td>
                            <td className="num-cell">
                                {comic.grade > 0 ? (
                                    <span title={getGradeLabel(comic.grade)}>
                                        {comic.grade.toFixed(1)}
                                        {comic.is_qualified && <span className="qualified-sub-tag" title="Qualified"> (Q)</span>}
                                    </span>
                                ) : (
                                    "—"
                                )}
                            </td>
                            <td>
                                <GradeBadge
                                    category={comic.grade_category}
                                    cgcGrade={comic.cgc}
                                    grade={comic.grade}
                                />
                            </td>
                            <td className="num-cell">
                                {comic.fmv ? `$${comic.fmv.toLocaleString()}` : "—"}
                            </td>
                            <td className="num-cell">
                                {comic.recommended_ask ? `$${comic.recommended_ask.toLocaleString()}` : "—"}
                            </td>
                            <td className="num-cell" style={{ color: '#888', fontSize: 12 }}>
                                {comic.pc_ungraded ? `$${comic.pc_ungraded.toLocaleString()}` : "—"}
                            </td>
                            <td className="num-cell" style={{ color: '#888', fontSize: 12 }}>
                                {comic.pc_graded ? `$${comic.pc_graded.toLocaleString()}` : "—"}
                            </td>
                            <td className="artist-cell">{comic.artist || "—"}</td>
                            <td className="num-cell" style={{ color: (comic.slab_upside ?? 0) > 100 ? 'var(--gold)' : undefined }}>
                                {comic.slab_upside != null && comic.slab_upside > 0 ? `+$${comic.slab_upside.toLocaleString()}` : "—"}
                            </td>
                            <td className="num-cell">{comic.cgc || "—"}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

