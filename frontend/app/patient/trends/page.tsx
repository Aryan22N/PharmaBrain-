"use client";

import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  Activity,
  Heart,
  Calendar,
  ShieldCheck,
  FileText,
  AlertTriangle,
  Sparkles,
  HelpCircle,
  RefreshCw,
  ExternalLink,
  Scale,
  Wind,
  CheckCircle2,
  X,
  Stethoscope,
  Info,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Lock,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { usePatientDashboard } from "@/app/patient/context";
import { LongitudinalVitalChart } from "@/components/patient/LongitudinalVitalChart";
import {
  PatientLongitudinalTrends,
  VitalDataPoint,
  MetricTrendSummary,
  PatientEligibilityInfo,
} from "@/lib/trends";

export default function TrendsPage() {
  const { userData, documents } = usePatientDashboard();
  const [trendsData, setTrendsData] = useState<PatientLongitudinalTrends | null>(null);
  const [eligibility, setEligibility] = useState<PatientEligibilityInfo | null>(null);
  const [aiSummary, setAiSummary] = useState<any | null>(null);
  const [isAiCached, setIsAiCached] = useState<boolean>(false);
  const [isAiStale, setIsAiStale] = useState<boolean>(false);
  const [staleReason, setStaleReason] = useState<string | null>(null);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [aiError, setAiError] = useState<{ code: string; message: string } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshingAi, setRefreshingAi] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"bp" | "glucose" | "hba1c" | "pulse" | "spo2" | "weight">("bp");
  const [selectedPoint, setSelectedPoint] = useState<VitalDataPoint | null>(null);
  const [rxModalDoc, setRxModalDoc] = useState<any | null>(null);

  // Load trends from API
  const fetchTrends = async (forceAiRefresh = false, generateFresh = false) => {
    try {
      if (forceAiRefresh || generateFresh) {
        setRefreshingAi(true);
        setAiError(null);
      } else {
        setLoading(true);
      }

      const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
      let url = "/api/patient/trends";
      if (forceAiRefresh) url += "?force=true";
      else if (generateFresh) url += "?generate=true";

      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (res.ok) {
        const data = await res.json();
        if (data.trends) setTrendsData(data.trends);
        if (data.eligibility) setEligibility(data.eligibility);
        setAiSummary(data.aiSummary || null);
        setIsAiCached(Boolean(data.cached));
        setIsAiStale(Boolean(data.isStale));
        setStaleReason(data.staleReason || null);
        setCachedAt(data.cachedAt || null);
        if (data.aiError) {
          setAiError(data.aiError);
        } else {
          setAiError(null);
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        setAiError({
          code: "SERVER_ERROR",
          message: errJson.error || "Failed to load clinical trends",
        });
      }
    } catch (err: any) {
      console.error("Failed loading patient trends:", err);
      setAiError({
        code: "NETWORK_ERROR",
        message: "Failed connecting to trends analysis service",
      });
    } finally {
      setLoading(false);
      setRefreshingAi(false);
    }
  };

  useEffect(() => {
    fetchTrends();
  }, []);

  // Handle click on data point to view prescription
  const handleSelectDataPoint = (pt: VitalDataPoint) => {
    setSelectedPoint(pt);
    const doc = documents.find(
      (d) =>
        d.id === pt.documentId ||
        d.id === pt.prescriptionId ||
        String(d.id) === String(pt.prescriptionId)
    );
    if (doc) {
      setRxModalDoc(doc);
    } else {
      setRxModalDoc({
        id: pt.prescriptionId || pt.id,
        filename: pt.documentName || `Prescription Record (${pt.date})`,
        summary: pt.rawText || "Verified clinical observation",
        uploadedAt: pt.date,
        structuredResult: {
          doctor: pt.doctor || "Attending Physician",
          hospital: pt.hospital || "Clinical Care Centre",
          date_iso: pt.date,
        },
      });
    }
  };

  const currentSummary: MetricTrendSummary | undefined = trendsData?.metrics[activeTab];
  const isEligible = eligibility?.isEligible ?? false;
  const distinctCount = eligibility?.distinctDatesCount ?? 0;
  const progressPct = eligibility?.progressPercentage ?? 0;

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-[#008080]">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Longitudinal Health Trends & Risk Prediction
            </h2>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl">
            Statistical multi-encounter biomarker trajectory evaluation aligned with peer-reviewed clinical guidelines (AHA/ACC 2017 & ADA 2024).
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Eligibility Badge */}
          {loading ? (
            <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1.5 animate-pulse">
              <Clock className="w-4 h-4 text-slate-400" />
              <span>Checking Eligibility...</span>
            </span>
          ) : isEligible ? (
            <span className="text-xs font-semibold px-3.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1.5 shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Eligible: {distinctCount} Distinct Clinical Dates</span>
            </span>
          ) : (
            <span className="text-xs font-semibold px-3.5 py-1.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1.5 shadow-2xs">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <span>{distinctCount} of 5 Eligible Clinical Dates</span>
            </span>
          )}

          <div className="flex items-center gap-2 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 px-3.5 py-1.5 rounded-xl">
            <ShieldCheck className="w-4 h-4 text-teal-600" />
            <span>Deterministic Clinical Rules Active</span>
          </div>
        </div>
      </div>

      {/* STATE 1: Skeleton Loader */}
      {loading && (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xs animate-pulse space-y-4">
          <div className="h-5 bg-slate-200 rounded-md w-1/3"></div>
          <div className="h-4 bg-slate-100 rounded-md w-2/3"></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
            <div className="h-24 bg-slate-100 rounded-xl"></div>
            <div className="h-24 bg-slate-100 rounded-xl"></div>
            <div className="h-24 bg-slate-100 rounded-xl"></div>
            <div className="h-24 bg-slate-100 rounded-xl"></div>
          </div>
        </div>
      )}

      {/* STATE 2: Insufficient History Card (< 5 Distinct Dates) */}
      {!loading && eligibility && !isEligible && (
        <div className="bg-white rounded-2xl border border-amber-200/90 p-6 shadow-sm relative overflow-hidden space-y-5">
          <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* Header & Progress Indicator */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-amber-100 pb-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 border border-amber-200 flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">
                    Longitudinal Trend Eligibility: Progress Tracking
                  </h3>
                  <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                    {distinctCount} of 5 eligible clinical dates
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                  To ensure statistical validity and clinical safety, full longitudinal trajectory conclusions and AI health reviews require at least <strong>5 confirmed, non-duplicate prescriptions across 5 distinct clinical dates</strong>. Multiple prescriptions on the same date count as one longitudinal time point.
                </p>
              </div>
            </div>

            {/* Quick Count Badge */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center shrink-0 min-w-[130px]">
              <div className="text-2xl font-black text-amber-900">{distinctCount} / 5</div>
              <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Clinical Dates</div>
            </div>
          </div>

          {/* Visual Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>Encounter Threshold Progress</span>
              </span>
              <span className="text-amber-800 font-bold">{progressPct}% Complete ({5 - distinctCount} more needed)</span>
            </div>

            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200/80">
              <div
                className="bg-gradient-to-r from-amber-500 via-teal-500 to-[#008080] h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.max(5, progressPct)}%` }}
              />
            </div>

            {/* Milestone Indicators */}
            <div className="grid grid-cols-5 gap-1 pt-1 text-[11px] text-center">
              {[1, 2, 3, 4, 5].map((step) => {
                const isStepReached = distinctCount >= step;
                return (
                  <div
                    key={step}
                    className={`py-1 px-1 rounded-lg border text-[11px] font-semibold transition-all ${
                      isStepReached
                        ? "bg-teal-50 border-teal-300 text-teal-800"
                        : "bg-slate-50 border-slate-200 text-slate-400"
                    }`}
                  >
                    Visit {step} {isStepReached && "✓"}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recorded Eligible Dates */}
          {eligibility.eligiblePrescriptions.length > 0 && (
            <div className="pt-2">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                <span>Recorded Eligible Clinical Dates ({eligibility.distinctDates.length} distinct)</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {eligibility.eligiblePrescriptions.map((rx, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 shadow-2xs"
                  >
                    <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="font-bold">{rx.date}</span>
                    {rx.hospital && <span className="text-slate-500">• {rx.hospital}</span>}
                    {rx.doctor && <span className="text-slate-400">({rx.doctor})</span>}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Notice Banner */}
          <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-900 flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="font-bold">Full Longitudinal Summary Locked</div>
              <p className="text-amber-800 text-[11px] leading-relaxed">
                The full longitudinal AI summary, trajectory classifications (improving/worsening rates), and overall risk stratification are locked until 5 distinct dates are reached. However, all your individual measurements, past prescriptions, and observation graphs remain fully accessible below.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 2. AI Longitudinal Narrative (Google Gemini) - Only active when isEligible */}
      {!loading && isEligible && (
        <div className="bg-gradient-to-br from-white via-slate-50 to-teal-50/40 rounded-2xl border border-teal-200/80 p-6 shadow-sm relative overflow-hidden space-y-4">
          <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* Stale Cache Notice Banner (State 6) */}
          {isAiStale && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-3 text-xs text-amber-900">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Clinical Data Updated:</strong> {staleReason || "New clinical records were recorded since the last AI summary. Deterministic guidelines below are updated. Click Refresh to regenerate."}
                </span>
              </div>
              <button
                onClick={() => fetchTrends(true)}
                disabled={refreshingAi}
                className="shrink-0 flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-lg bg-amber-600 text-white hover:bg-amber-700 shadow-xs transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshingAi ? "animate-spin" : ""}`} />
                <span>Refresh AI Summary</span>
              </button>
            </div>
          )}

          {/* AI Refresh Failure Banner (State 8) */}
          {aiError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between gap-3 text-xs text-rose-900">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <div>
                  <div className="font-bold">AI Analysis Notice ({aiError.code})</div>
                  <div className="text-rose-700 text-[11px]">{aiError.message}. Deterministic guideline evaluations below remain fully accurate.</div>
                </div>
              </div>
              <button
                onClick={() => fetchTrends(true)}
                disabled={refreshingAi}
                className="shrink-0 flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-white border border-rose-300 text-rose-800 hover:bg-rose-100 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshingAi ? "animate-spin text-rose-600" : ""}`} />
                <span>Retry</span>
              </button>
            </div>
          )}

          {/* Card Header */}
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                  <span>Gemini Longitudinal Health Review</span>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                    AI Synthesis
                  </span>
                  {isAiCached && !isAiStale && (
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      Instant Cached {cachedAt ? `(${new Date(cachedAt).toLocaleDateString()})` : ""}
                    </span>
                  )}
                  {isAiStale && (
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                      Stale (Data Changed)
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Empathetic plain-English synthesis of your biomarker trajectory across recorded encounters.
                </p>
              </div>
            </div>

            {/* Refresh Button */}
            {aiSummary && (
              <button
                onClick={() => fetchTrends(true)}
                disabled={refreshingAi}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-white text-slate-700 hover:text-teal-700 border border-slate-200 hover:border-teal-300 shadow-xs transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshingAi ? "animate-spin text-teal-600" : ""}`} />
                <span>{refreshingAi ? "Re-analyzing with Gemini..." : "Refresh Analysis"}</span>
              </button>
            )}
          </div>

          {/* STATE 4: Eligible history with no cached AI summary */}
          {!aiSummary && !refreshingAi && (
            <div className="py-6 px-4 text-center bg-white/70 rounded-xl border border-slate-200/80 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center mx-auto">
                <Sparkles className="w-5 h-5 text-teal-600" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h4 className="text-sm font-bold text-slate-900">
                  5 of 5 Clinical Dates Verified! Ready for AI Synthesis
                </h4>
                <p className="text-xs text-slate-500">
                  Click below to generate your empathetic longitudinal health summary and 3 tailored questions for your doctor.
                </p>
              </div>
              <button
                onClick={() => fetchTrends(false, true)}
                className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl bg-[#008080] text-white hover:bg-teal-700 shadow-sm transition-all"
              >
                <Sparkles className="w-4 h-4" />
                <span>Generate AI Summary</span>
              </button>
            </div>
          )}

          {/* STATE 7: AI Refresh in progress */}
          {refreshingAi && (
            <div className="py-10 text-center text-xs text-slate-600 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-teal-600" />
              <span className="font-bold">Synthesizing longitudinal biomarker data with Google Gemini...</span>
              <span className="text-[11px] text-slate-400">Evaluating multi-visit velocities, ADA/AHA guideline targets, and doctor questions</span>
            </div>
          )}

          {/* STATE 5 & 6: Cached or Fresh Narrative Output */}
          {aiSummary && !refreshingAi && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-3">
                <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                  {aiSummary.narrative}
                </p>

                {/* Highlights Pill Tags */}
                {aiSummary.keyHighlights && aiSummary.keyHighlights.length > 0 && (
                  <div className="pt-2">
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Key Trajectory Milestones
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {aiSummary.keyHighlights.map((hl: string, idx: number) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-xl bg-white border border-slate-200/90 text-slate-800 shadow-2xs"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                          <span>{hl}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Questions for Doctor */}
              <div className="bg-white/90 backdrop-blur-xs p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 border-b border-slate-100 pb-2">
                  <HelpCircle className="w-4 h-4 text-[#008080]" />
                  <span>Questions for Your Next Doctor Visit</span>
                </div>
                <ul className="space-y-2">
                  {(aiSummary.questionsForDoctor || []).map((q: string, idx: number) => (
                    <li key={idx} className="text-[11px] text-slate-600 flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-teal-50 text-[#008080] font-bold flex items-center justify-center shrink-0 text-[10px]">
                        {idx + 1}
                      </span>
                      <span>{q}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Safety Disclaimer Banner */}
          <div className="pt-3 border-t border-slate-200/60 flex items-center gap-2 text-[11px] text-slate-500">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>
              {aiSummary?.safetyDisclaimer ||
                "Informational health analysis only. All clinical treatment decisions, drug dosages, and diagnosis must be confirmed directly with your licensed physician."}
            </span>
          </div>
        </div>
      )}

      {/* 3. Metric Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setActiveTab("bp")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border shrink-0 ${
            activeTab === "bp"
              ? "bg-[#008080] text-white border-[#008080] shadow-sm"
              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
          }`}
        >
          <Heart className="w-4 h-4 text-rose-400" />
          <span>Blood Pressure (AHA/ACC)</span>
          {trendsData?.metrics.bp.latest && (
            <span
              className={`text-[10px] px-2 py-0.5 rounded-md ${
                activeTab === "bp" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"
              }`}
            >
              {trendsData.metrics.bp.latest.systolic}/{trendsData.metrics.bp.latest.diastolic}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("glucose")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border shrink-0 ${
            activeTab === "glucose"
              ? "bg-[#008080] text-white border-[#008080] shadow-sm"
              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
          }`}
        >
          <Activity className="w-4 h-4 text-amber-400" />
          <span>Blood Glucose (ADA)</span>
          {trendsData?.metrics.glucose.latest && (
            <span
              className={`text-[10px] px-2 py-0.5 rounded-md ${
                activeTab === "glucose" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"
              }`}
            >
              {trendsData.metrics.glucose.latest.value} {trendsData.metrics.glucose.latest.unit}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("hba1c")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border shrink-0 ${
            activeTab === "hba1c"
              ? "bg-[#008080] text-white border-[#008080] shadow-sm"
              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
          }`}
        >
          <Activity className="w-4 h-4 text-emerald-400" />
          <span>HbA1c Glycemia</span>
          {trendsData?.metrics.hba1c.latest && (
            <span
              className={`text-[10px] px-2 py-0.5 rounded-md ${
                activeTab === "hba1c" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"
              }`}
            >
              {trendsData.metrics.hba1c.latest.value}%
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("pulse")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border shrink-0 ${
            activeTab === "pulse"
              ? "bg-[#008080] text-white border-[#008080] shadow-sm"
              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
          }`}
        >
          <Heart className="w-4 h-4 text-blue-400" />
          <span>Heart Rate (Pulse)</span>
          {trendsData?.metrics.pulse.latest && (
            <span
              className={`text-[10px] px-2 py-0.5 rounded-md ${
                activeTab === "pulse" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"
              }`}
            >
              {trendsData.metrics.pulse.latest.value} bpm
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("spo2")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border shrink-0 ${
            activeTab === "spo2"
              ? "bg-[#008080] text-white border-[#008080] shadow-sm"
              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
          }`}
        >
          <Wind className="w-4 h-4 text-cyan-400" />
          <span>Oxygen Saturation (SpO2)</span>
          {trendsData?.metrics.spo2.latest && (
            <span
              className={`text-[10px] px-2 py-0.5 rounded-md ${
                activeTab === "spo2" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"
              }`}
            >
              {trendsData.metrics.spo2.latest.value}%
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("weight")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border shrink-0 ${
            activeTab === "weight"
              ? "bg-[#008080] text-white border-[#008080] shadow-sm"
              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
          }`}
        >
          <Scale className="w-4 h-4 text-purple-400" />
          <span>Weight & BMI</span>
          {trendsData?.metrics.weight.latest && (
            <span
              className={`text-[10px] px-2 py-0.5 rounded-md ${
                activeTab === "weight" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"
              }`}
            >
              {trendsData.metrics.weight.latest.value} kg
            </span>
          )}
        </button>
      </div>

      {/* 4. Trajectory Statistic Cards */}
      {currentSummary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Latest Reading & Classification */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
            <div className="text-xs font-semibold text-slate-500">Current Reading</div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">
                {activeTab === "bp" && currentSummary.latest
                  ? `${currentSummary.latest.systolic}/${currentSummary.latest.diastolic}`
                  : currentSummary.latest
                  ? `${currentSummary.latest.value}`
                  : "--"}
              </span>
              <span className="text-xs font-medium text-slate-500">{currentSummary.unit}</span>
            </div>
            {currentSummary.latest ? (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-md border ${currentSummary.latest.badgeBg} ${currentSummary.latest.badgeText}`}
                >
                  {currentSummary.latest.stage}
                </span>
                <span className="text-[10px] text-slate-400">({currentSummary.latest.date})</span>
              </div>
            ) : (
              <div className="text-[11px] text-slate-400">No reading recorded</div>
            )}
            <div className="text-[10px] text-slate-400 italic">Guideline classification (informational draft)</div>
          </div>

          {/* Card 2: Longitudinal Change (Delta) */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
            <div className="text-xs font-semibold text-slate-500">Longitudinal Change (Δ)</div>
            <div className="flex items-baseline gap-2">
              {!isEligible ? (
                <span className="text-2xl font-black text-slate-400">--</span>
              ) : !currentSummary.hasSufficientData ? (
                <span className="text-2xl font-black text-slate-400">--</span>
              ) : (
                <span
                  className={`text-2xl font-black flex items-center gap-1 ${
                    activeTab === "bp"
                      ? (currentSummary.totalDeltaSystolic || 0) > 0
                        ? "text-rose-600"
                        : "text-emerald-600"
                      : (currentSummary.overallDelta || 0) > 0
                      ? "text-rose-600"
                      : "text-emerald-600"
                  }`}
                >
                  {activeTab === "bp" ? (
                    <>
                      {(currentSummary.totalDeltaSystolic || 0) > 0 ? (
                        <ArrowUpRight className="w-5 h-5" />
                      ) : (currentSummary.totalDeltaSystolic || 0) < 0 ? (
                        <ArrowDownRight className="w-5 h-5" />
                      ) : (
                        <Minus className="w-5 h-5" />
                      )}
                      {currentSummary.totalDeltaSystolic != null
                        ? `${currentSummary.totalDeltaSystolic > 0 ? "+" : ""}${currentSummary.totalDeltaSystolic}`
                        : "--"}
                    </>
                  ) : (
                    <>
                      {(currentSummary.overallDelta || 0) > 0 ? (
                        <ArrowUpRight className="w-5 h-5" />
                      ) : (currentSummary.overallDelta || 0) < 0 ? (
                        <ArrowDownRight className="w-5 h-5" />
                      ) : (
                        <Minus className="w-5 h-5" />
                      )}
                      {currentSummary.overallDelta != null
                        ? `${currentSummary.overallDelta > 0 ? "+" : ""}${currentSummary.overallDelta}`
                        : "--"}
                    </>
                  )}
                </span>
              )}
              <span className="text-xs font-medium text-slate-500">{currentSummary.unit}</span>
            </div>
            <div className="text-[11px] text-slate-500">
              {!isEligible
                ? "Locked (Requires ≥5 clinical dates)"
                : !currentSummary.hasSufficientData
                ? "Requires ≥2 readings"
                : `From baseline: ${currentSummary.baseline?.date || "N/A"}`}
            </div>
          </div>

          {/* Card 3: Trajectory Profile (State 3: Limited history handling) */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
            <div className="text-xs font-semibold text-slate-500">Trajectory Direction</div>
            <div className="flex items-center gap-2">
              {!isEligible ? (
                <span className="text-xs font-bold px-2.5 py-1 rounded-lg uppercase tracking-wider bg-slate-100 text-slate-500 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-slate-400" />
                  Locked (&lt;5 Dates)
                </span>
              ) : !currentSummary.hasSufficientData ? (
                <span className="text-xs font-bold px-2.5 py-1 rounded-lg uppercase tracking-wider bg-amber-100 text-amber-800 flex items-center gap-1">
                  <Info className="w-3 h-3 text-amber-600" />
                  Limited History
                </span>
              ) : (
                <span
                  className={`text-xs font-extrabold px-2.5 py-1 rounded-lg uppercase tracking-wider ${
                    currentSummary.overallTrend === "improving"
                      ? "bg-emerald-100 text-emerald-800"
                      : currentSummary.overallTrend === "worsening"
                      ? "bg-rose-100 text-rose-800"
                      : "bg-blue-100 text-blue-800"
                  }`}
                >
                  {currentSummary.overallTrend}
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-500">
              {!isEligible ? (
                "Unlocks at 5 confirmed dates"
              ) : !currentSummary.hasSufficientData ? (
                currentSummary.insufficientDataReason || "Insufficient data points"
              ) : currentSummary.sustainedRiseWarning ? (
                <span className="text-rose-600 font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Sustained rise detected
                </span>
              ) : (
                "Calculated using actual visit dates"
              )}
            </div>
          </div>

          {/* Card 4: Multi-Visit Average */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
            <div className="text-xs font-semibold text-slate-500">Longitudinal Average</div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">
                {activeTab === "bp" && currentSummary.avgSystolic
                  ? `${currentSummary.avgSystolic}/${currentSummary.avgDiastolic}`
                  : currentSummary.avgValue != null
                  ? currentSummary.avgValue
                  : "--"}
              </span>
              <span className="text-xs font-medium text-slate-500">{currentSummary.unit}</span>
            </div>
            <div className="text-[11px] text-slate-500">
              {currentSummary.count > 0
                ? `Min: ${currentSummary.minValue ?? "--"} / Max: ${currentSummary.maxValue ?? "--"} (${currentSummary.count} visits)`
                : "No data available"}
            </div>
          </div>
        </div>
      )}

      {/* 5. Graphical Interactive Chart */}
      {currentSummary && (
        <LongitudinalVitalChart
          summary={currentSummary}
          metricType={activeTab}
          onSelectDataPoint={handleSelectDataPoint}
        />
      )}

      {/* 6. Chronological Encounters Table */}
      {currentSummary && currentSummary.dataPoints.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#008080]" />
              <h3 className="text-sm font-bold text-slate-900">
                Chronological Encounter Log ({currentSummary.metricLabel})
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              Click any row to inspect prescription scan
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Encounter Date</th>
                  <th className="py-2.5 px-3">Observed Value</th>
                  <th className="py-2.5 px-3">Clinical Stage</th>
                  <th className="py-2.5 px-3">Change vs Prior Visit</th>
                  <th className="py-2.5 px-3">Raw Prescription Text</th>
                  <th className="py-2.5 px-3 text-right">Source Scan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {currentSummary.dataPoints.map((pt, idx) => (
                  <tr
                    key={idx}
                    onClick={() => handleSelectDataPoint(pt)}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                  >
                    <td className="py-3 px-3 font-bold text-slate-900 flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{pt.date}</span>
                    </td>
                    <td className="py-3 px-3 font-extrabold text-slate-900">
                      {pt.systolic ? `${pt.systolic}/${pt.diastolic} mmHg` : `${pt.value} ${pt.unit}`}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${pt.badgeBg} ${pt.badgeText}`}
                      >
                        {pt.stage}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {pt.prevDate ? (
                        <span
                          className={`font-semibold ${
                            pt.deltaSystolic && pt.deltaSystolic > 0
                              ? "text-rose-600"
                              : pt.deltaValue && pt.deltaValue > 0
                              ? "text-rose-600"
                              : "text-emerald-600"
                          }`}
                        >
                          {pt.deltaSystolic != null
                            ? `${pt.deltaSystolic > 0 ? "+" : ""}${pt.deltaSystolic} mmHg`
                            : pt.deltaValue != null
                            ? `${pt.deltaValue > 0 ? "+" : ""}${pt.deltaValue} ${pt.unit}`
                            : "--"}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Initial baseline</span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-500 text-[11px] max-w-xs truncate">
                      {pt.rawText || "--"}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-slate-600 hover:text-teal-700 bg-slate-100 hover:bg-teal-50 border border-slate-200 transition-colors font-semibold text-[11px]">
                        <ExternalLink className="w-3 h-3" />
                        <span>View Rx</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. Modal: Source Prescription Detail */}
      {rxModalDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#008080]" />
                <h3 className="text-base font-bold text-slate-900">
                  {rxModalDoc.filename || "Source Prescription Record"}
                </h3>
              </div>
              <button
                onClick={() => setRxModalDoc(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div>
                  <div className="text-[11px] text-slate-400">Encounter Date</div>
                  <div className="font-bold text-slate-800">
                    {rxModalDoc.structuredResult?.date_iso || rxModalDoc.uploadedAt?.slice(0, 10) || "Recorded"}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">Attending Doctor</div>
                  <div className="font-bold text-slate-800">
                    {typeof rxModalDoc.structuredResult?.doctor === "string"
                      ? rxModalDoc.structuredResult.doctor
                      : rxModalDoc.structuredResult?.doctor?.name || "Consulting Physician"}
                  </div>
                </div>
                <div className="col-span-2">
                  <div className="text-[11px] text-slate-400">Facility / Hospital</div>
                  <div className="font-bold text-slate-800">
                    {rxModalDoc.structuredResult?.hospital || "City Care Medical Centre"}
                  </div>
                </div>
              </div>

              {selectedPoint && (
                <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 space-y-1">
                  <div className="font-bold text-teal-900 flex items-center justify-between">
                    <span>Selected Observation:</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-md border ${selectedPoint.badgeBg} ${selectedPoint.badgeText}`}
                    >
                      {selectedPoint.stage}
                    </span>
                  </div>
                  <div className="text-sm font-black text-teal-950">
                    {selectedPoint.systolic
                      ? `${selectedPoint.systolic}/${selectedPoint.diastolic} mmHg`
                      : `${selectedPoint.value} ${selectedPoint.unit}`}
                  </div>
                  <div className="text-[11px] text-teal-800 font-mono">
                    Raw reading: {selectedPoint.rawText}
                  </div>
                </div>
              )}

              {rxModalDoc.summary && (
                <div>
                  <div className="text-[11px] font-semibold text-slate-700 mb-1">Clinical Summary:</div>
                  <p className="text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    {rxModalDoc.summary}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setRxModalDoc(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
              >
                Close
              </button>
              {rxModalDoc.id && (
                <a
                  href={`/patient/documents/${rxModalDoc.id}`}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#008080] text-white hover:bg-teal-700 transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Document View</span>
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
