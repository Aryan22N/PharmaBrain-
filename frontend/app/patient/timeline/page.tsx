"use client";

import React, { useState } from "react";
import {
  Clock,
  Plus,
  AlertTriangle,
  Search,
  X,
  Filter,
  Building2,
  Stethoscope,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  FileText,
  Activity,
  Pill,
} from "lucide-react";
import { usePatientDashboard } from "@/app/patient/context";

export default function MedicalTimelinePage() {
  const { timelineEvents, setAddTimelineModalOpen } = usePatientDashboard();

  // Filters
  const [timelineSearch, setTimelineSearch] = useState<string>("" );
  const [timelineSourceFilter, setTimelineSourceFilter] = useState<string>("ALL");
  const [timelineCategoryFilter, setTimelineCategoryFilter] = useState<string>("ALL");

  const filteredTimeline = timelineEvents.filter((ev) => {
    if (timelineSourceFilter !== "ALL" && ev.source !== timelineSourceFilter) {
      return false;
    }
    if (timelineCategoryFilter !== "ALL" && ev.category !== timelineCategoryFilter) {
      return false;
    }
    if (timelineSearch.trim()) {
      const q = timelineSearch.toLowerCase();
      const titleMatch = ev.title?.toLowerCase().includes(q);
      const descMatch = ev.description?.toLowerCase().includes(q);
      const docMatch = ev.doctor?.toLowerCase().includes(q);
      const facMatch = ev.facility?.toLowerCase().includes(q);
      const refMatch = ev.reference_id?.toLowerCase().includes(q);
      return titleMatch || descMatch || docMatch || facMatch || refMatch;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Longitudinal Medical Timeline
            </h2>
            <span className="bg-[#ccfbf1]/80 text-[#0f766e] text-xs font-bold px-3 py-1 rounded-full border border-[#99f6e4]">
              2019 – October 2026
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Chronological audit trail with independent Source, Reliability, and Verification classifications.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-slate-600 bg-slate-50 border border-slate-200 px-3.5 py-1.5 rounded-xl font-medium shadow-2xs">
            Showing <strong className="text-slate-900 font-bold">{filteredTimeline.length}</strong> of{" "}
            <strong className="text-slate-900 font-bold">{timelineEvents.length}</strong> records
          </span>
          <button
            onClick={() => setAddTimelineModalOpen(true)}
            className="flex items-center gap-1.5 bg-[#008080] hover:bg-[#006666] text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Add Note</span>
          </button>
        </div>
      </div>

      {/* Active Clinical Discrepancy Flagged Callout Banner */}
      {timelineEvents.some((ev) => ev.is_conflicting) && (
        <div className="bg-[#fffbeb] border border-[#fde68a] p-5 rounded-2xl space-y-2 shadow-xs">
          <div className="flex items-center gap-2.5 flex-wrap">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <span className="font-extrabold text-slate-900 text-sm sm:text-base tracking-tight">
              Active Clinical Discrepancy Flagged
            </span>
            <span className="bg-[#fef3c7] text-[#b45309] text-[10px] font-extrabold px-2.5 py-0.5 rounded-md border border-amber-300 tracking-wider">
              SAFETY PRIORITY
            </span>
          </div>
          <p className="text-xs text-slate-700 leading-relaxed">
            Conflicting information detected — Hospital HMS record is shown as the higher-priority source. The patient-entered record has been retained for history.
          </p>
          <p className="text-xs font-semibold text-amber-900">
            HMS Reference: Metformin 500 mg BID (10 Sep 2026) vs Patient Self-Entry: Metformin 1000 mg (11 Sep 2026).
          </p>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={timelineSearch}
            onChange={(e) => setTimelineSearch(e.target.value)}
            placeholder="Search records by title, doctor, facility, or original reference..."
            className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500 focus:bg-white transition-all text-slate-800"
          />
          {timelineSearch && (
            <button
              onClick={() => setTimelineSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto shrink-0 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={timelineSourceFilter}
              onChange={(e) => setTimelineSourceFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 font-medium focus:outline-none focus:border-teal-500 cursor-pointer"
            >
              <option value="ALL">All Sources</option>
              <option value="Hospital HMS">Hospital HMS</option>
              <option value="Patient Scan">Patient Scan</option>
              <option value="Manual Entry">Manual Entry</option>
            </select>
          </div>

          <select
            value={timelineCategoryFilter}
            onChange={(e) => setTimelineCategoryFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 font-medium focus:outline-none focus:border-teal-500 cursor-pointer"
          >
            <option value="ALL">All Categories</option>
            <option value="Doctor Visit">Doctor Visit</option>
            <option value="Lab Report">Lab Report</option>
            <option value="Medication">Medication Order</option>
            <option value="Symptom Report">Symptom Report</option>
          </select>
        </div>
      </div>

      {/* Interactive Timeline List */}
      <div className="relative pl-6 md:pl-8 space-y-6 before:content-[''] before:absolute before:left-3 md:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
        {filteredTimeline.map((ev, idx) => {
          const isConflicting = ev.is_conflicting;
          const isHospital = ev.source === "Hospital HMS";
          const isPatient = ev.source === "Manual Entry" || ev.source === "Patient Scan";

          return (
            <div key={ev.id || idx} className="relative group">
              {/* Chronological node icon */}
              <div
                className={`absolute -left-[27px] md:-left-[31px] top-4 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                  isConflicting
                    ? "bg-amber-500 text-white border-amber-200 shadow-md ring-4 ring-amber-100"
                    : isHospital
                    ? "bg-[#0d9488] text-white border-teal-200 shadow-sm"
                    : "bg-white text-slate-600 border-slate-300"
                }`}
              >
                {ev.category === "Medication" ? (
                  <Pill className="w-3.5 h-3.5" />
                ) : ev.category === "Lab Report" ? (
                  <Activity className="w-3.5 h-3.5" />
                ) : (
                  <FileText className="w-3.5 h-3.5" />
                )}
              </div>

              {/* Event Card */}
              <div
                className={`rounded-2xl p-5 shadow-xs border transition-all ${
                  isConflicting
                    ? "bg-white border-2 border-amber-300 shadow-amber-50"
                    : "bg-white border-slate-200/80 hover:border-teal-400 hover:shadow-md"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-2.5">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono font-semibold text-slate-500 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {new Date(ev.event_date).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">
                        {ev.category}
                      </span>
                      {isConflicting && (
                        <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          Conflict Flagged
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-extrabold text-slate-900">{ev.title}</h3>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                        ev.verification_status === "Hospital Verified"
                          ? "bg-teal-50 text-teal-800 border-teal-200"
                          : "bg-slate-50 text-slate-600 border-slate-200"
                      }`}
                    >
                      {ev.verification_status || "Hospital Verified"}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        ev.reliability === "High"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {ev.reliability || "High"} Reliability
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  {ev.description}
                </p>

                {isConflicting && ev.conflict_details && (
                  <div className="mb-4 p-3 bg-[#fffbeb] border border-[#fde68a] rounded-xl text-xs text-amber-900 leading-relaxed">
                    <strong>Discrepancy Note:</strong> {ev.conflict_details}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="flex items-center gap-1 font-medium text-slate-700">
                      <Stethoscope className="w-3.5 h-3.5 text-teal-600" />
                      {ev.doctor || "Consulting Physician"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      {ev.facility || "City Care Medical Centre"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                      Source: {ev.source}
                    </span>
                    {ev.reference_id && (
                      <span className="text-[11px] font-mono text-slate-400">
                        Ref: {ev.reference_id}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
