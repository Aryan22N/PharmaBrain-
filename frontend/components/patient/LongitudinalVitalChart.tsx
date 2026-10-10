"use client";

import React, { useState } from "react";
import { VitalDataPoint, MetricTrendSummary } from "@/lib/trends";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Info,
} from "lucide-react";

interface ReferenceBand {
  label: string;
  min: number;
  max: number;
  color: string;
  textColor: string;
  bgFill: string;
}

interface LongitudinalVitalChartProps {
  summary: MetricTrendSummary;
  metricType: "bp" | "glucose" | "hba1c" | "pulse" | "spo2" | "weight";
  onSelectDataPoint?: (point: VitalDataPoint) => void;
}

export function LongitudinalVitalChart({
  summary,
  metricType,
  onSelectDataPoint,
}: LongitudinalVitalChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<VitalDataPoint | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number } | null>(null);
  const [activeBpLine, setActiveBpLine] = useState<"both" | "systolic" | "diastolic">("both");

  const data = summary.dataPoints;

  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center p-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
        <Info className="w-8 h-8 text-slate-400 mb-2" />
        <h4 className="text-sm font-semibold text-slate-700">No Historical Records Found</h4>
        <p className="text-xs text-slate-500 max-w-sm mt-1">
          Upload and confirm medical prescriptions containing {summary.metricLabel.toLowerCase()} to generate longitudinal charts.
        </p>
      </div>
    );
  }

  // 1. Define Clinical Reference Bands
  let bands: ReferenceBand[] = [];
  let yMin = 0;
  let yMax = 200;

  if (metricType === "bp") {
    yMin = 50;
    yMax = 190;
    bands = [
      { label: "Optimal (<120)", min: 50, max: 120, color: "#10b981", textColor: "text-emerald-700", bgFill: "rgba(16, 185, 129, 0.08)" },
      { label: "Elevated (120-129)", min: 120, max: 130, color: "#eab308", textColor: "text-yellow-700", bgFill: "rgba(234, 179, 8, 0.08)" },
      { label: "Stage 1 (130-139)", min: 130, max: 140, color: "#f97316", textColor: "text-amber-700", bgFill: "rgba(249, 115, 22, 0.08)" },
      { label: "Stage 2 (≥140)", min: 140, max: 190, color: "#ef4444", textColor: "text-rose-700", bgFill: "rgba(239, 68, 68, 0.08)" },
    ];
  } else if (metricType === "glucose") {
    yMin = 50;
    yMax = 250;
    bands = [
      { label: "Normal (70-99)", min: 70, max: 100, color: "#10b981", textColor: "text-emerald-700", bgFill: "rgba(16, 185, 129, 0.08)" },
      { label: "Prediabetes (100-125)", min: 100, max: 126, color: "#f97316", textColor: "text-amber-700", bgFill: "rgba(249, 115, 22, 0.08)" },
      { label: "Diabetic (≥126)", min: 126, max: 250, color: "#ef4444", textColor: "text-rose-700", bgFill: "rgba(239, 68, 68, 0.08)" },
    ];
  } else if (metricType === "hba1c") {
    yMin = 4.0;
    yMax = 10.0;
    bands = [
      { label: "Normal (<5.7%)", min: 4.0, max: 5.7, color: "#10b981", textColor: "text-emerald-700", bgFill: "rgba(16, 185, 129, 0.08)" },
      { label: "Prediabetes (5.7-6.4%)", min: 5.7, max: 6.5, color: "#f97316", textColor: "text-amber-700", bgFill: "rgba(249, 115, 22, 0.08)" },
      { label: "Diabetes (≥6.5%)", min: 6.5, max: 10.0, color: "#ef4444", textColor: "text-rose-700", bgFill: "rgba(239, 68, 68, 0.08)" },
    ];
  } else if (metricType === "pulse") {
    yMin = 40;
    yMax = 130;
    bands = [
      { label: "Bradycardia (<60)", min: 40, max: 60, color: "#3b82f6", textColor: "text-blue-700", bgFill: "rgba(59, 130, 246, 0.08)" },
      { label: "Normal (60-100)", min: 60, max: 100, color: "#10b981", textColor: "text-emerald-700", bgFill: "rgba(16, 185, 129, 0.08)" },
      { label: "Tachycardia (>100)", min: 100, max: 130, color: "#ef4444", textColor: "text-rose-700", bgFill: "rgba(239, 68, 68, 0.08)" },
    ];
  } else if (metricType === "spo2") {
    yMin = 85;
    yMax = 100;
    bands = [
      { label: "Critical (<90%)", min: 85, max: 90, color: "#dc2626", textColor: "text-red-700", bgFill: "rgba(220, 38, 38, 0.10)" },
      { label: "Mild Hypoxia (90-94%)", min: 90, max: 95, color: "#f97316", textColor: "text-amber-700", bgFill: "rgba(249, 115, 22, 0.08)" },
      { label: "Optimal (≥95%)", min: 95, max: 100, color: "#10b981", textColor: "text-emerald-700", bgFill: "rgba(16, 185, 129, 0.08)" },
    ];
  } else {
    // Weight
    const weights = data.map(d => d.value || 0).filter(Boolean);
    const minW = weights.length ? Math.min(...weights) : 50;
    const maxW = weights.length ? Math.max(...weights) : 100;
    yMin = Math.max(30, Math.floor(minW - 5));
    yMax = Math.ceil(maxW + 5);
  }

  // Adjust Y range dynamically if values exceed preset bounds
  if (metricType === "bp") {
    const sysVals = data.map(d => d.systolic || 0);
    const diaVals = data.map(d => d.diastolic || 0);
    if (Math.max(...sysVals) > yMax) yMax = Math.ceil(Math.max(...sysVals) + 10);
    if (Math.min(...diaVals) < yMin) yMin = Math.max(30, Math.floor(Math.min(...diaVals) - 10));
  } else {
    const vals = data.map(d => d.value || 0);
    if (Math.max(...vals) > yMax) yMax = Math.ceil(Math.max(...vals) * 1.1);
    if (Math.min(...vals) < yMin && Math.min(...vals) > 0) yMin = Math.floor(Math.min(...vals) * 0.9);
  }

  // 2. Chart Dimensions
  const svgWidth = 800;
  const svgHeight = 320;
  const padLeft = 65;
  const padRight = 35;
  const padTop = 30;
  const padBottom = 45;

  const chartW = svgWidth - padLeft - padRight;
  const chartH = svgHeight - padTop - padBottom;

  const getY = (val: number) => {
    const clamped = Math.max(yMin, Math.min(yMax, val));
    return padTop + chartH - ((clamped - yMin) / (yMax - yMin)) * chartH;
  };

  const getX = (idx: number) => {
    if (data.length === 1) return padLeft + chartW / 2;
    return padLeft + (idx / (data.length - 1)) * chartW;
  };

  // Build points for paths
  const sysPoints = data.map((d, i) => ({ x: getX(i), y: getY(d.systolic || 120), raw: d }));
  const diaPoints = data.map((d, i) => ({ x: getX(i), y: getY(d.diastolic || 80), raw: d }));
  const singlePoints = data.map((d, i) => ({ x: getX(i), y: getY(d.value || yMin), raw: d }));

  const generateSvgPath = (pts: { x: number; y: number }[]) => {
    if (pts.length === 0) return "";
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
    return pts.reduce((acc, pt, i, arr) => {
      if (i === 0) return `M ${pt.x} ${pt.y}`;
      // Smooth cubic bezier curve
      const prev = arr[i - 1];
      const cx1 = prev.x + (pt.x - prev.x) / 3;
      const cy1 = prev.y;
      const cx2 = prev.x + (2 * (pt.x - prev.x)) / 3;
      const cy2 = pt.y;
      return `${acc} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${pt.x} ${pt.y}`;
    }, "");
  };

  const sysPath = generateSvgPath(sysPoints);
  const diaPath = generateSvgPath(diaPoints);
  const singlePath = generateSvgPath(singlePoints);

  // Closed area paths for gradient fill
  const sysArea = sysPoints.length > 1
    ? `${sysPath} L ${sysPoints[sysPoints.length - 1].x} ${padTop + chartH} L ${sysPoints[0].x} ${padTop + chartH} Z`
    : "";
  const singleArea = singlePoints.length > 1
    ? `${singlePath} L ${singlePoints[singlePoints.length - 1].x} ${padTop + chartH} L ${singlePoints[0].x} ${padTop + chartH} Z`
    : "";

  return (
    <div className="relative bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
      {/* Controls Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900">{summary.metricLabel} Longitudinal Trajectory</h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              {data.length} encounter{data.length === 1 ? "" : "s"}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Deterministic time-series plotted against peer-reviewed clinical reference standards.
          </p>
        </div>

        {/* BP Sub-controls */}
        {metricType === "bp" && (
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-medium">
            <button
              onClick={() => setActiveBpLine("both")}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                activeBpLine === "both" ? "bg-white text-slate-900 shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Systolic & Diastolic
            </button>
            <button
              onClick={() => setActiveBpLine("systolic")}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                activeBpLine === "systolic" ? "bg-rose-50 text-rose-700 shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Systolic Only
            </button>
            <button
              onClick={() => setActiveBpLine("diastolic")}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                activeBpLine === "diastolic" ? "bg-blue-50 text-blue-700 shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Diastolic Only
            </button>
          </div>
        )}
      </div>

      {/* SVG Chart */}
      <div className="relative w-full overflow-hidden select-none">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto max-h-[360px]"
          onMouseLeave={() => {
            setHoveredPoint(null);
            setHoverPosition(null);
          }}
        >
          <defs>
            <linearGradient id="sysGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="singleGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0d9488" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#0d9488" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* 1. Shaded Reference Bands */}
          {bands.map((band, idx) => {
            const yTop = getY(band.max);
            const yBottom = getY(band.min);
            const bandHeight = Math.max(0, yBottom - yTop);
            return (
              <g key={`band-${idx}`}>
                <rect
                  x={padLeft}
                  y={yTop}
                  width={chartW}
                  height={bandHeight}
                  fill={band.bgFill}
                />
                <line
                  x1={padLeft}
                  y1={yTop}
                  x2={padLeft + chartW}
                  y2={yTop}
                  stroke={band.color}
                  strokeWidth="0.75"
                  strokeDasharray="4 4"
                  opacity="0.4"
                />
                {/* Zone Label watermark */}
                <text
                  x={padLeft + chartW - 6}
                  y={yTop + 14}
                  textAnchor="end"
                  fontSize="9.5"
                  fontWeight="600"
                  fill={band.color}
                  opacity="0.8"
                >
                  {band.label}
                </text>
              </g>
            );
          })}

          {/* 2. Grid Y-Axis ticks */}
          {[yMin, (yMin + yMax) / 2, yMax].map((tickVal, idx) => {
            const yPos = getY(tickVal);
            return (
              <g key={`tick-${idx}`}>
                <line
                  x1={padLeft}
                  y1={yPos}
                  x2={padLeft + chartW}
                  y2={yPos}
                  stroke="#e2e8f0"
                  strokeWidth="0.75"
                />
                <text
                  x={padLeft - 8}
                  y={yPos + 3.5}
                  textAnchor="end"
                  fontSize="10"
                  fontWeight="600"
                  fill="#64748b"
                >
                  {typeof tickVal === "number" ? Math.round(tickVal) : tickVal}
                </text>
              </g>
            );
          })}

          {/* 3. X-Axis Dates */}
          {data.map((d, idx) => {
            const xPos = getX(idx);
            return (
              <g key={`x-date-${idx}`}>
                <line
                  x1={xPos}
                  y1={padTop + chartH}
                  x2={xPos}
                  y2={padTop + chartH + 5}
                  stroke="#94a3b8"
                  strokeWidth="1"
                />
                <text
                  x={xPos}
                  y={padTop + chartH + 18}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="500"
                  fill="#475569"
                >
                  {d.date.slice(5)} {/* MM-DD */}
                </text>
                <text
                  x={xPos}
                  y={padTop + chartH + 30}
                  textAnchor="middle"
                  fontSize="8.5"
                  fontWeight="400"
                  fill="#94a3b8"
                >
                  {d.date.slice(0, 4)} {/* YYYY */}
                </text>
              </g>
            );
          })}

          {/* 4. Area Fills */}
          {metricType === "bp" ? (
            activeBpLine !== "diastolic" && <path d={sysArea} fill="url(#sysGradient)" />
          ) : (
            <path d={singleArea} fill="url(#singleGradient)" />
          )}

          {/* 5. Plotted Curves */}
          {metricType === "bp" ? (
            <>
              {/* Systolic Line */}
              {activeBpLine !== "diastolic" && (
                <path
                  d={sysPath}
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="2.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {/* Diastolic Line */}
              {activeBpLine !== "systolic" && (
                <path
                  d={diaPath}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="2.5"
                  strokeDasharray="2 2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </>
          ) : (
            <path
              d={singlePath}
              fill="none"
              stroke="#0d9488"
              strokeWidth="2.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* 6. Interactive Data Markers (Nodes) */}
          {metricType === "bp" ? (
            <>
              {activeBpLine !== "diastolic" &&
                sysPoints.map((pt, i) => (
                  <g key={`sys-node-${i}`}>
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={hoveredPoint?.id === pt.raw.id ? 7 : 4.5}
                      fill="#ef4444"
                      stroke="#ffffff"
                      strokeWidth="2.5"
                      className="cursor-pointer transition-all duration-150"
                      onMouseEnter={(e) => {
                        setHoveredPoint(pt.raw);
                        const rect = e.currentTarget.getBoundingClientRect();
                        setHoverPosition({ x: pt.x, y: pt.y });
                      }}
                      onClick={() => onSelectDataPoint?.(pt.raw)}
                    />
                  </g>
                ))}

              {activeBpLine !== "systolic" &&
                diaPoints.map((pt, i) => (
                  <g key={`dia-node-${i}`}>
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={hoveredPoint?.id === pt.raw.id ? 6 : 4}
                      fill="#3b82f6"
                      stroke="#ffffff"
                      strokeWidth="2"
                      className="cursor-pointer transition-all duration-150"
                      onMouseEnter={(e) => {
                        setHoveredPoint(pt.raw);
                        setHoverPosition({ x: pt.x, y: pt.y });
                      }}
                      onClick={() => onSelectDataPoint?.(pt.raw)}
                    />
                  </g>
                ))}
            </>
          ) : (
            singlePoints.map((pt, i) => (
              <g key={`node-${i}`}>
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={hoveredPoint?.id === pt.raw.id ? 7 : 4.5}
                  fill="#0d9488"
                  stroke="#ffffff"
                  strokeWidth="2.5"
                  className="cursor-pointer transition-all duration-150"
                  onMouseEnter={(e) => {
                    setHoveredPoint(pt.raw);
                    setHoverPosition({ x: pt.x, y: pt.y });
                  }}
                  onClick={() => onSelectDataPoint?.(pt.raw)}
                />
              </g>
            ))
          )}
        </svg>

        {/* Floating Tooltip Card */}
        {hoveredPoint && hoverPosition && (
          <div
            className="absolute z-20 pointer-events-auto bg-white/95 backdrop-blur-md p-3.5 rounded-xl shadow-lg border border-slate-200/90 text-xs w-64 space-y-2 transition-all transform -translate-x-1/2"
            style={{
              left: `${(hoverPosition.x / svgWidth) * 100}%`,
              top: `${Math.max(10, (hoverPosition.y / svgHeight) * 100 - 35)}%`,
            }}
          >
            {/* Header: Date & Stage */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
              <div className="flex items-center gap-1.5 text-slate-700 font-bold">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>{hoveredPoint.date}</span>
              </div>
              <span
                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${hoveredPoint.badgeBg} ${hoveredPoint.badgeText}`}
              >
                {hoveredPoint.stage}
              </span>
            </div>

            {/* Reading Values */}
            <div className="space-y-1">
              <div className="text-slate-500 text-[11px]">Recorded Observation:</div>
              <div className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                {metricType === "bp" ? (
                  <>
                    <span className="text-rose-600">{hoveredPoint.systolic}</span>
                    <span className="text-slate-400">/</span>
                    <span className="text-blue-600">{hoveredPoint.diastolic}</span>
                    <span className="text-xs font-normal text-slate-500">mmHg</span>
                  </>
                ) : (
                  <>
                    <span className="text-teal-700">{hoveredPoint.value}</span>
                    <span className="text-xs font-normal text-slate-500">{hoveredPoint.unit}</span>
                  </>
                )}
              </div>
            </div>

            {/* Pairwise Delta & Trajectory */}
            {hoveredPoint.prevDate ? (
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 space-y-1 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Change from prior visit:</span>
                  <span className="font-bold flex items-center gap-1">
                    {metricType === "bp" ? (
                      <>
                        <span className={hoveredPoint.deltaSystolic && hoveredPoint.deltaSystolic > 0 ? "text-rose-600" : "text-emerald-600"}>
                          {hoveredPoint.deltaSystolic && hoveredPoint.deltaSystolic > 0 ? `+${hoveredPoint.deltaSystolic}` : hoveredPoint.deltaSystolic} mmHg sys
                        </span>
                      </>
                    ) : (
                      <span className={hoveredPoint.deltaValue && hoveredPoint.deltaValue > 0 ? "text-rose-600" : "text-emerald-600"}>
                        {hoveredPoint.deltaValue && hoveredPoint.deltaValue > 0 ? `+${hoveredPoint.deltaValue}` : hoveredPoint.deltaValue} {hoveredPoint.unit}
                      </span>
                    )}
                  </span>
                </div>

                {hoveredPoint.velocityPerMonth !== undefined && (
                  <div className="flex items-center justify-between text-slate-400 text-[10px]">
                    <span>Monthly velocity:</span>
                    <span>{hoveredPoint.velocityPerMonth} {hoveredPoint.unit}/mo</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-[10px] text-slate-400 italic">Initial baseline encounter</div>
            )}

            {/* Source Rx Action */}
            {onSelectDataPoint && (
              <button
                onClick={() => onSelectDataPoint(hoveredPoint)}
                className="w-full mt-1 flex items-center justify-center gap-1.5 py-1.5 px-2 bg-slate-900 hover:bg-[#008080] text-white rounded-lg font-medium text-[11px] transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                <span>View Source Prescription</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Legend Footer */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-4 flex-wrap">
          {metricType === "bp" ? (
            <>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-1 bg-rose-500 rounded-full"></span>
                <span className="font-semibold text-slate-700">Systolic (Peak)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-1 border-t-2 border-dashed border-blue-500"></span>
                <span className="font-semibold text-slate-700">Diastolic (Rest)</span>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1 bg-teal-600 rounded-full"></span>
              <span className="font-semibold text-slate-700">{summary.metricLabel}</span>
            </div>
          )}

          {/* Reference bands legend */}
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span>Bands:</span>
            {bands.map((b, i) => (
              <span key={i} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: b.color }}></span>
                <span>{b.label}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="text-[11px] text-slate-400 flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
          <span>AHA/ACC & ADA Standard Zones</span>
        </div>
      </div>
    </div>
  );
}
