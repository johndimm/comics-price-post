"use client";
import { useState } from "react";
import { GradeCategory } from "@/lib/types";

interface Props {
    marvelId: string;
    comicTitle: string;
    gradeCategory: GradeCategory;
    communityLow: string;
    forSale: string;
    soldPrice: string;
    soldDate: string;
    slabUpside: number | null;
    platforms?: { name: "ebay" | "shortboxed"; url?: string }[];
}

type StepId = "assess" | "community_graded" | "certified" | "post_for_sale" | "sold";

interface Step {
    id: StepId;
    name: string;
    actionLabel: string;
    taskTitle: string;
    description: string;  // shown in the dialog
}

const STEPS: Record<StepId, Step> = {
    assess: {
        id: "assess",
        name: "Assess",
        actionLabel: "Request community grading",
        taskTitle: "Submit to CGC forum for community grading",
        description: "This book currently has only your personal grade. Clicking confirm will create a task to post it to the CGC Comics forum (Please Grade My Comic) for an independent community grade. Community members will evaluate the condition without any bias, giving you a reliable basis for deciding whether to slab it or sell it raw.",
    },
    community_graded: {
        id: "community_graded",
        name: "Community Graded",
        actionLabel: "Request CGC submission",
        taskTitle: "Submit to CGC for grading",
        description: "This book has a community grade and the data shows a significant slab upside — meaning it will likely sell for considerably more as a CGC-certified slab than raw. Clicking confirm will create a task to submit it to CGC for professional grading and encapsulation.",
    },
    certified: {
        id: "certified",
        name: "Certified",
        actionLabel: "Request listing",
        taskTitle: "Post for sale",
        description: "This book is CGC-certified and ready to sell. Clicking confirm will create a task to list it for sale on eBay, Shortboxed, or Heritage Auctions.",
    },
    post_for_sale: {
        id: "post_for_sale",
        name: "Post for Sale",
        actionLabel: "Request listing",
        taskTitle: "Post for sale",
        description: "This book is ready to sell raw. Clicking confirm will create a task to list it for sale on eBay, Shortboxed, or Heritage Auctions.",
    },
    sold: {
        id: "sold",
        name: "Sold",
        actionLabel: "",
        taskTitle: "",
        description: "",
    },
};

// Override community_graded description for low-slab-upside path
const COMMUNITY_GRADED_LOW_SLAB: Partial<Step> = {
    actionLabel: "Request listing",
    taskTitle: "Post for sale (raw)",
    description: "This book has a community grade and the slab upside is low — it's not worth the cost and time to send it to CGC. It's ready to sell raw as-is. Clicking confirm will create a task to list it for sale on eBay, Shortboxed, or Heritage Auctions.",
};

const SLAB_THRESHOLD = 50;

function getCurrentStep(props: Props): StepId {
    if (props.soldPrice || props.soldDate) return "sold";
    if (props.forSale && props.forSale !== "NFS" && props.forSale !== "") return "post_for_sale";
    if (props.gradeCategory === "slabbed") return "certified";
    if (props.communityLow) return "community_graded";
    return "assess";
}

function getPath(currentStep: StepId, slabUpside: number | null): StepId[] {
    const highSlab = (slabUpside ?? 0) >= SLAB_THRESHOLD;
    if (currentStep === "sold") return ["post_for_sale", "sold"];
    if (currentStep === "post_for_sale") return ["post_for_sale", "sold"];
    if (currentStep === "certified") return ["certified", "post_for_sale", "sold"];
    if (currentStep === "community_graded") {
        return highSlab
            ? ["assess", "community_graded", "certified", "post_for_sale", "sold"]
            : ["assess", "community_graded", "post_for_sale", "sold"];
    }
    return ["assess", "community_graded", "certified", "post_for_sale", "sold"];
}

export default function ComicPipeline(props: Props) {
    const [showDialog, setShowDialog] = useState(false);
    const [requested, setRequested] = useState(false);
    const [loading, setLoading] = useState(false);

    const currentStep = getCurrentStep(props);
    const path = getPath(currentStep, props.slabUpside);
    const currentIdx = path.indexOf(currentStep);
    const nextStep = path[currentIdx + 1] ?? null;
    const isClickable = nextStep !== null && currentStep !== "sold";
    const highSlab = (props.slabUpside ?? 0) >= SLAB_THRESHOLD;

    // Get effective step definition (overridden for community_graded low-slab path)
    function getEffectiveStep(stepId: StepId): Step {
        if (stepId === "community_graded" && !highSlab) {
            return { ...STEPS.community_graded, ...COMMUNITY_GRADED_LOW_SLAB } as Step;
        }
        return STEPS[stepId];
    }

    const currentStepDef = getEffectiveStep(currentStep);

    async function confirmRequest() {
        if (loading || !nextStep) return;
        const next = getEffectiveStep(currentStep);
        setLoading(true);
        await fetch("/api/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                type: "grade",
                title: `${next.taskTitle}: ${props.comicTitle}`,
                marvelId: props.marvelId,
                comicTitle: props.comicTitle,
            }),
        });
        setLoading(false);
        setShowDialog(false);
        setRequested(true);
    }

    return (
        <>
            {/* Pipeline bar */}
            <div style={{ display: "flex", alignItems: "center", gap: 0, flexWrap: "wrap" }}>
                {path.map((stepId, idx) => {
                    const step = STEPS[stepId];
                    const isCurrent = idx === currentIdx;
                    const isPast = idx < currentIdx;
                    const isPending = requested && nextStep !== null && stepId === nextStep;

                    let bg = "#111";
                    let border = "#2a2a2a";
                    let textColor = "#777";
                    let subtextColor = "#555";
                    let cursor = "default";

                    if (isPast || (isCurrent && requested)) {
                        bg = "#0f1f0f"; border = "#1a3a1a"; textColor = "#4a8a4a"; subtextColor = "#2a5a2a";
                    } else if (isPending) {
                        bg = "#1a1500"; border = "#a16207"; textColor = "#eab308"; subtextColor = "#a16207";
                    } else if (isCurrent) {
                        bg = "#0a2a1a"; border = "#22c55e"; textColor = "#4ade80"; subtextColor = "#22c55e";
                        if (isClickable) cursor = "pointer";
                    }

                    return (
                        <div key={stepId} style={{ display: "flex", alignItems: "center" }}>
                            {idx > 0 && (
                                <div style={{ color: "#444", fontSize: 16, padding: "0 4px", userSelect: "none" }}>›</div>
                            )}
                            <div
                                onClick={isCurrent && isClickable && !requested ? () => setShowDialog(true) : undefined}
                                style={{
                                    border: `1px solid ${border}`,
                                    background: bg,
                                    borderRadius: 6,
                                    padding: "6px 12px",
                                    cursor,
                                    textAlign: "center",
                                    minWidth: 100,
                                    transition: "all 0.15s",
                                    pointerEvents: isCurrent && requested ? "none" : undefined,
                                    userSelect: "none",
                                }}
                            >
                                <div style={{ fontSize: 11, fontWeight: "bold", color: textColor, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                                    {step.name}
                                </div>
                                {isCurrent && isClickable && !requested && (
                                    <div style={{ fontSize: 10, color: subtextColor, marginTop: 3 }}>
                                        {currentStepDef.actionLabel}
                                    </div>
                                )}
                                {isCurrent && requested && (
                                    <div style={{ fontSize: 10, color: subtextColor, marginTop: 3 }}>done ✓</div>
                                )}
                                {isPending && (
                                    <div style={{ fontSize: 10, color: subtextColor, marginTop: 3 }}>⧖ pending</div>
                                )}
                                {isCurrent && !isClickable && stepId !== "post_for_sale" && stepId !== "sold" && (
                                    <div style={{ fontSize: 10, color: subtextColor, marginTop: 3 }}>● current</div>
                                )}
                                {isCurrent && stepId === "post_for_sale" && (
                                    <div style={{ display: "flex", gap: 4, marginTop: 4, justifyContent: "center", flexWrap: "wrap" }}>
                                        {(props.platforms ?? []).map(p => {
                                            const badgeStyle = {
                                                fontSize: 9, fontWeight: "bold" as const, textTransform: "uppercase" as const,
                                                background: p.name === "ebay" ? "#1a3a5c" : "#1a3a2a",
                                                color: p.name === "ebay" ? "#60a5fa" : "#34d399",
                                                borderRadius: 3, padding: "1px 5px",
                                                textDecoration: "none",
                                            };
                                            return p.url
                                                ? <a key={p.name} href={p.url} target="_blank" rel="noopener noreferrer" style={badgeStyle} onClick={e => e.stopPropagation()}>{p.name}</a>
                                                : <span key={p.name} style={badgeStyle}>{p.name}</span>;
                                        })}
                                        {(props.platforms ?? []).length === 0 && (
                                            <span style={{ fontSize: 10, color: subtextColor }}>● current</span>
                                        )}
                                    </div>
                                )}
                                {isCurrent && stepId === "sold" && (
                                    <div style={{ fontSize: 10, color: subtextColor, marginTop: 3 }}>● current</div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Dialog */}
            {showDialog && (
                <div
                    style={{
                        position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        zIndex: 1000,
                    }}
                    onClick={() => setShowDialog(false)}
                >
                    <div
                        style={{
                            background: "#161616", border: "1px solid #333", borderRadius: 10,
                            padding: "28px 32px", maxWidth: 440, width: "90%",
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                            {STEPS[currentStep].name} → {nextStep ? STEPS[nextStep].name : ""}
                        </div>
                        <div style={{ fontSize: 16, fontWeight: "bold", color: "#eee", marginBottom: 16 }}>
                            {currentStepDef.actionLabel}
                        </div>
                        <div style={{ fontSize: 13, color: "#aaa", lineHeight: 1.6, marginBottom: 24 }}>
                            {currentStepDef.description}
                        </div>
                        <div style={{ fontSize: 12, color: "#666", marginBottom: 20, fontStyle: "italic" }}>
                            A task will be created: &ldquo;{currentStepDef.taskTitle}: {props.comicTitle}&rdquo;
                        </div>
                        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                            <button className="btn" style={{ fontSize: 13, color: "#888" }} onClick={() => setShowDialog(false)}>
                                Cancel
                            </button>
                            <button className="btn" style={{ fontSize: 13, color: "#4ade80" }} onClick={confirmRequest} disabled={loading}>
                                {loading ? "Creating task…" : "Confirm"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
