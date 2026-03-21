"use client";

import { useState, useMemo, useEffect } from "react";
import ComicCard from "@/components/ComicCard";
import ComicTable, { RangeFilter, SortKey } from "@/components/ComicTable";
import { Comic } from "@/lib/types";

type ViewMode = "cards" | "table";
type CategoryFilter = "all" | "slabbed" | "community" | "raw";
type SaleFilter = "all" | "unsold" | "for_sale" | "sold";
type GenreFilter = "Super-hero" | "Military" | "Cowboy" | "Reprints" | "Humor" | "Fantasy" | "Alt" | "all";

interface SavedQuery {
    name: string;
    category: CategoryFilter;
    saleFilter: SaleFilter;
    selectedTitle: string;
    search: string;
    columnFilters: Record<string, string[]>;
    rangeFilters: Record<string, RangeFilter>;
}

const STORAGE_KEY = "comics_saved_queries";
const PAGE_STATE_KEY = "comics_page_state";

function loadQueries(): SavedQuery[] {
    if (typeof window === "undefined") return [];
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    } catch {
        return [];
    }
}

function saveQueries(queries: SavedQuery[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queries));
}

interface CollectionClientProps {
    comics: Comic[];
}

export default function CollectionClient({ comics }: CollectionClientProps) {
    const [view, setView] = useState<ViewMode>("cards");
    const [category, setCategory] = useState<CategoryFilter>("all");
    const [saleFilter, setSaleFilter] = useState<SaleFilter>("all");
    const [genreFilter, setGenreFilter] = useState<GenreFilter>("all");
    const [selectedTitle, setSelectedTitle] = useState<string>("all");
    const [search, setSearch] = useState("");
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [columnFilters, setColumnFilters] = useState<Record<string, Set<string>>>({});
    const [rangeFilters, setRangeFilters] = useState<Record<string, RangeFilter>>({});
    const [titleSortBy, setTitleSortBy] = useState<"count" | "name">("count");
    const [sortKey, setSortKey] = useState<SortKey>("year");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
    const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
    // hydrated: true only after sessionStorage restore is complete — prevents save from overwriting on mount
    const [hydrated, setHydrated] = useState(false);

    // Restore page state from sessionStorage on mount
    useEffect(() => {
        setSavedQueries(loadQueries());
        try {
            const raw = sessionStorage.getItem(PAGE_STATE_KEY);
            if (raw) {
                const s = JSON.parse(raw);
                if (s.view) setView(s.view);
                if (s.category) setCategory(s.category);
                if (s.saleFilter) setSaleFilter(s.saleFilter);
                if (s.selectedTitle) setSelectedTitle(s.selectedTitle);
                if (s.search != null) setSearch(s.search);
                // sortKey/sortDir intentionally not restored — year-asc is the permanent default
                if (s.columnFilters) setColumnFilters(
                    Object.fromEntries(Object.entries(s.columnFilters).map(([k, v]) => [k, new Set(v as string[])]))
                );
                if (s.rangeFilters) setRangeFilters(s.rangeFilters);
                if (s.selectedIds) setSelectedIds(new Set(s.selectedIds as string[]));
                if (s.scrollY) requestAnimationFrame(() => window.scrollTo(0, s.scrollY));
            }
        } catch { /* ignore */ }
        // Mark hydrated — batched with the setState calls above, so save won't run until all state is restored
        setHydrated(true);
    }, []);

    // Save page state to sessionStorage — only after hydration to avoid overwriting with defaults on mount
    useEffect(() => {
        if (!hydrated) return;
        try {
            sessionStorage.setItem(PAGE_STATE_KEY, JSON.stringify({
                view, category, saleFilter, selectedTitle, search,
                sortKey, sortDir,
                columnFilters: Object.fromEntries(Object.entries(columnFilters).map(([k, v]) => [k, Array.from(v)])),
                rangeFilters,
                selectedIds: Array.from(selectedIds),
            }));
        } catch { /* ignore */ }
    }, [hydrated, view, category, saleFilter, selectedTitle, search, sortKey, sortDir, columnFilters, rangeFilters, selectedIds]);

    // Save scroll position directly to sessionStorage (doesn't need a re-render)
    useEffect(() => {
        const onScroll = () => {
            try {
                const raw = sessionStorage.getItem(PAGE_STATE_KEY);
                if (raw) {
                    const s = JSON.parse(raw);
                    s.scrollY = window.scrollY;
                    sessionStorage.setItem(PAGE_STATE_KEY, JSON.stringify(s));
                }
            } catch { /* ignore */ }
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const titlesWithCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        comics.forEach(c => {
            counts[c.title] = (counts[c.title] || 0) + 1;
        });
        return Object.entries(counts)
            .sort((a, b) => titleSortBy === "name" ? a[0].localeCompare(b[0]) : b[1] - a[1])
            .map(([title, count]) => ({ title, count }));
    }, [comics, titleSortBy]);

    const filtered = useMemo(() => {
        return comics.filter((c) => {
            if (genreFilter !== "all" && c.genre !== genreFilter) return false;
            if (category !== "all" && c.grade_category !== category) return false;

            const isSold = c.sold_price && c.sold_price.trim().length > 0;
            const isForSale = !isSold && c.for_sale?.includes("ebay.com");
            const isNFS = !isSold && !isForSale;

            if (saleFilter === "unsold" && isSold) return false;
            if (saleFilter === "for_sale" && !isForSale) return false;
            if (saleFilter === "sold" && !isSold) return false;


            if (selectedTitle !== "all" && c.title !== selectedTitle) return false;

            // Apply generic column filters
            for (const [col, selectedValues] of Object.entries(columnFilters)) {
                if (selectedValues.size === 0) continue;
                const value = String((c as any)[col] ?? "");
                if (!selectedValues.has(value)) return false;
            }

            // Apply range filters
            for (const [col, range] of Object.entries(rangeFilters)) {
                const val = Number((c as any)[col] ?? 0);
                if (range.min != null && val < range.min) return false;
                if (range.max != null && val > range.max) return false;
            }

            if (search) {
                const q = search.toLowerCase();
                const titleMatch = c.title.toLowerCase().includes(q);
                const numMatch = c.number.toString().includes(q);
                const artistMatch = (c.artist ?? "").toLowerCase().includes(q);
                if (!titleMatch && !numMatch && !artistMatch) return false;
            }
            return true;
        });
    }, [comics, category, saleFilter, selectedTitle, columnFilters, rangeFilters, search, genreFilter]);

    const filteredSorted = useMemo(() => {
        function pubDateNum(c: typeof filtered[0]): number {
            // date is MM/DD/YYYY → convert to YYYYMMDD for sorting
            const m = String(c.date ?? "").match(/^(\d{1,2})\/\d{1,2}\/(\d{4})$/);
            if (m) return parseInt(m[2]) * 100 + parseInt(m[1]);
            return (c.year || 0) * 100;
        }
        return [...filtered].sort((a, b) => {
            let av: any = (a as any)[sortKey] ?? "";
            let bv: any = (b as any)[sortKey] ?? "";
            if (sortKey === "year") {
                av = pubDateNum(a); bv = pubDateNum(b);
            } else if (sortKey === "grade" || sortKey === "fmv" || sortKey === "recommended_ask" || sortKey === "slab_upside") {
                av = Number(av) || 0; bv = Number(bv) || 0;
            } else if (sortKey === "number") {
                av = parseInt(String(av), 10) || 0; bv = parseInt(String(bv), 10) || 0;
            } else {
                av = String(av).toLowerCase(); bv = String(bv).toLowerCase();
            }
            const cmp = av < bv ? -1 : av > bv ? 1 : 0;
            const dir = sortDir === "asc" ? 1 : -1;
            if (cmp !== 0) return cmp * dir;
            if (sortKey === "title") return (parseInt(String(a.number), 10) || 0) - (parseInt(String(b.number), 10) || 0);
            return 0;
        });
    }, [filtered, sortKey, sortDir]);

    const fmvTotal = useMemo(() => {
        const source = selectedIds.size > 0
            ? comics.filter(c => selectedIds.has(c.marvel_id))
            : filtered;
        return source.reduce((sum, c) => sum + (c.fmv ?? 0), 0);
    }, [comics, filtered, selectedIds]);

    const counts = useMemo(() => ({
        all: comics.length,
        slabbed: comics.filter((c) => c.grade_category === "slabbed").length,
        community: comics.filter((c) => c.grade_category === "community").length,
        raw: comics.filter((c) => c.grade_category === "raw").length,
        unsold: comics.filter((c) => !c.sold_price?.trim()).length,
        for_sale: comics.filter((c) => !c.sold_price?.trim() && c.for_sale?.includes("ebay.com")).length,
        sold: comics.filter((c) => c.sold_price && c.sold_price.trim().length > 0).length,
    }), [comics]);

    const toggleSelection = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleAllSelection = () => {
        if (selectedIds.size === filtered.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filtered.map(c => c.marvel_id)));
        }
    };

    const handleRangeSelection = (ids: string[]) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            ids.forEach(id => next.add(id));
            return next;
        });
    };

    const handleColumnFilter = (column: string, values: Set<string>) => {
        setColumnFilters(prev => ({ ...prev, [column]: values }));
    };

    const handleRangeFilter = (column: string, range: RangeFilter) => {
        setRangeFilters(prev => ({ ...prev, [column]: range }));
    };

    const handleSortChange = (key: SortKey, dir: "asc" | "desc") => {
        setSortKey(key);
        setSortDir(dir);
    };

    const handleSaveQuery = () => {
        const name = prompt("Name this query:");
        if (!name?.trim()) return;
        const q: SavedQuery = {
            name: name.trim(),
            category,
            saleFilter,
            selectedTitle,
            search,
            columnFilters: Object.fromEntries(
                Object.entries(columnFilters).map(([k, v]) => [k, Array.from(v)])
            ),
            rangeFilters,
        };
        const updated = [...savedQueries.filter(s => s.name !== q.name), q];
        setSavedQueries(updated);
        saveQueries(updated);
    };

    const handleDeleteQuery = (name: string) => {
        const updated = savedQueries.filter(q => q.name !== name);
        setSavedQueries(updated);
        saveQueries(updated);
    };

    const handleRestoreQuery = (q: SavedQuery) => {
        setCategory(q.category);
        setSaleFilter(q.saleFilter);
        setSelectedTitle(q.selectedTitle);
        setSearch(q.search);
        setColumnFilters(
            Object.fromEntries(
                Object.entries(q.columnFilters).map(([k, v]) => [k, new Set(v)])
            )
        );
        setRangeFilters(q.rangeFilters);
    };

    return (
        <main className="page-main">
            {/* Toolbar */}
            <div className="toolbar">
                {/* View Toggle */}
                <div className="toolbar-group">
                    <button
                        className={`btn ${view === "cards" ? "active" : ""}`}
                        onClick={() => setView("cards")}
                    >
                        ⊞ Cards
                    </button>
                    <button
                        className={`btn ${view === "table" ? "active" : ""}`}
                        onClick={() => setView("table")}
                    >
                        ≡ Table
                    </button>
                </div>

                {/* Genre Filter */}
                <div className="toolbar-group">
                    <span className="toolbar-label">Genre</span>
                    {(["Super-hero", "Military", "Cowboy", "Reprints", "Humor", "Fantasy", "Alt", "all"] as GenreFilter[]).map((g) => (
                        <button
                            key={g}
                            className={`btn ${genreFilter === g ? "active" : ""}`}
                            onClick={() => setGenreFilter(g)}
                        >
                            {g === "all" ? "All" : g}
                        </button>
                    ))}
                </div>

                {/* Category Filter */}
                <div className="toolbar-group">
                    <span className="toolbar-label">Grade</span>
                    {(["all", "slabbed", "community", "raw"] as CategoryFilter[]).map((cat) => (
                        <button
                            key={cat}
                            className={`btn ${category === cat
                                ? cat === "slabbed"
                                    ? "active-gold"
                                    : cat === "community"
                                        ? "active-blue"
                                        : "active"
                                : ""
                                }`}
                            onClick={() => setCategory(cat)}
                        >
                            {cat === "all"
                                ? `All (${counts.all})`
                                : cat === "slabbed"
                                    ? `Slabbed (${counts.slabbed})`
                                    : cat === "community"
                                        ? `Community (${counts.community})`
                                        : `Raw (${counts.raw})`}
                        </button>
                    ))}
                </div>

                {/* Sale Filter */}
                <div className="toolbar-group">
                    <span className="toolbar-label">Status</span>
                    {(["all", "unsold", "for_sale", "sold"] as SaleFilter[]).map((sf) => (
                        <button
                            key={sf}
                            className={`btn ${saleFilter === sf ? "active" : ""}`}
                            onClick={() => setSaleFilter(sf)}
                        >
                            {sf === "all"
                                ? "All"
                                : sf === "unsold"
                                    ? `Unsold (${counts.unsold})`
                                    : sf === "for_sale"
                                        ? `For Sale (${counts.for_sale})`
                                        : `Sold (${counts.sold})`}
                        </button>
                    ))}
                </div>

                {/* Sort (cards view) */}
                {view === "cards" && (
                    <div className="toolbar-group">
                        <span className="toolbar-label">Sort</span>
                        {([["year", "Date"], ["title", "Title"], ["fmv", "FMV"], ["grade", "Grade"]] as [SortKey, string][]).map(([key, label]) => (
                            <button
                                key={key}
                                className={`btn ${sortKey === key ? "active" : ""}`}
                                onClick={() => { setSortKey(key); setSortDir(key === sortKey && sortDir === "asc" ? "desc" : "asc"); }}
                            >
                                {label}{sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                            </button>
                        ))}
                    </div>
                )}

                {/* Search */}
                <input
                    className="search-input"
                    type="text"
                    placeholder="Search title, issue, artist…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />

                <div className="selection-summary">
                    {selectedIds.size > 0 && (
                        <span>{selectedIds.size} Selected</span>
                    )}
                    {fmvTotal > 0 && (
                        <span className="selection-fmv">FMV: ${fmvTotal.toLocaleString()}</span>
                    )}
                    {selectedIds.size > 0 && (
                        <span className="selection-clear" onClick={() => setSelectedIds(new Set())}>✕</span>
                    )}
                </div>

                <div className="stat-block">
                    <strong>{filtered.length}</strong> of {comics.length} comics
                </div>

                <button className="btn" onClick={() => {
                    setCategory("all");
                    setSaleFilter("all");
                    setSelectedTitle("all");
                    setSearch("");
                    setColumnFilters({});
                    setRangeFilters({});
                }} title="Clear all filters">
                    Clear
                </button>

                <button className="btn" onClick={handleSaveQuery} title="Save current filters as a named query">
                    + Save Query
                </button>
            </div>

            {savedQueries.length > 0 && (
                <div className="saved-queries-bar">
                    {savedQueries.map(q => (
                        <span key={q.name} className="saved-query-chip">
                            <span onClick={() => handleRestoreQuery(q)}>{q.name}</span>
                            <button onClick={() => handleDeleteQuery(q.name)}>✕</button>
                        </span>
                    ))}
                </div>
            )}

            <div className="main-with-sidebar">
                {/* Title Sidebar */}
                <aside className="title-sidebar">
                    <div className="sidebar-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span>Title</span>
                        <button className="btn-text" style={{ fontSize: 11 }}
                            onClick={() => setTitleSortBy(s => s === "count" ? "name" : "count")}>
                            {titleSortBy === "count" ? "A–Z" : "#"}
                        </button>
                    </div>
                    <div className="sidebar-list">
                        <button
                            className={`sidebar-item ${selectedTitle === "all" ? "active" : ""}`}
                            onClick={() => setSelectedTitle("all")}
                        >
                            All Titles
                        </button>
                        {titlesWithCounts.map(({ title, count }) => (
                            <button
                                key={title}
                                className={`sidebar-item ${selectedTitle === title ? "active" : ""}`}
                                onClick={() => setSelectedTitle(title)}
                            >
                                {title}
                                <span className="sidebar-count">{count}</span>
                            </button>
                        ))}
                    </div>
                </aside>

                {/* Content Area */}
                <div style={{ flex: 1 }}>
                    {view === "cards" ? (
                        <div className="card-grid">
                            {filteredSorted.map((comic) => (
                                <ComicCard key={comic.marvel_id} comic={comic} />
                            ))}
                        </div>
                    ) : (
                        <ComicTable
                            comics={filtered}
                            selectedIds={selectedIds}
                            columnFilters={columnFilters}
                            rangeFilters={rangeFilters}
                            sortKey={sortKey}
                            sortDir={sortDir}
                            onSortChange={handleSortChange}
                            onToggleSelection={toggleSelection}
                            onToggleAll={toggleAllSelection}
                            onSelectRange={handleRangeSelection}
                            onUpdateColumnFilter={handleColumnFilter}
                            onUpdateRangeFilter={handleRangeFilter}
                        />
                    )}
                </div>
            </div>
        </main>
    );
}
