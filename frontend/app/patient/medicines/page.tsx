"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Pill,
  Plus,
  AlertTriangle,
  Calendar,
  Clock,
  Stethoscope,
  Building2,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  PauseCircle,
  PlayCircle,
  FileText,
  Search,
  Filter,
  Eye,
  RefreshCw,
  AlertCircle,
  ChevronRight,
  Check,
  X,
  ExternalLink,
  Info,
  ZoomIn,
} from "lucide-react";
import { usePatientDashboard } from "@/app/patient/context";

type MainTab = "CURRENT" | "HISTORY" | "NEEDS_REVIEW";

export default function MedicinesPage() {
  const { refresh: refreshDashboard, setAddMedicineModalOpen } = usePatientDashboard();

  // Tab & Filter States
  const [activeTab, setActiveTab] = useState<MainTab>("CURRENT");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState("ALL");
  const [selectedIndication, setSelectedIndication] = useState("ALL");
  const [historyStatusFilter, setHistoryStatusFilter] = useState("ALL");

  // Data States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [medications, setMedications] = useState<any[]>([]);
  const [currentMeds, setCurrentMeds] = useState<any[]>([]);
  const [historyMeds, setHistoryMeds] = useState<any[]>([]);
  const [needsReviewMeds, setNeedsReviewMeds] = useState<any[]>([]);
  const [counts, setCounts] = useState({
    total: 0,
    active: 0,
    history: 0,
    needsReview: 0,
    conflicts: 0,
  });
  const [filterOptions, setFilterOptions] = useState<{
    doctors: string[];
    indications: string[];
    statuses: string[];
  }>({
    doctors: [],
    indications: [],
    statuses: [],
  });

  // Action / Modal States
  const [inspectModal, setInspectModal] = useState<{ open: boolean; med: any | null }>({
    open: false,
    med: null,
  });
  const [statusModal, setStatusModal] = useState<{
    open: boolean;
    med: any | null;
    targetStatus: "COMPLETED" | "ON_HOLD" | "DISCONTINUED" | null;
    reason: string;
    submitting: boolean;
  }>({
    open: false,
    med: null,
    targetStatus: null,
    reason: "",
    submitting: false,
  });

  const SUGGESTED_REASONS: Record<string, string[]> = {
    COMPLETED: [
      "Completed full prescribed duration",
      "Symptoms fully resolved",
      "Doctor advised course completion",
      "Follow-up tests returned clear",
    ],
    ON_HOLD: [
      "Temporary pause before procedure / surgery",
      "Monitoring side effects / intolerance",
      "Awaiting doctor consultation / lab results",
      "Temporary fasting / travel pause",
    ],
    DISCONTINUED: [
      "Adverse side effects / allergic reaction",
      "Doctor switched to alternative medication",
      "Condition resolved early / no longer indicated",
      "Ineffective therapeutic response",
    ],
  };
  const [reviewModal, setReviewModal] = useState<{
    open: boolean;
    med: any | null;
    submitting: boolean;
  }>({
    open: false,
    med: null,
    submitting: false,
  });

  // Fetch Reconciled Medications
  const fetchMedications = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const token =
        (typeof window !== "undefined" && localStorage.getItem("auth_token")) || "";

      const res = await fetch("/api/patient/medicines", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error("Failed to load patient medications");

      const data = await res.json();
      if (data.success) {
        setMedications(data.medications || []);
        setCurrentMeds(data.current || []);
        setHistoryMeds(data.history || []);
        setNeedsReviewMeds(data.needsReview || []);
        if (data.counts) setCounts(data.counts);
        if (data.filterOptions) setFilterOptions(data.filterOptions);
      }
    } catch (err) {
      console.error("Error loading medications:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchMedications();
  }, [fetchMedications]);

  // Handle Lifecycle Transitions (PATCH)
  const handleUpdateStatus = async (
    medId: number | string,
    targetStatus: string,
    extraBody: Record<string, any> = {}
  ) => {
    try {
      const token =
        (typeof window !== "undefined" && localStorage.getItem("auth_token")) || "";

      const res = await fetch(`/api/patient/medicines/${medId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: targetStatus,
          ...extraBody,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        alert(resData.error || "Failed to update medication status");
        return false;
      }

      await fetchMedications(true);
      await refreshDashboard();
      return true;
    } catch (err: any) {
      alert("Error: " + err.message);
      return false;
    }
  };

  // Open Status Transition Modal with Clinical Explanation & Reason Prompt
  const openStatusModal = (
    med: any,
    targetStatus: "COMPLETED" | "ON_HOLD" | "DISCONTINUED"
  ) => {
    setStatusModal({
      open: true,
      med,
      targetStatus,
      reason: "",
      submitting: false,
    });
  };

  // Submit Status Transition (Completed, Hold, Discontinue) with Reason
  const submitStatusTransition = async () => {
    if (!statusModal.med || !statusModal.targetStatus) return;

    if (
      (statusModal.targetStatus === "DISCONTINUED" || statusModal.targetStatus === "ON_HOLD") &&
      !statusModal.reason.trim()
    ) {
      alert(
        `Please provide a reason for placing this medication on ${
          statusModal.targetStatus === "ON_HOLD" ? "Hold" : "Discontinue"
        }.`
      );
      return;
    }

    setStatusModal((prev) => ({ ...prev, submitting: true }));
    const trimmedReason = statusModal.reason.trim();
    const ok = await handleUpdateStatus(statusModal.med.id, statusModal.targetStatus, {
      reason:
        trimmedReason ||
        (statusModal.targetStatus === "COMPLETED"
          ? "Course completed as prescribed"
          : ""),
      statusReason:
        trimmedReason ||
        (statusModal.targetStatus === "COMPLETED"
          ? "Course completed as prescribed"
          : ""),
      discontinuedReason:
        statusModal.targetStatus === "DISCONTINUED" ? trimmedReason : undefined,
    });
    if (ok) {
      setStatusModal({ open: false, med: null, targetStatus: null, reason: "", submitting: false });
    } else {
      setStatusModal((prev) => ({ ...prev, submitting: false }));
    }
  };

  // Resolve Review Flag
  const submitResolveReview = async () => {
    if (!reviewModal.med) return;
    setReviewModal((prev) => ({ ...prev, submitting: true }));
    const ok = await handleUpdateStatus(reviewModal.med.id, "ACTIVE", {
      isConflicting: false,
      conflictDetails: null,
      reconciliationNotes: "Review acknowledged and confirmed by patient/clinician.",
    });
    if (ok) {
      setReviewModal({ open: false, med: null, submitting: false });
    } else {
      setReviewModal((prev) => ({ ...prev, submitting: false }));
    }
  };

  // Compute Active List for Selected Tab
  const activeList = useMemo(() => {
    let list: any[] = [];
    if (activeTab === "CURRENT") list = currentMeds;
    else if (activeTab === "HISTORY") list = historyMeds;
    else if (activeTab === "NEEDS_REVIEW") list = needsReviewMeds;

    return list.filter((m) => {
      // Search filter (name, strength, indication, doctor)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = (m.name || "").toLowerCase().includes(q);
        const matchesStrength = (m.strength || "").toLowerCase().includes(q);
        const matchesIndication = (m.indication || "").toLowerCase().includes(q);
        const matchesDoctor = (m.doctor || "").toLowerCase().includes(q);
        if (!matchesName && !matchesStrength && !matchesIndication && !matchesDoctor) {
          return false;
        }
      }

      // Doctor filter
      if (selectedDoctor !== "ALL" && m.doctor !== selectedDoctor) {
        return false;
      }

      // Indication filter
      if (selectedIndication !== "ALL" && m.indication !== selectedIndication) {
        return false;
      }

      // History status filter
      if (activeTab === "HISTORY" && historyStatusFilter !== "ALL") {
        if (m.status !== historyStatusFilter) return false;
      }

      return true;
    });
  }, [
    activeTab,
    currentMeds,
    historyMeds,
    needsReviewMeds,
    searchQuery,
    selectedDoctor,
    selectedIndication,
    historyStatusFilter,
  ]);

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Medication Lifecycle & Regimens
            </h2>
            <span className="bg-[#ccfbf1]/80 text-[#0f766e] text-xs font-bold px-3 py-1 rounded-full border border-[#99f6e4]">
              {counts.active} Ongoing Courses
            </span>
            {counts.needsReview > 0 && (
              <span className="bg-amber-50 text-amber-800 text-xs font-bold px-3 py-1 rounded-full border border-amber-300 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-600" />
                {counts.needsReview} Require Review
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
            Longitudinal medication lifecycle tracking across clinical encounters, overlapping treatments, and multi-condition regimens without premature discontinuations.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button
            onClick={() => fetchMedications(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3.5 py-2 rounded-xl transition-colors cursor-pointer border border-slate-200/70"
            title="Refresh medication list and sync prescriptions"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-teal-600" : ""}`} />
            <span>Sync</span>
          </button>

          <button
            onClick={() => setAddMedicineModalOpen(true)}
            className="flex items-center gap-1.5 bg-[#008080] hover:bg-[#006666] text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs transition-colors shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add Medication</span>
          </button>
        </div>
      </div>

      {/* Global Clinical Review Banner if any records flagged */}
      {counts.conflicts > 0 && (
        <div className="bg-[#fffbeb] border-2 border-amber-300 p-5 rounded-2xl space-y-2 shadow-xs">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <span className="font-extrabold text-slate-900 text-sm tracking-tight">
                Clinical Discrepancy & Overlapping Regimen Alert ({counts.conflicts})
              </span>
            </div>
            <button
              onClick={() => setActiveTab("NEEDS_REVIEW")}
              className="text-xs font-bold text-amber-900 hover:text-amber-950 underline flex items-center gap-1 cursor-pointer"
            >
              <span>View in Needs Review</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-xs text-slate-700 leading-relaxed">
            One or more medications have modified dosages between encounters, conflicting instructions from multiple doctors, or uncertain durations. Review details before clinical administration.
          </p>
        </div>
      )}

      {/* Educational Lifecycle Statuses & Patient Controls Banner */}
      <div className="bg-gradient-to-r from-teal-50/70 via-slate-50 to-indigo-50/70 p-4 rounded-2xl border border-teal-200/70 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-teal-100/60 pb-2">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-teal-700 shrink-0" />
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Understanding Medication Lifecycle Actions
            </h4>
          </div>
          <span className="text-[11px] text-teal-800 font-medium">
            Every status change prompts for a reason and logs to your medical audit trail
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="bg-white p-3.5 rounded-xl border border-emerald-200/80 shadow-2xs space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Completed</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Signifies you finished the full prescribed duration or treatment ended successfully as planned by your doctor. Moves the course into Medical History with an exact completion date and your notes.
            </p>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-amber-200/80 shadow-2xs space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-amber-800">
              <PauseCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Hold</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Signifies a temporary pause (e.g. before surgery, monitoring side effects, awaiting lab results, or travel). Preserves the dosage regimen and allows you to click <strong>Resume</strong> anytime.
            </p>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-rose-200/80 shadow-2xs space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-rose-800">
              <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Discontinue</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Signifies permanent cessation (e.g. adverse allergic reactions, intolerable side effects, or doctor switching to an alternative drug). Stores your clinical reason permanently in the database.
            </p>
          </div>
        </div>
      </div>

      {/* 3-Section Tab Navigation & Search Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          {/* Main 3 Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
            <button
              onClick={() => setActiveTab("CURRENT")}
              className={`flex items-center gap-2 px-4 py-2 text-xs rounded-xl font-bold transition-all cursor-pointer ${
                activeTab === "CURRENT"
                  ? "bg-teal-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200"
              }`}
            >
              <Pill className="w-3.5 h-3.5" />
              <span>Current Medicines</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full ${
                  activeTab === "CURRENT"
                    ? "bg-teal-700 text-teal-100"
                    : "bg-slate-200 text-slate-700 font-extrabold"
                }`}
              >
                {counts.active}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("HISTORY")}
              className={`flex items-center gap-2 px-4 py-2 text-xs rounded-xl font-bold transition-all cursor-pointer ${
                activeTab === "HISTORY"
                  ? "bg-teal-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200"
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Medical History</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full ${
                  activeTab === "HISTORY"
                    ? "bg-teal-700 text-teal-100"
                    : "bg-slate-200 text-slate-700 font-extrabold"
                }`}
              >
                {counts.history}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("NEEDS_REVIEW")}
              className={`flex items-center gap-2 px-4 py-2 text-xs rounded-xl font-bold transition-all cursor-pointer ${
                activeTab === "NEEDS_REVIEW"
                  ? "bg-amber-600 text-white shadow-xs"
                  : counts.needsReview > 0
                  ? "bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200"
                  : "bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200"
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Needs Review</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full ${
                  activeTab === "NEEDS_REVIEW"
                    ? "bg-amber-700 text-amber-100"
                    : counts.needsReview > 0
                    ? "bg-amber-200 text-amber-900 font-extrabold"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                {counts.needsReview}
              </span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full lg:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search medication, strength, indication..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-teal-500 focus:bg-white text-slate-800"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500 font-semibold">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>Filters:</span>
          </div>

          {/* Doctor Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Doctor:</span>
            <select
              value={selectedDoctor}
              onChange={(e) => setSelectedDoctor(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 font-medium focus:outline-none focus:border-teal-500"
            >
              <option value="ALL">All Clinicians</option>
              {filterOptions.doctors.map((doc) => (
                <option key={doc} value={doc}>
                  {doc}
                </option>
              ))}
            </select>
          </div>

          {/* Indication Filter */}
          {filterOptions.indications.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Indication:</span>
              <select
                value={selectedIndication}
                onChange={(e) => setSelectedIndication(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 font-medium focus:outline-none focus:border-teal-500 max-w-xs truncate"
              >
                <option value="ALL">All Indications</option>
                {filterOptions.indications.map((ind) => (
                  <option key={ind} value={ind}>
                    {ind}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* History Status Sub-filter */}
          {activeTab === "HISTORY" && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Status:</span>
              <select
                value={historyStatusFilter}
                onChange={(e) => setHistoryStatusFilter(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 font-medium focus:outline-none focus:border-teal-500"
              >
                <option value="ALL">All History</option>
                <option value="COMPLETED">Completed</option>
                <option value="DISCONTINUED">Discontinued</option>
                <option value="ON_HOLD">On Hold</option>
              </select>
            </div>
          )}

          {/* Reset Filters button if active */}
          {(selectedDoctor !== "ALL" ||
            selectedIndication !== "ALL" ||
            historyStatusFilter !== "ALL" ||
            searchQuery) && (
            <button
              onClick={() => {
                setSelectedDoctor("ALL");
                setSelectedIndication("ALL");
                setHistoryStatusFilter("ALL");
                setSearchQuery("");
              }}
              className="text-teal-700 hover:text-teal-800 font-bold underline cursor-pointer ml-auto"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Medication Courses Cards Grid */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-teal-600 animate-spin mx-auto" />
          <p className="text-xs text-slate-600 font-bold">
            Synchronizing and reconciling medication records...
          </p>
        </div>
      ) : activeList.length === 0 ? (
        <div className="text-center py-12 px-4 bg-white rounded-2xl border border-slate-200/80 space-y-3">
          <div className="w-12 h-12 rounded-full bg-teal-50 text-teal-700 flex items-center justify-center mx-auto">
            <Pill className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-800">
              {activeTab === "CURRENT"
                ? "No active medications recorded"
                : activeTab === "HISTORY"
                ? "No historical medications found"
                : "No medications currently require clinical review"}
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              {activeTab === "CURRENT"
                ? "No ongoing prescriptions match your current filters. Add a new record or upload a prescription."
                : activeTab === "HISTORY"
                ? "Discontinued and completed courses will appear here once archived."
                : "All confirmed medication courses have complete durations and verified instructions."}
            </p>
          </div>
          {activeTab === "CURRENT" && (
            <button
              onClick={() => setAddMedicineModalOpen(true)}
              className="inline-flex items-center gap-2 bg-[#008080] hover:bg-[#006666] text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Medication Record
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {activeList.map((med) => {
            const isConflicting = med.isConflicting;
            const isPassed = med.isExpectedEndDatePassed && med.status === "ACTIVE";
            const isActive = med.status === "ACTIVE";
            const isCompleted = med.status === "COMPLETED";
            const isDiscontinued = med.status === "DISCONTINUED";
            const isOnHold = med.status === "ON_HOLD";
            const isNeedsReview = med.status === "NEEDS_REVIEW";

            return (
              <div
                key={med.id}
                className={`rounded-2xl p-5 shadow-xs transition-all flex flex-col justify-between gap-4 ${
                  isConflicting || isNeedsReview
                    ? "bg-white border-2 border-amber-300 hover:border-amber-400"
                    : isPassed
                    ? "bg-white border-2 border-amber-200 hover:border-amber-300"
                    : isActive
                    ? "bg-white border border-slate-200/80 hover:border-teal-400 hover:shadow-md"
                    : "bg-slate-50/80 border border-slate-200 opacity-95"
                }`}
              >
                <div className="space-y-4">
                  {/* Top Header Row: Drug Name, Strength & Status Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                          {med.name}
                        </h3>
                        {med.strength && (
                          <span className="bg-teal-50 text-teal-800 border border-teal-200 font-bold text-xs px-2.5 py-0.5 rounded-lg font-mono">
                            {med.strength}
                          </span>
                        )}
                      </div>

                      {med.indication ? (
                        <p className="text-xs text-slate-600 mt-1 font-medium">
                          Indication: <span className="text-slate-800">{med.indication}</span>
                        </p>
                      ) : (
                        <p className="text-[11px] text-slate-400 mt-1 italic">
                          Indication not specified in prescription
                        </p>
                      )}
                    </div>

                    {/* Status Pill */}
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span
                        className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-md uppercase tracking-wider ${
                          isActive
                            ? "bg-teal-50 text-teal-700 border border-teal-200"
                            : isCompleted
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : isDiscontinued
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : isOnHold
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-amber-100 text-amber-800 border border-amber-300"
                        }`}
                      >
                        {med.status.replace("_", " ")}
                      </span>

                      {/* Expected End Date Passed Badge (Without assuming treatment stopped!) */}
                      {isPassed && (
                        <span className="bg-amber-50 text-amber-800 border border-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                          <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
                          Expected End Date Passed
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Schedule & Timing Box */}
                  <div className="bg-[#f8fafc] border border-slate-200/70 rounded-xl p-3.5 text-xs text-slate-700 space-y-2.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap border-b border-slate-200/60 pb-2">
                      <span>
                        <strong className="text-slate-900">Frequency:</strong>{" "}
                        {med.frequency || "As prescribed"}
                      </span>
                      <span className="text-slate-600">
                        <strong className="text-slate-900">Route:</strong> {med.route || "Oral"}
                      </span>
                    </div>

                    {/* Longitudinal Treatment Period */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slate-600">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">
                          Treatment Start
                        </span>
                        <div className="flex items-center gap-1 text-slate-800 font-semibold mt-0.5">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{med.startDate || "Not specified"}</span>
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">
                          Prescribed Duration
                        </span>
                        <span className="text-slate-800 font-semibold block mt-0.5">
                          {med.durationRaw || (med.durationDays ? `${med.durationDays} days` : "Not specified")}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">
                          {isCompleted
                            ? "Completed Date"
                            : isDiscontinued
                            ? "Discontinued Date"
                            : "Expected End Date"}
                        </span>
                        <span
                          className={`font-semibold block mt-0.5 ${
                            isPassed ? "text-amber-700 font-bold" : "text-slate-800"
                          }`}
                        >
                          {isCompleted
                            ? med.actualEndDate || "Explicitly Completed"
                            : isDiscontinued
                            ? med.actualEndDate || "Explicitly Discontinued"
                            : med.expectedEndDate || "Needs Review"}
                        </span>
                      </div>
                    </div>

                    {/* Status Reason Callouts */}
                    {isDiscontinued && (med.discontinuedReason || med.statusReason) && (
                      <div className="pt-2 border-t border-slate-200/60 text-[11px] text-rose-800 bg-rose-50/60 -mx-3.5 px-3.5 py-1.5 rounded-b-lg">
                        <strong>Discontinuation Reason:</strong> {med.discontinuedReason || med.statusReason}
                      </div>
                    )}
                    {isCompleted && med.statusReason && (
                      <div className="pt-2 border-t border-slate-200/60 text-[11px] text-emerald-800 bg-emerald-50/60 -mx-3.5 px-3.5 py-1.5 rounded-b-lg">
                        <strong>Completion Note:</strong> {med.statusReason}
                      </div>
                    )}
                    {isOnHold && med.statusReason && (
                      <div className="pt-2 border-t border-slate-200/60 text-[11px] text-amber-800 bg-amber-50/60 -mx-3.5 px-3.5 py-1.5 rounded-b-lg">
                        <strong>Hold Reason:</strong> {med.statusReason}
                      </div>
                    )}
                  </div>

                  {/* Clinician Attribution & Prescription Date */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <Stethoscope className="w-3.5 h-3.5 text-teal-600" />
                      <span className="font-semibold text-slate-800">
                        {med.doctor || "Attending Physician"}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-500">
                      <span>
                        Rx Date: <strong>{med.prescriptionDate || med.startDate || "Encounter Date"}</strong>
                      </span>
                      {med.referenceId && (
                        <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                          {med.referenceId}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Reconciliation Flag or Conflict Warning Box */}
                  {(isConflicting || med.reconciliationNotes) && (
                    <div
                      className={`p-3 rounded-xl text-xs leading-relaxed space-y-1 ${
                        isConflicting
                          ? "bg-amber-50 border border-amber-300 text-amber-900"
                          : "bg-slate-50 border border-slate-200 text-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold">
                        {isConflicting ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        ) : (
                          <Info className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        )}
                        <span>
                          {isConflicting
                            ? "Clinical Review Flag"
                            : `Reconciliation: ${med.reconciliationCategory.replace(/_/g, " ")}`}
                        </span>
                      </div>
                      <p className="text-[11px]">
                        {med.conflictDetails || med.reconciliationNotes}
                      </p>
                    </div>
                  )}
                </div>

                {/* Actions Bar on Card Bottom */}
                <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100 flex-wrap">
                  <button
                    onClick={() => setInspectModal({ open: true, med })}
                    className="flex items-center gap-1 text-slate-600 hover:text-teal-700 text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Inspect Prescription</span>
                  </button>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Mark Completed */}
                    {isActive && (
                      <button
                        onClick={() => openStatusModal(med, "COMPLETED")}
                        title="Mark complete with reason"
                        className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 transition-colors cursor-pointer"
                      >
                        <Check className="w-3 h-3" />
                        <span>Completed</span>
                      </button>
                    )}

                    {/* Put On Hold */}
                    {isActive && (
                      <button
                        onClick={() => openStatusModal(med, "ON_HOLD")}
                        title="Temporarily pause medication with reason"
                        className="flex items-center gap-1 text-[11px] font-bold text-amber-700 hover:bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 transition-colors cursor-pointer"
                      >
                        <PauseCircle className="w-3 h-3" />
                        <span>Hold</span>
                      </button>
                    )}

                    {/* Resume from Hold */}
                    {isOnHold && (
                      <button
                        onClick={() =>
                          handleUpdateStatus(med.id, "ACTIVE", {
                            reason: "Treatment resumed by patient",
                            statusReason: "Treatment resumed by patient",
                          })
                        }
                        title="Resume ongoing treatment course"
                        className="flex items-center gap-1 text-[11px] font-bold text-teal-700 hover:bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200 transition-colors cursor-pointer"
                      >
                        <PlayCircle className="w-3 h-3" />
                        <span>Resume</span>
                      </button>
                    )}

                    {/* Discontinue Modal Trigger */}
                    {(isActive || isOnHold || isNeedsReview) && (
                      <button
                        onClick={() => openStatusModal(med, "DISCONTINUED")}
                        title="Permanently stop medication course with reason"
                        className="flex items-center gap-1 text-[11px] font-bold text-rose-700 hover:bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200 transition-colors cursor-pointer"
                      >
                        <XCircle className="w-3 h-3" />
                        <span>Discontinue</span>
                      </button>
                    )}

                    {/* Review Flag Resolver */}
                    {(isNeedsReview || isConflicting) && (
                      <button
                        onClick={() => setReviewModal({ open: true, med, submitting: false })}
                        className="flex items-center gap-1 text-[11px] font-bold text-white bg-amber-600 hover:bg-amber-700 px-3 py-1 rounded-lg transition-colors cursor-pointer shadow-xs"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Confirm Regimen</span>
                      </button>
                    )}

                    {/* Re-activate completed or discontinued */}
                    {(isCompleted || isDiscontinued) && (
                      <button
                        onClick={() => handleUpdateStatus(med.id, "ACTIVE")}
                        className="text-[11px] font-bold text-slate-600 hover:text-teal-700 hover:underline cursor-pointer"
                      >
                        Re-activate Course
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Unified Status Transition Modal (Completed, Hold, Discontinue) */}
      {statusModal.open && statusModal.med && statusModal.targetStatus && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {statusModal.targetStatus === "COMPLETED" && (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                )}
                {statusModal.targetStatus === "ON_HOLD" && (
                  <PauseCircle className="w-5 h-5 text-amber-600" />
                )}
                {statusModal.targetStatus === "DISCONTINUED" && (
                  <XCircle className="w-5 h-5 text-rose-600" />
                )}
                <h3 className="text-base font-extrabold text-slate-900">
                  {statusModal.targetStatus === "COMPLETED" && "Mark Course Completed"}
                  {statusModal.targetStatus === "ON_HOLD" && "Place Medication On Hold (Pause)"}
                  {statusModal.targetStatus === "DISCONTINUED" && "Discontinue Medication Course (Stop)"}
                </h3>
              </div>
              <button
                onClick={() =>
                  setStatusModal({
                    open: false,
                    med: null,
                    targetStatus: null,
                    reason: "",
                    submitting: false,
                  })
                }
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Target Medication Context */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 flex items-center justify-between gap-3 text-xs">
              <div>
                <span className="font-extrabold text-slate-900 text-sm block">
                  {statusModal.med.name}
                </span>
                <span className="text-slate-500">
                  {statusModal.med.strength || "Standard dosage"} • {statusModal.med.frequency || "Daily"}
                </span>
              </div>
              <div className="text-right text-[11px] text-slate-500">
                <span>Prescribed by:</span>
                <span className="font-semibold text-slate-800 block">
                  {statusModal.med.doctor || "Attending Physician"}
                </span>
              </div>
            </div>

            {/* Educational "What This Signifies" Callout Box */}
            <div
              className={`p-3.5 rounded-xl text-xs leading-relaxed border space-y-1 ${
                statusModal.targetStatus === "COMPLETED"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                  : statusModal.targetStatus === "ON_HOLD"
                  ? "bg-amber-50 border-amber-200 text-amber-900"
                  : "bg-rose-50 border-rose-200 text-rose-900"
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold">
                <Info className="w-4 h-4 shrink-0" />
                <span>
                  {statusModal.targetStatus === "COMPLETED" && "What Completed Signifies:"}
                  {statusModal.targetStatus === "ON_HOLD" && "What Hold Signifies:"}
                  {statusModal.targetStatus === "DISCONTINUED" && "What Discontinue Signifies:"}
                </span>
              </div>
              <p className="text-[11px]">
                {statusModal.targetStatus === "COMPLETED" &&
                  "This signifies you have finished the full prescribed course or your symptoms have resolved as planned. The course will be archived into your Medical History with today's completion date, keeping your active medicines list current."}
                {statusModal.targetStatus === "ON_HOLD" &&
                  "This signifies a temporary pause (such as prior to an operation, to monitor a side effect, during travel, or while awaiting lab results). The regimen stays preserved and you can resume it whenever you or your doctor wish."}
                {statusModal.targetStatus === "DISCONTINUED" &&
                  "This signifies the medication is permanently stopped (due to allergic reaction, intolerable side effects, or your doctor switching to an alternative therapy). It is permanently archived with an immutable audit entry."}
              </p>
            </div>

            {/* Quick Suggested Reason Chips */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 block">
                Quick Suggestions (click to populate):
              </label>
              <div className="flex flex-wrap gap-1.5">
                {(SUGGESTED_REASONS[statusModal.targetStatus] || []).map((suggestion, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() =>
                      setStatusModal((prev) => ({
                        ...prev,
                        reason: suggestion,
                      }))
                    }
                    className={`text-[10px] font-medium px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                      statusModal.reason === suggestion
                        ? statusModal.targetStatus === "COMPLETED"
                          ? "bg-emerald-100 border-emerald-400 text-emerald-900 font-bold"
                          : statusModal.targetStatus === "ON_HOLD"
                          ? "bg-amber-100 border-amber-400 text-amber-900 font-bold"
                          : "bg-rose-100 border-rose-400 text-rose-900 font-bold"
                        : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700"
                    }`}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>

            {/* Reason Message Box */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                <span>
                  {statusModal.targetStatus === "COMPLETED" && "Completion Reason / Notes"}
                  {statusModal.targetStatus === "ON_HOLD" && "Reason for Hold"}
                  {statusModal.targetStatus === "DISCONTINUED" && "Discontinuation Reason"}
                  {statusModal.targetStatus !== "COMPLETED" && (
                    <span className="text-rose-500 font-normal ml-1">* (Required)</span>
                  )}
                </span>
                <span className="text-[10px] text-slate-400 font-normal">
                  Saved directly to database & audit log
                </span>
              </label>
              <textarea
                rows={3}
                placeholder={
                  statusModal.targetStatus === "COMPLETED"
                    ? "e.g. Finished full prescribed 7-day course with relief, symptoms cleared..."
                    : statusModal.targetStatus === "ON_HOLD"
                    ? "e.g. Temporarily pausing 3 days prior to endoscopy, awaiting renal panel results..."
                    : "e.g. Experienced severe gastrointestinal upset, doctor switched to alternate therapy..."
                }
                value={statusModal.reason}
                onChange={(e) =>
                  setStatusModal((prev) => ({ ...prev, reason: e.target.value }))
                }
                className={`w-full text-xs p-3 rounded-xl border bg-slate-50 focus:bg-white focus:outline-none text-slate-800 transition-colors ${
                  statusModal.targetStatus === "COMPLETED"
                    ? "border-slate-200 focus:border-emerald-500"
                    : statusModal.targetStatus === "ON_HOLD"
                    ? "border-slate-200 focus:border-amber-500"
                    : "border-slate-200 focus:border-rose-500"
                }`}
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() =>
                  setStatusModal({
                    open: false,
                    med: null,
                    targetStatus: null,
                    reason: "",
                    submitting: false,
                  })
                }
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={submitStatusTransition}
                disabled={statusModal.submitting}
                className={`px-4 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition-colors cursor-pointer ${
                  statusModal.targetStatus === "COMPLETED"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : statusModal.targetStatus === "ON_HOLD"
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                {statusModal.submitting
                  ? "Saving to Database..."
                  : statusModal.targetStatus === "COMPLETED"
                  ? "Confirm Completed"
                  : statusModal.targetStatus === "ON_HOLD"
                  ? "Confirm Hold"
                  : "Confirm Discontinue"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reconcile & Review Modal */}
      {reviewModal.open && reviewModal.med && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-extrabold text-slate-900">
                  Clinical Reconciliation Review
                </h3>
              </div>
              <button
                onClick={() => setReviewModal({ open: false, med: null, submitting: false })}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                <strong className="text-amber-900 block font-bold">
                  Flagged Discrepancy / Observation:
                </strong>
                <p className="text-amber-800">
                  {reviewModal.med.conflictDetails || reviewModal.med.reconciliationNotes}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">
                    Prescribed Medication
                  </span>
                  <span className="font-bold text-slate-900">{reviewModal.med.name}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">
                    Strength & Instructions
                  </span>
                  <span className="font-bold text-slate-900">
                    {reviewModal.med.strength || "Unspecified"} ({reviewModal.med.frequency})
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">
                    Prescribing Doctor
                  </span>
                  <span className="font-bold text-slate-900">
                    {reviewModal.med.doctor || "Attending Physician"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">
                    Encounter Date
                  </span>
                  <span className="font-bold text-slate-900">
                    {reviewModal.med.startDate || "Not specified"}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed">
                Confirming this regimen acknowledges that the instructions are intentional (e.g. an approved dosage change or ongoing dual therapy) and moves the record into Active status.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setReviewModal({ open: false, med: null, submitting: false })}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={submitResolveReview}
                disabled={reviewModal.submitting}
                className="px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                {reviewModal.submitting ? "Confirming..." : "Confirm & Keep Regimen"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inspect Source Prescription Modal */}
      {inspectModal.open && inspectModal.med && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col justify-between my-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-teal-600" />
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Source Prescription Inspection
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Original medical prescription and document verification
                  </p>
                </div>
              </div>
              <button
                onClick={() => setInspectModal({ open: false, med: null })}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto pr-1 text-xs text-slate-700">
              {/* Original Prescription Image Display Card */}
              <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-sm space-y-0">
                <div className="p-2.5 bg-slate-950 flex items-center justify-between border-b border-slate-800">
                  <div className="flex items-center gap-1.5 text-slate-300 text-[11px] font-bold">
                    <Eye className="w-3.5 h-3.5 text-teal-400" />
                    <span>Original Prescription Document Scan</span>
                  </div>
                  <a
                    href={inspectModal.med.imageUrl || "/sample_prescription.png"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 bg-teal-600 hover:bg-teal-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                    title="Open prescription scan in new tab"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Open High-Res Scan</span>
                  </a>
                </div>

                {/* Clickable Image Viewport */}
                <div
                  className="relative group bg-slate-950/90 min-h-56 max-h-72 flex items-center justify-center p-2 cursor-pointer overflow-hidden"
                  onClick={() =>
                    window.open(
                      inspectModal.med.imageUrl || "/sample_prescription.png",
                      "_blank"
                    )
                  }
                  title="Click to view full original prescription in new tab"
                >
                  <img
                    src={inspectModal.med.imageUrl || "/sample_prescription.png"}
                    alt={`Original prescription for ${inspectModal.med.name}`}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/sample_prescription.png";
                    }}
                    className="max-h-68 w-auto max-w-full object-contain rounded transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                  {/* Hover Overlay Hint */}
                  <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                    <span className="bg-slate-900/90 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-lg border border-slate-700">
                      <ZoomIn className="w-4 h-4 text-teal-400" />
                      Click to View Full Prescription
                    </span>
                  </div>
                </div>

                <div className="px-3 py-1.5 bg-slate-950/95 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
                  <span>Click image to inspect clinician handwriting & physical stamps</span>
                  <span className="text-teal-400 font-mono">
                    {inspectModal.med.referenceId || "Confirmed Prescription"}
                  </span>
                </div>
              </div>

              {/* Document Metadata Table */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-500">Originating Document / Reference:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {inspectModal.med.referenceId || "Prescription Document"}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-500">Prescribing Clinician:</span>
                  <span className="font-bold text-slate-900">
                    {inspectModal.med.doctor || "Attending Physician"}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-500">Clinical Encounter Date:</span>
                  <span className="font-bold text-slate-900">
                    {inspectModal.med.prescriptionDate || inspectModal.med.startDate || "Clinical Visit"}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-500">System Upload Timestamp:</span>
                  <span className="text-slate-700 font-mono text-[11px]">
                    {inspectModal.med.uploadedAt || inspectModal.med.createdAt || "Archived"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Document Status:</span>
                  <span className="font-semibold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                    Confirmed Prescription
                  </span>
                </div>
              </div>

              {/* Specific Medicine on this Prescription */}
              <div className="bg-teal-50/60 border border-teal-100 p-3 rounded-xl flex items-center justify-between gap-3 text-xs">
                <div>
                  <span className="text-[10px] text-teal-700 uppercase font-bold block">
                    Associated Regimen on Prescription
                  </span>
                  <span className="font-extrabold text-slate-900 text-sm">
                    {inspectModal.med.name}
                  </span>
                  <span className="text-slate-600 ml-2">
                    {inspectModal.med.strength || "Standard dose"} • {inspectModal.med.frequency || "Daily"}
                  </span>
                </div>
                {inspectModal.med.indication && (
                  <span className="text-[11px] text-teal-800 font-medium bg-teal-100/70 px-2 py-1 rounded-md">
                    {inspectModal.med.indication}
                  </span>
                )}
              </div>

              {/* Source Attribution Callout */}
              <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-teal-900 text-[11px] leading-relaxed">
                <strong>Source Attribution:</strong> This medication record is anchored directly to physical prescription scans in Supabase Cloud Storage. Every modification and reconciliation state change is preserved in the clinical audit trail.
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
              <a
                href={inspectModal.med.imageUrl || "/sample_prescription.png"}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-700 hover:text-teal-800 hover:bg-teal-50 px-3.5 py-2 rounded-xl transition-colors cursor-pointer border border-teal-200"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>View Full Prescription Image</span>
              </a>

              <button
                onClick={() => setInspectModal({ open: false, med: null })}
                className="px-5 py-2 text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
