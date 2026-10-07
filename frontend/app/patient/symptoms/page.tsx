"use client";

import React from "react";
import {
  AlertCircle,
  Plus,
  Calendar,
  Pill,
  ShieldAlert,
} from "lucide-react";
import { usePatientDashboard } from "@/app/patient/context";

export default function SymptomsPage() {
  const { timelineEvents, recordedMedicines, setAddTimelineModalOpen } = usePatientDashboard();

  const symptomEvents = timelineEvents.filter(
    (e: any) => e.category === "Symptom Report" || e.category?.toLowerCase().includes("symptom")
  );

  const conflictingItem = recordedMedicines.find((m: any) => m.is_conflicting) || timelineEvents.find((e: any) => e.is_conflicting);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="w-5 h-5 text-[#008080]" />
            <h2 className="text-xl font-extrabold text-slate-900">
              Symptoms & Adverse Side Effects Log
            </h2>
          </div>
          <p className="text-xs text-slate-500">
            Reconcile patient-reported side effects with prescribed pharmacotherapy and dosage changes.
          </p>
        </div>

        <button
          onClick={() => setAddTimelineModalOpen(true)}
          className="flex items-center gap-1.5 bg-[#008080] hover:bg-[#006666] text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs transition-colors shrink-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Report New Symptom</span>
        </button>
      </div>

      {/* Dynamic Discrepancy Insight — Only shown if real conflicts exist */}
      {conflictingItem && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 leading-relaxed">
            <strong>Pharmacovigilance Alert:</strong> {conflictingItem.conflict_details || `Clinical discrepancy flagged for ${conflictingItem.name || conflictingItem.title}.`}
          </div>
        </div>
      )}

      {/* Symptoms Cards Grid or Clean Empty State */}
      {symptomEvents.length === 0 ? (
        <div className="text-center py-12 px-4 bg-white rounded-2xl border border-slate-200/80 space-y-3">
          <div className="w-12 h-12 rounded-full bg-teal-50 text-teal-700 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-800">No Symptoms or Side Effects Logged</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              You haven't reported any adverse side effects or symptoms. Click below to log a new observation.
            </p>
          </div>
          <button
            onClick={() => setAddTimelineModalOpen(true)}
            className="inline-flex items-center gap-2 bg-[#008080] hover:bg-[#006666] text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Report New Symptom
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {symptomEvents.map((sym: any, idx: number) => (
            <div
              key={sym.id || idx}
              className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3 hover:border-teal-400 transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-bold text-slate-900">{sym.title}</h3>
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200"
                >
                  {sym.verification_status || "Patient Reported"}
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">{sym.description}</p>

              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <div className="flex items-center gap-1.5 font-medium text-slate-700">
                  <Pill className="w-3.5 h-3.5 text-teal-600" />
                  <span>{sym.source || "Manual Entry"}</span>
                </div>

                <div className="flex items-center gap-1 text-[11px]">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  <span>Date: {sym.event_date}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
