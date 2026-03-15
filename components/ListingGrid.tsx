"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { eBayListing } from "@/lib/db";

type SortKey = "type" | "price" | "grade" | "sale_date" | "is_slabbed";
type RangeFilter = { min?: number; max?: number };

// ── Module-level filter components ──────────────────────────────────────────

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
        <div className="filter-dropdown" onClick={(e) => e.stopPropagation()}>
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
        <div className="filter-dropdown" onClick={(e) => e.stopPropagation()}>
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

// ── Main component ───────────────────────────────────────────────────────────

interface ListingGridProps {
    listings: eBayListing[];
    highlightedId: string | null;
    scrollToId?: string | null;
    onHoverRow: (id: string | null) => void;
}

const RANGE_COLS = new Set<SortKey>(["price", "grade"]);

export default function ListingGrid({ listings, highlightedId, scrollToId, onHoverRow }: ListingGridProps) {
    const [sortKey, setSortKey] = useState<SortKey>("sale_date");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
    const [activeFilterCol, setActiveFilterCol] = useState<string | null>(null);
    const [rangeFilters, setRangeFilters] = useState<Record<string, RangeFilter>>({});
    const [columnFilters, setColumnFilters] = useState<Record<string, Set<string>>>({});
    const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());

    useEffect(() => {
        if (!scrollToId) return;
        const el = rowRefs.current.get(scrollToId);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, [scrollToId]);

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [lastClickedId, setLastClickedId] = useState<string | null>(null);
    const [typeFilter, setTypeFilter] = useState<"all" | "sold" | "asking">("all");

    function handleSort(key: SortKey) {
        if (key === sortKey) setSortDir(d => d === "asc" ? "desc" : "asc");
        else { setSortKey(key); setSortDir("asc"); }
    }

    const arrow = (key: SortKey) => sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : " ⬍";

    function updateRangeFilter(col: string, range: RangeFilter) {
        setRangeFilters(prev => ({ ...prev, [col]: range }));
    }

    function updateColumnFilter(col: string, vals: Set<string>) {
        setColumnFilters(prev => ({ ...prev, [col]: vals }));
    }

    const sorted = useMemo(() => {
        let filtered = typeFilter === "all" ? listings : listings.filter(l => l.type === typeFilter);

        // Apply range filters
        const priceRange = rangeFilters["price"];
        if (priceRange?.min != null) filtered = filtered.filter(l => l.price >= priceRange.min!);
        if (priceRange?.max != null) filtered = filtered.filter(l => l.price <= priceRange.max!);

        const gradeRange = rangeFilters["grade"];
        if (gradeRange?.min != null) filtered = filtered.filter(l => (l.grade ?? 0) >= gradeRange.min!);
        if (gradeRange?.max != null) filtered = filtered.filter(l => (l.grade ?? 0) <= gradeRange.max!);

        // Apply checkbox filters for is_slabbed
        const slabFilter = columnFilters["is_slabbed"];
        if (slabFilter && slabFilter.size > 0) {
            filtered = filtered.filter(l => slabFilter.has(l.is_slabbed ? "Yes" : "No"));
        }

        return [...filtered].sort((a, b) => {
            let av: any = a[sortKey] ?? "";
            let bv: any = b[sortKey] ?? "";
            if (sortKey === "price" || sortKey === "grade" || sortKey === "is_slabbed") {
                av = Number(av) || 0;
                bv = Number(bv) || 0;
            } else {
                av = String(av).toLowerCase();
                bv = String(bv).toLowerCase();
            }
            if (av < bv) return sortDir === "asc" ? -1 : 1;
            if (av > bv) return sortDir === "asc" ? 1 : -1;
            return 0;
        });
    }, [listings, sortKey, sortDir, typeFilter, rangeFilters, columnFilters]);

    const allSelected = sorted.length > 0 && selectedIds.size === sorted.length;

    function toggleAll() {
        if (allSelected) setSelectedIds(new Set());
        else setSelectedIds(new Set(sorted.map(l => l.item_id)));
    }

    function handleCheckbox(e: React.MouseEvent, id: string) {
        e.stopPropagation();
        if (e.shiftKey && lastClickedId) {
            const cur = sorted.findIndex(l => l.item_id === id);
            const last = sorted.findIndex(l => l.item_id === lastClickedId);
            if (cur !== -1 && last !== -1) {
                const start = Math.min(cur, last);
                const end = Math.max(cur, last);
                setSelectedIds(prev => {
                    const next = new Set(prev);
                    sorted.slice(start, end + 1).forEach(l => next.add(l.item_id));
                    return next;
                });
            }
        } else {
            setSelectedIds(prev => {
                const next = new Set(prev);
                next.has(id) ? next.delete(id) : next.add(id);
                return next;
            });
        }
        setLastClickedId(id);
    }

    const renderHeader = (label: string, key: SortKey, filterable = false) => {
        if (!filterable) {
            return (
                <th className="sortable-header" style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort(key)}>
                    {label}{arrow(key)}
                </th>
            );
        }

        const isNumeric = RANGE_COLS.has(key);
        const isActive = isNumeric
            ? (rangeFilters[key]?.min != null || rangeFilters[key]?.max != null)
            : (columnFilters[key]?.size || 0) > 0;
        const isOpen = activeFilterCol === key;

        const uniqueValues = isNumeric ? [] : key === "is_slabbed"
            ? ["Yes", "No"]
            : Array.from(new Set(listings.map(l => String((l as any)[key] ?? "")))).sort();

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
                            onApply={(min, max) => updateRangeFilter(key, { min, max })}
                            onClear={() => updateRangeFilter(key, {})}
                            onClose={() => setActiveFilterCol(null)}
                        />
                    )}
                    {isOpen && !isNumeric && (
                        <CheckboxFilterDropdown
                            key={key}
                            uniqueValues={uniqueValues}
                            selected={columnFilters[key] || new Set()}
                            onUpdate={(vals) => updateColumnFilter(key, vals)}
                            onClose={() => setActiveFilterCol(null)}
                        />
                    )}
                </div>
            </th>
        );
    };

    const soldCount = listings.filter(l => l.type === "sold").length;
    const askCount = listings.filter(l => l.type === "asking").length;

    return (
        <div className="listing-grid-container">
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
                <h3 style={{ margin: 0 }}>eBay Source Data</h3>
                <div className="toolbar-group">
                    {(["all", "sold", "asking"] as const).map(f => (
                        <button key={f} className={`btn ${typeFilter === f ? "active" : ""}`} onClick={() => setTypeFilter(f)}>
                            {f === "all" ? `All (${listings.length})` : f === "sold" ? `Sold (${soldCount})` : `Asking (${askCount})`}
                        </button>
                    ))}
                </div>
                {selectedIds.size > 0 && (
                    <div className="selection-summary">
                        <span>{selectedIds.size} selected</span>
                        <span className="selection-clear" onClick={() => setSelectedIds(new Set())}>✕</span>
                    </div>
                )}
            </div>
            <div className="table-wrapper">
                <table className="comic-table">
                    <thead>
                        <tr>
                            <th className="selection-cell">
                                <input type="checkbox" className="custom-checkbox" checked={allSelected} onChange={toggleAll} />
                            </th>
                            {renderHeader("Type", "type")}
                            {renderHeader("Price", "price", true)}
                            {renderHeader("Grade", "grade", true)}
                            {renderHeader("Date", "sale_date")}
                            {renderHeader("Slab", "is_slabbed", true)}
                            <th>Title</th>
                            <th>Link</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map((l) => (
                            <tr
                                key={l.item_id}
                                ref={el => { if (el) rowRefs.current.set(l.item_id, el); else rowRefs.current.delete(l.item_id); }}
                                className={[
                                    selectedIds.has(l.item_id) ? "selected" : "",
                                    highlightedId === l.item_id ? "selected" : "",
                                ].filter(Boolean).join(" ")}
                                onMouseEnter={() => onHoverRow(l.item_id)}
                                onMouseLeave={() => onHoverRow(null)}
                                onClick={() => {
                                    setSelectedIds(prev => {
                                        const next = new Set(prev);
                                        next.has(l.item_id) ? next.delete(l.item_id) : next.add(l.item_id);
                                        return next;
                                    });
                                    setLastClickedId(l.item_id);
                                }}
                            >
                                <td className="selection-cell" onClick={e => handleCheckbox(e, l.item_id)}>
                                    <input type="checkbox" className="custom-checkbox"
                                        checked={selectedIds.has(l.item_id)}
                                        onChange={() => {}} />
                                </td>
                                <td>
                                    <span className={`status-badge ${l.type === "sold" ? "status-sold" : "for-sale"}`}>
                                        {l.type}
                                    </span>
                                </td>
                                <td className="num-cell">${l.price.toLocaleString()}</td>
                                <td className="num-cell">{l.grade?.toFixed(1) || "—"}</td>
                                <td className="artist-cell">
                                    {l.sale_date ? new Date(l.sale_date).toLocaleDateString() : new Date(l.synced_at).toLocaleDateString()}
                                </td>
                                <td className="num-cell">{l.is_slabbed ? "Yes" : "No"}</td>
                                <td className="artist-cell" title={l.raw_title || ""}>
                                    {l.raw_title ? (l.raw_title.length > 55 ? l.raw_title.substring(0, 55) + "…" : l.raw_title) : "—"}
                                </td>
                                <td>
                                    {l.listing_url && (
                                        <a href={l.listing_url} target="_blank" rel="noopener noreferrer"
                                            className="table-link" onClick={e => e.stopPropagation()}>
                                            View
                                        </a>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
