"use client";

import { useState } from "react";
import EvidenceCharts from "@/components/EvidenceCharts";
import ListingGrid from "@/components/ListingGrid";
import { eBayListing } from "@/lib/db";

interface EvidenceClientProps {
    soldByTime: any[];
    soldByGrade: any[];
    askingByTime: any[];
    askingByGrade: any[];
    marketValue?: number;
    fmvLow?: number;
    fmvHigh?: number;
    recommendedAsk?: number;
    soldDotY?: number;
    askingDotY?: number;
    fmvMethod?: string;
    fmvSource?: string;
    currentGrade: number;
    listings: eBayListing[];
    gradeCurve?: { sold: { slabbed: any[]; raw: any[] }; asking: { slabbed: any[]; raw: any[] } };
}

export default function EvidenceClient({
    soldByTime,
    soldByGrade,
    askingByTime,
    askingByGrade,
    marketValue,
    fmvLow,
    fmvHigh,
    recommendedAsk,
    fmvMethod,
    fmvSource,
    currentGrade,
    listings,
    gradeCurve,
}: EvidenceClientProps) {
    const [hoveredId, setHoveredId] = useState<string | null>(null);
    const [scrollToId, setScrollToId] = useState<string | null>(null);

    const fmvLabel = fmvSource === 'asking'
        ? 'Estimated FMV (Based on Asking Prices)'
        : 'Estimated Fair Market Value';

    return (
        <>
            {/* FMV Banner */}
            <div className="fmv-block">
                <div className="fmv-prices-row">
                    <div>
                        <div className="fmv-label">{fmvLabel}</div>
                        {marketValue != null ? (
                            <div className="fmv-value">
                                ${marketValue.toLocaleString()}
                                {fmvLow != null && fmvHigh != null && fmvLow !== fmvHigh && (
                                    <span style={{ fontSize: 16, color: '#aaa', marginLeft: 8 }}>
                                        (${fmvLow.toLocaleString()}–${fmvHigh.toLocaleString()})
                                    </span>
                                )}
                            </div>
                        ) : (
                            <div className="fmv-value" style={{ fontSize: 28, paddingTop: 8 }}>No data yet</div>
                        )}
                    </div>
                </div>
                {fmvMethod && <div className="fmv-explanation">{fmvMethod}</div>}
                <div className="fmv-explanation" style={{ marginTop: 6, fontStyle: "italic" }}>
                    FMV is calculated as the median of recorded sales for comparable grades (+/- 1.0) including eBay and spreadsheet data.
                </div>
            </div>

            <EvidenceCharts
                soldByTime={soldByTime}
                soldByGrade={soldByGrade}
                askingByTime={askingByTime}
                askingByGrade={askingByGrade}
                marketValue={marketValue}
                recommendedAsk={recommendedAsk}
                currentGrade={currentGrade}
                highlightedId={hoveredId}
                onHoverItem={setHoveredId}
                onClickItem={(id) => { setHoveredId(id); setScrollToId(null); setTimeout(() => setScrollToId(id), 0); }}
                gradeCurve={gradeCurve}
            />

            <ListingGrid
                listings={listings}
                highlightedId={hoveredId}
                scrollToId={scrollToId}
                onHoverRow={setHoveredId}
            />
        </>
    );
}
