"use client";

import { useCallback, useRef } from "react";
import {
    ResponsiveContainer,
    ScatterChart,
    Scatter,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ReferenceDot,
    ReferenceLine,
} from "recharts";

interface ChartPoint {
    x: number;
    y: number;
    type: "slabbed" | "raw";
    id: string;
    grade?: number | null;
    date?: string | null;
}


const TOOLTIP_STYLE = {
    background: "#151828",
    border: "1px solid #2c3150",
    borderRadius: 6,
    fontSize: 12,
    padding: "8px 12px",
    color: "#e8e9f0",
    lineHeight: "1.8",
};

function DotTooltip({ active, payload }: any) {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload as ChartPoint;
    if (!d) return null;
    const dateStr = d.date
        ? new Date(d.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
        : null;
    return (
        <div style={TOOLTIP_STYLE}>
            <div><strong style={{ color: "#f5a623" }}>${d.y.toLocaleString()}</strong></div>
            <div>Grade: {d.grade != null ? d.grade.toFixed(1) : '—'}</div>
            <div>Date: {dateStr ?? '—'}</div>
        </div>
    );
}

interface EvidenceChartsProps {
    soldByTime: ChartPoint[];
    soldByGrade: ChartPoint[];
    askingByTime: ChartPoint[];
    askingByGrade: ChartPoint[];
    marketValue?: number;
    recommendedAsk?: number;
    currentGrade?: number;
    highlightedId?: string | null;
    onHoverItem: (id: string | null) => void;
    onClickItem?: (id: string) => void;
    gradeCurve?: {
        sold: { slabbed: { x: number; y: number }[]; raw: { x: number; y: number }[] };
        asking: { slabbed: { x: number; y: number }[]; raw: { x: number; y: number }[] };
    };
}


const SLABBED_COLOR = "#f5a623";
const RAW_COLOR = "#4a90d9";
const GRID_COLOR = "rgba(44,49,80,0.6)";
const AXIS_COLOR = "#5a5f7a";

function hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha.toFixed(2)})`;
}

function gradeDeltaColor(grade: number | null | undefined, currentGrade: number | undefined, isSlabbed: boolean): string {
    const base = isSlabbed ? SLABBED_COLOR : RAW_COLOR;
    if (grade == null || currentGrade == null) return base;
    const delta = Math.min(Math.abs(grade - currentGrade), 1.0);
    const opacity = 1.0 - delta * 0.72; // 0 delta → 1.0 opacity, 1.0 delta → 0.28 opacity
    return hexToRgba(base, opacity);
}

function EmptyChart({ label }: { label: string }) {
    return (
        <div className="chart-empty">
            No {label} data yet — will populate from eBay in Phase 2
        </div>
    );
}

function ChartLegend() {
    return (
        <div className="chart-legend">
            <span>
                <span className="chart-legend-dot" style={{ background: SLABBED_COLOR }} />
                Slabbed
            </span>
            <span>
                <span className="chart-legend-dot" style={{ background: RAW_COLOR }} />
                Raw
            </span>
        </div>
    );
}

function TimeChartLegend({ currentGrade }: { currentGrade?: number }) {
    const deltas = [0, 0.5, 1.0];
    const gr = currentGrade?.toFixed(1) ?? '—';
    return (
        <div className="chart-legend" style={{ gap: 16, flexWrap: 'wrap' }}>
            <span style={{ color: '#5a5f7a', fontSize: 11, marginRight: 4 }}>
                Gr {gr} →±1.0:
            </span>
            {(['slabbed', 'raw'] as const).map(kind => (
                deltas.map(delta => (
                    <span key={`${kind}-${delta}`} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <span className="chart-legend-dot" style={{
                            background: hexToRgba(kind === 'slabbed' ? SLABBED_COLOR : RAW_COLOR, 1.0 - delta * 0.72)
                        }} />
                        {delta === 0 && <span style={{ fontSize: 10, color: '#5a5f7a' }}>{kind === 'slabbed' ? 'Slab' : 'Raw'}</span>}
                    </span>
                ))
            ))}
        </div>
    );
}

function evalCurvePoints(pts: { x: number; y: number }[], grade: number): number | null {
    if (!pts || pts.length < 2) return null;
    const sorted = [...pts].sort((a, b) => a.x - b.x);
    if (grade < sorted[0].x - 1 || grade > sorted[sorted.length - 1].x + 1) return null;
    if (grade <= sorted[0].x) return sorted[0].y;
    if (grade >= sorted[sorted.length - 1].x) return sorted[sorted.length - 1].y;
    for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i].x <= grade && grade <= sorted[i + 1].x) {
            const t = (grade - sorted[i].x) / (sorted[i + 1].x - sorted[i].x);
            return Math.round(sorted[i].y + t * (sorted[i + 1].y - sorted[i].y));
        }
    }
    return null;
}

export default function EvidenceCharts({
    soldByTime,
    soldByGrade,
    askingByTime,
    askingByGrade,
    marketValue,
    recommendedAsk,
    currentGrade,
    highlightedId,
    onHoverItem,
    onClickItem,
    gradeCurve,
}: EvidenceChartsProps) {
    const hasData = (pts: ChartPoint[]) => pts.length > 0;
    const tooltipRef = useRef<HTMLDivElement>(null);

    // Position reference dots ON the curve at currentGrade
    const soldDotY = currentGrade != null
        ? (evalCurvePoints(gradeCurve?.sold.slabbed ?? [], currentGrade) ??
           evalCurvePoints(gradeCurve?.sold.raw ?? [], currentGrade) ??
           marketValue)
        : marketValue;
    const askingDotY = currentGrade != null
        ? (evalCurvePoints(gradeCurve?.asking.slabbed ?? [], currentGrade) ??
           evalCurvePoints(gradeCurve?.asking.raw ?? [], currentGrade) ??
           recommendedAsk)
        : recommendedAsk;

    // Stable shape — useCallback with no deps so recharts never remounts the dot
    const DotShape = useCallback(({ cx, cy }: any) => (
        <g
            style={{ cursor: 'pointer' }}
            onMouseEnter={(e) => {
                const el = tooltipRef.current;
                if (el) { el.style.display = 'block'; el.style.top = `${e.clientY - 90}px`; el.style.left = `${e.clientX + 14}px`; }
            }}
            onMouseMove={(e) => {
                const el = tooltipRef.current;
                if (el) { el.style.top = `${e.clientY - 90}px`; el.style.left = `${e.clientX + 14}px`; }
            }}
            onMouseLeave={() => { if (tooltipRef.current) tooltipRef.current.style.display = 'none'; }}
        >
            <circle cx={cx} cy={cy} r={8} fill="#000" stroke={SLABBED_COLOR} strokeWidth={2} />
        </g>
    ), []); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className="evidence-charts">
            {/* Tooltip — always in DOM, shown/hidden via ref (no re-render on hover) */}
            <div ref={tooltipRef} style={{
                display: 'none',
                position: 'fixed',
                zIndex: 9999,
                background: '#151828',
                border: '1px solid #2c3150',
                borderRadius: 6,
                padding: '8px 12px',
                pointerEvents: 'none',
                lineHeight: '1.8',
                fontSize: 12,
                color: '#e8e9f0',
                minWidth: 140,
            }}>
                    <div style={{ color: '#9a9fb8' }}>Grade {currentGrade?.toFixed(1)}</div>
                    <div style={{ color: SLABBED_COLOR, fontWeight: 'bold', fontSize: 13 }}>
                        {marketValue != null ? `FMV $${marketValue.toLocaleString()}` : 'FMV —'}
                    </div>
                    <div style={{ color: RAW_COLOR }}>
                        {recommendedAsk != null ? `Ask $${recommendedAsk.toLocaleString()}` : 'Ask —'}
                    </div>
            </div>

            {/* Row 1: Sold charts */}
            <div className="chart-row">
                <div className="chart-card">
                    <div className="chart-title">Sold Price / Time</div>
                    {hasData(soldByTime) ? (
                        <>
                            <ResponsiveContainer width="100%" height={180}>
                                <ScatterChart>
                                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                                    <XAxis
                                        type="number"
                                        domain={['auto', 'auto']}
                                        dataKey="x"
                                        name="Date"
                                        tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                                        stroke={GRID_COLOR}
                                        tickFormatter={(v) => new Date(v).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })}
                                    />
                                    <YAxis
                                        dataKey="y"
                                        name="Price"
                                        tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                                        stroke={GRID_COLOR}
                                        tickFormatter={(v) => `$${v}`}
                                    />
                                    <Tooltip content={<DotTooltip />} />
                                    <Scatter
                                        data={soldByTime
                                            .filter(p => currentGrade == null || p.grade == null || Math.abs(p.grade - currentGrade) <= 1.0)
                                            .map(p => ({ ...p, dotColor: gradeDeltaColor(p.grade, currentGrade, p.type === 'slabbed') }))}
                                        onMouseEnter={(data: any) => onHoverItem(data.id)}
                                        onMouseLeave={() => onHoverItem(null)}
                                        onClick={(data: any) => onClickItem?.(data.id)}
                                        shape={(props: any) => (
                                            <circle cx={props.cx} cy={props.cy} r={highlightedId === props.id ? 7 : 4} fill={props.dotColor} style={{ cursor: 'pointer' }} />
                                        )}
                                    />
                                    {marketValue !== undefined && (
                                        <ReferenceLine
                                            y={marketValue}
                                            stroke={SLABBED_COLOR}
                                            strokeDasharray="4 3"
                                            strokeOpacity={0.5}
                                            label={{ value: `FMV $${marketValue.toLocaleString()}`, fill: SLABBED_COLOR, fontSize: 10, position: "insideTopLeft" }}
                                        />
                                    )}
                                </ScatterChart>
                            </ResponsiveContainer>
                            <TimeChartLegend currentGrade={currentGrade} />
                        </>
                    ) : (
                        <EmptyChart label="sold-by-time" />
                    )}
                </div>

                <div className="chart-card">
                    <div className="chart-title">Sold Price / Grade</div>
                    {hasData(soldByGrade) ? (
                        <>
                            <ResponsiveContainer width="100%" height={180}>
                                <ScatterChart>
                                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                                    <XAxis
                                        type="number"
                                        domain={[0, 10]}
                                        dataKey="x"
                                        name="Grade"
                                        tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                                        stroke={GRID_COLOR}
                                    />
                                    <YAxis
                                        dataKey="y"
                                        name="Price"
                                        tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                                        stroke={GRID_COLOR}
                                        tickFormatter={(v) => `$${v}`}
                                    />
                                    <Tooltip content={<DotTooltip />} />
                                    <Scatter
                                        data={soldByGrade.filter((p) => p.type === "slabbed")}
                                        fill={SLABBED_COLOR}
                                        opacity={0.8}
                                    />
                                    <Scatter
                                        data={soldByGrade.filter((p) => p.type === "raw")}
                                        fill={RAW_COLOR}
                                        opacity={0.8}
                                    />
                                    {gradeCurve?.sold.slabbed && gradeCurve.sold.slabbed.length > 1 && (
                                        <Scatter
                                            data={gradeCurve.sold.slabbed}
                                            fill={SLABBED_COLOR}
                                            opacity={0.8}
                                            line
                                            lineType="joint"
                                            lineJointType="monotone"
                                            shape={(props: any) => <circle cx={props.cx} cy={props.cy} r={2} fill={SLABBED_COLOR} opacity={0.9} />}
                                        />
                                    )}
                                    {gradeCurve?.sold.raw && gradeCurve.sold.raw.length > 1 && (
                                        <Scatter
                                            data={gradeCurve.sold.raw}
                                            fill={RAW_COLOR}
                                            opacity={0.8}
                                            line
                                            lineType="joint"
                                            lineJointType="monotone"
                                            shape={(props: any) => <circle cx={props.cx} cy={props.cy} r={2} fill={RAW_COLOR} opacity={0.9} />}
                                        />
                                    )}
                                    {soldDotY !== undefined && currentGrade !== undefined && (
                                        <ReferenceDot
                                            x={currentGrade}
                                            y={soldDotY}
                                            shape={DotShape}
                                        />
                                    )}
                                </ScatterChart>
                            </ResponsiveContainer>
                            <ChartLegend />
                        </>
                    ) : (
                        <EmptyChart label="sold-by-grade" />
                    )}
                </div>
            </div>

            {/* Row 2: Asking charts */}
            <div className="chart-row">
                <div className="chart-card">
                    <div className="chart-title">Asking Price / Time</div>
                    {hasData(askingByTime) ? (
                        <>
                            <ResponsiveContainer width="100%" height={180}>
                                <ScatterChart>
                                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                                    <XAxis
                                        type="number"
                                        domain={['auto', 'auto']}
                                        dataKey="x"
                                        name="Date"
                                        tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                                        stroke={GRID_COLOR}
                                        tickFormatter={(v) => new Date(v).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })}
                                    />
                                    <YAxis
                                        dataKey="y"
                                        name="Price"
                                        tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                                        stroke={GRID_COLOR}
                                        tickFormatter={(v) => `$${v}`}
                                    />
                                    <Tooltip content={<DotTooltip />} />
                                    <Scatter
                                        data={askingByTime
                                            .filter(p => currentGrade == null || p.grade == null || Math.abs(p.grade - currentGrade) <= 1.0)
                                            .map(p => ({ ...p, dotColor: gradeDeltaColor(p.grade, currentGrade, p.type === 'slabbed') }))}
                                        onMouseEnter={(data: any) => onHoverItem(data.id)}
                                        onMouseLeave={() => onHoverItem(null)}
                                        onClick={(data: any) => onClickItem?.(data.id)}
                                        shape={(props: any) => (
                                            <circle cx={props.cx} cy={props.cy} r={highlightedId === props.id ? 7 : 4} fill={props.dotColor} style={{ cursor: 'pointer' }} />
                                        )}
                                    />
                                    {recommendedAsk !== undefined && (
                                        <ReferenceLine
                                            y={recommendedAsk}
                                            stroke={SLABBED_COLOR}
                                            strokeDasharray="4 3"
                                            strokeOpacity={0.5}
                                            label={{ value: `Ask $${recommendedAsk.toLocaleString()}`, fill: SLABBED_COLOR, fontSize: 10, position: "insideTopLeft" }}
                                        />
                                    )}
                                </ScatterChart>
                            </ResponsiveContainer>
                            <TimeChartLegend currentGrade={currentGrade} />
                        </>
                    ) : (
                        <EmptyChart label="asking-by-time" />
                    )}
                </div>

                <div className="chart-card">
                    <div className="chart-title">Asking Price / Grade</div>
                    {hasData(askingByGrade) ? (
                        <>
                            <ResponsiveContainer width="100%" height={180}>
                                <ScatterChart>
                                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                                    <XAxis
                                        type="number"
                                        domain={[0, 10]}
                                        dataKey="x"
                                        name="Grade"
                                        tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                                        stroke={GRID_COLOR}
                                    />
                                    <YAxis
                                        dataKey="y"
                                        name="Price"
                                        tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                                        stroke={GRID_COLOR}
                                        tickFormatter={(v) => `$${v}`}
                                    />
                                    <Tooltip content={<DotTooltip />} />
                                    <Scatter
                                        data={askingByGrade.filter((p) => p.type === "slabbed")}
                                        fill={SLABBED_COLOR}
                                        opacity={0.8}
                                    />
                                    <Scatter
                                        data={askingByGrade.filter((p) => p.type === "raw")}
                                        fill={RAW_COLOR}
                                        opacity={0.8}
                                    />
                                    {gradeCurve?.asking.slabbed && gradeCurve.asking.slabbed.length > 1 && (
                                        <Scatter
                                            data={gradeCurve.asking.slabbed}
                                            fill={SLABBED_COLOR}
                                            opacity={0.8}
                                            line
                                            lineType="joint"
                                            lineJointType="monotone"
                                            shape={(props: any) => <circle cx={props.cx} cy={props.cy} r={2} fill={SLABBED_COLOR} opacity={0.9} />}
                                        />
                                    )}
                                    {gradeCurve?.asking.raw && gradeCurve.asking.raw.length > 1 && (
                                        <Scatter
                                            data={gradeCurve.asking.raw}
                                            fill={RAW_COLOR}
                                            opacity={0.8}
                                            line
                                            lineType="joint"
                                            lineJointType="monotone"
                                            shape={(props: any) => <circle cx={props.cx} cy={props.cy} r={2} fill={RAW_COLOR} opacity={0.9} />}
                                        />
                                    )}
                                    {recommendedAsk !== undefined && (
                                        <ReferenceLine
                                            y={recommendedAsk}
                                            stroke={SLABBED_COLOR}
                                            strokeDasharray="4 3"
                                            strokeOpacity={0.5}
                                            label={{ value: `Ask $${recommendedAsk.toLocaleString()}`, fill: SLABBED_COLOR, fontSize: 10, position: "insideTopLeft" }}
                                        />
                                    )}
                                    {askingDotY !== undefined && currentGrade !== undefined && (
                                        <ReferenceDot
                                            x={currentGrade}
                                            y={askingDotY}
                                            shape={DotShape}
                                        />
                                    )}
                                </ScatterChart>
                            </ResponsiveContainer>
                            <ChartLegend />
                        </>
                    ) : (
                        <EmptyChart label="asking-by-grade" />
                    )}
                </div>
            </div>
        </div>
    );
}
