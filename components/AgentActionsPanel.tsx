"use client";

import { useEffect, useState, useCallback } from "react";
import type { AgentAction, AgentActionType } from "@/lib/agent-actions";

const TYPE_LABELS: Record<AgentActionType, string> = {
    submit_heritage:    "Submit to Heritage",
    publish_ebay_draft: "Publish to eBay",
    update_ebay_price:  "Update eBay Price",
    list_shortboxed:    "List on Shortboxed",
    needs_photos:       "Needs Photos",
};

const TYPE_COLORS: Record<AgentActionType, string> = {
    submit_heritage:    "#fbbf24",
    publish_ebay_draft: "#34d399",
    update_ebay_price:  "#f59e0b",
    list_shortboxed:    "#2dd4bf",
    needs_photos:       "#888888",
};

const TYPE_BG: Record<AgentActionType, string> = {
    submit_heritage:    "#1a1500",
    publish_ebay_draft: "#0a1a12",
    update_ebay_price:  "#1a1200",
    list_shortboxed:    "#071a1a",
    needs_photos:       "#111111",
};

const TYPE_BORDER: Record<AgentActionType, string> = {
    submit_heritage:    "#78350f",
    publish_ebay_draft: "#065f46",
    update_ebay_price:  "#92400e",
    list_shortboxed:    "#115e59",
    needs_photos:       "#333333",
};

function fmt(n: number | null | undefined) {
    if (!n) return null;
    return "$" + n.toLocaleString();
}

function ActionButton({
    action,
    onApprove,
    onDismiss,
}: {
    action: AgentAction;
    onApprove: (id: string, extraFetch?: () => Promise<void>) => void;
    onDismiss: (id: string) => void;
}) {
    const [busy, setBusy] = useState(false);
    const color = TYPE_COLORS[action.type];

    const handlePublish = async () => {
        setBusy(true);
        try {
            const res = await fetch(`/api/agent/publish/${action.id}`, { method: "POST" });
            if (!res.ok) {
                const err = await res.json();
                alert(`Publish failed: ${err.error ?? "unknown error"}`);
                return;
            }
            onApprove(action.id);
        } finally {
            setBusy(false);
        }
    };

    const handleApprove = async () => {
        setBusy(true);
        try {
            await fetch(`/api/agent/actions/${action.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "approved" }),
            });
            onApprove(action.id);
        } finally {
            setBusy(false);
        }
    };

    const handleDismiss = async () => {
        setBusy(true);
        try {
            await fetch(`/api/agent/actions/${action.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "dismissed" }),
            });
            onDismiss(action.id);
        } finally {
            setBusy(false);
        }
    };

    const btnStyle: React.CSSProperties = {
        padding: "4px 12px",
        borderRadius: 4,
        border: "none",
        cursor: busy ? "not-allowed" : "pointer",
        fontSize: 12,
        fontWeight: "bold",
        opacity: busy ? 0.6 : 1,
        color: "#000",
        background: color,
        whiteSpace: "nowrap",
    };

    const dismissStyle: React.CSSProperties = {
        padding: "4px 10px",
        borderRadius: 4,
        border: "1px solid #333",
        cursor: busy ? "not-allowed" : "pointer",
        fontSize: 11,
        background: "transparent",
        color: "#666",
        whiteSpace: "nowrap",
    };

    const d = action.details;

    return (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
            {action.type === "publish_ebay_draft" && (
                <button style={btnStyle} onClick={handlePublish} disabled={busy}>
                    Publish to eBay
                </button>
            )}
            {action.type === "update_ebay_price" && (
                <button style={btnStyle} onClick={handleApprove} disabled={busy}>
                    Update Price to {fmt(d.suggestedPrice)}
                </button>
            )}
            {action.type === "list_shortboxed" && (
                <button style={btnStyle} onClick={handleApprove} disabled={busy}>
                    Mark Listed
                </button>
            )}
            {action.type === "submit_heritage" && (
                <button style={btnStyle} onClick={handleApprove} disabled={busy}>
                    Mark Submitted
                </button>
            )}
            {action.type === "needs_photos" && (
                <span style={{ fontSize: 12, color: "#888" }}>Take Photos</span>
            )}
            <button style={dismissStyle} onClick={handleDismiss} disabled={busy}>
                Dismiss
            </button>
        </div>
    );
}

function ActionRow({
    action,
    onApprove,
    onDismiss,
    isLast,
}: {
    action: AgentAction;
    onApprove: (id: string) => void;
    onDismiss: (id: string) => void;
    isLast: boolean;
}) {
    const d = action.details;
    return (
        <div style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "10px 20px",
            borderBottom: isLast ? "none" : "1px solid #1a1a1a",
        }}>
            <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 13, color: "#ddd" }}>
                    {action.comicTitle}
                </span>
                {d.cgc && (
                    <span style={{ fontSize: 12, color: "#888", marginLeft: 10 }}>
                        CGC {typeof d.grade === "number" ? d.grade.toFixed(1) : d.grade}
                    </span>
                )}
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 12, color: "#888", whiteSpace: "nowrap" }}>
                {d.fmv > 0 && (
                    <span style={{ color: "#e2c97e" }}>{fmt(d.fmv)} FMV</span>
                )}
                {d.recommended_ask > 0 && (
                    <span>ask {fmt(d.recommended_ask)}</span>
                )}
                {d.currentPrice > 0 && (
                    <span>listed {fmt(d.currentPrice)}</span>
                )}
            </div>
            <ActionButton action={action} onApprove={onApprove} onDismiss={onDismiss} />
        </div>
    );
}

type GroupedActions = { type: AgentActionType; actions: AgentAction[] }[];

function groupByType(actions: AgentAction[]): GroupedActions {
    const order: AgentActionType[] = [
        "submit_heritage",
        "publish_ebay_draft",
        "update_ebay_price",
        "list_shortboxed",
        "needs_photos",
    ];
    const map = new Map<AgentActionType, AgentAction[]>();
    for (const a of actions) {
        if (!map.has(a.type)) map.set(a.type, []);
        map.get(a.type)!.push(a);
    }
    return order
        .filter(t => map.has(t))
        .map(t => ({ type: t, actions: map.get(t)! }));
}

export default function AgentActionsPanel() {
    const [actions, setActions] = useState<AgentAction[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchActions = useCallback(async () => {
        try {
            const res = await fetch("/api/agent/actions");
            const data: AgentAction[] = await res.json();
            setActions(data.filter(a => a.status === "pending"));
        } catch {
            // fail silently
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchActions(); }, [fetchActions]);

    const handleApprove = useCallback((id: string) => {
        setActions(prev => prev.filter(a => a.id !== id));
    }, []);

    const handleDismiss = useCallback((id: string) => {
        setActions(prev => prev.filter(a => a.id !== id));
    }, []);

    if (loading) {
        return (
            <div style={{ padding: "20px", color: "#555", fontSize: 13 }}>
                Loading agent actions...
            </div>
        );
    }

    const pending = actions.filter(a => a.status === "pending");

    return (
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 16px 24px" }}>
            <div style={{
                border: "1px solid #2a2a2a",
                background: "#111",
                borderRadius: 8,
                overflow: "hidden",
            }}>
                {/* Panel header */}
                <div style={{
                    padding: "12px 20px",
                    borderBottom: "1px solid #222",
                    display: "flex",
                    alignItems: "baseline",
                    gap: 12,
                    background: "#161616",
                }}>
                    <span style={{ fontWeight: "bold", fontSize: 14, color: "#ddd" }}>
                        Agent Actions
                    </span>
                    <span style={{ fontSize: 12, color: "#555" }}>
                        Recommendations from the automated agent
                    </span>
                    <span style={{
                        marginLeft: "auto",
                        fontSize: 12,
                        fontWeight: "bold",
                        color: pending.length > 0 ? "#f59e0b" : "#444",
                    }}>
                        {pending.length}
                    </span>
                </div>

                {pending.length === 0 ? (
                    <div style={{ padding: "20px", color: "#555", fontSize: 13 }}>
                        No pending actions
                    </div>
                ) : (
                    groupByType(pending).map(({ type, actions: group }) => (
                        <div key={type} style={{
                            borderBottom: "1px solid #1e1e1e",
                        }}>
                            {/* Type sub-header */}
                            <div style={{
                                padding: "8px 20px",
                                background: TYPE_BG[type],
                                borderLeft: `3px solid ${TYPE_COLORS[type]}`,
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                            }}>
                                <span style={{ fontSize: 12, fontWeight: "bold", color: TYPE_COLORS[type] }}>
                                    {TYPE_LABELS[type]}
                                </span>
                                <span style={{ fontSize: 11, color: "#555" }}>
                                    {group.length} comic{group.length !== 1 ? "s" : ""}
                                </span>
                            </div>
                            {group.map((action, i) => (
                                <ActionRow
                                    key={action.id}
                                    action={action}
                                    onApprove={handleApprove}
                                    onDismiss={handleDismiss}
                                    isLast={i === group.length - 1}
                                />
                            ))}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
