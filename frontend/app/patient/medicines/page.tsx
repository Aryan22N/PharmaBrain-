"use client";

import React, { useState } from "react";
import {
  Pill,
  Plus,
  AlertTriangle,
  Calendar,
  Stethoscope,
  Building2,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { usePatientDashboard } from "@/app/patient/context";

export default function MedicinesPage() {
  const { recordedMedicines, setAddMedicineModalOpen } = usePatientDashboard();
  const [medicinesTab, setMedicinesTab] = useState<"ACTIVE" | "ALL">("ACTIVE");

  const filteredMedicines = recordedMedicines.filter((m) =>
    medicinesTab === "ACTIVE" ? m.status === "ACTIVE" : true
  );

  const activeCount = recordedMedicines.filter((m) => m.status === "ACTIVE").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Current Recorded Medicines
            </h2>
            <span className="bg-[#ccfbf1]/80 text-[#0f766e] text-xs font-bold px-3 py-1 rounded-full border border-[#99f6e4]">
              {activeCount} Active Prescriptions
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Reconciled medication list with source attribution, prescribing physician, and original reference identifiers.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          {/* Active Regimen / All Historical toggle buttons */}
          <div className="bg-slate-100 p-1 rounded-xl border border-slate-200 flex items-center gap-1">
            <button
              onClick={() => setMedicinesTab("ACTIVE")}
              className={`px-3 py-1.5 text-xs rounded-lg transition-all cursor-pointer ${
                medicinesTab === "ACTIVE"
                  ? "bg-white text-slate-900 font-extrabold shadow-xs"
                  : "text-slate-600 hover:text-slate-900 font-medium"
              }`}
            >
              Active Regimen ({activeCount})
            </button>
            <button
              onClick={() => setMedicinesTab("ALL")}
              className={`px-3 py-1.5 text-xs rounded-lg transition-all cursor-pointer ${
                medicinesTab === "ALL"
                  ? "bg-white text-slate-900 font-extrabold shadow-xs"
                  : "text-slate-600 hover:text-slate-900 font-medium"
              }`}
            >
              All Historical ({recordedMedicines.length})
            </button>
          </div>

          <button
            onClick={() => setAddMedicineModalOpen(true)}
            className="flex items-center gap-1.5 bg-[#008080] hover:bg-[#006666] text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-xs transition-colors shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Add Medicine</span>
          </button>
        </div>
      </div>

      {/* Medication Dosage Discrepancy Flagged Callout Banner */}
      {recordedMedicines.some((m) => m.is_conflicting) && (
        <div className="bg-[#fffbeb] border border-[#fde68a] p-5 rounded-2xl space-y-1.5 shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <span className="font-extrabold text-slate-900 text-sm tracking-tight">
              Medication Dosage Discrepancy Flagged
            </span>
          </div>
          <p className="text-xs text-slate-700 leading-relaxed">
            Conflicting information detected — Hospital HMS record is shown as the higher-priority source. The patient-entered record has been retained for history.
          </p>
          <p className="text-xs font-semibold text-amber-900">
            Prescribed: Metformin 500 mg BID (Dr. Priya Deshmukh) vs Patient manual note: 1000 mg.
          </p>
        </div>
      )}

      {/* 2-Column Responsive Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {filteredMedicines.map((med, idx) => {
          const isConflicting = med.is_conflicting;
          const isActive = med.status === "ACTIVE";

          return (
            <div
              key={med.id || idx}
              className={`rounded-2xl p-5 shadow-xs transition-all space-y-4 ${
                isConflicting
                  ? "bg-white border-2 border-amber-300 hover:border-amber-400"
                  : isActive
                  ? "bg-white border border-slate-200/80 hover:border-teal-400 hover:shadow-md"
                  : "bg-slate-50/70 border border-slate-200 opacity-90"
              }`}
            >
              {/* Top Header Row */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-extrabold text-slate-900">
                      {med.name}
                    </h3>
                    {med.strength && (
                      <span className="bg-teal-50 text-teal-800 border border-teal-200 font-bold text-xs px-2.5 py-0.5 rounded-lg font-mono">
                        {med.strength}
                      </span>
                    )}
                  </div>
                  {med.indication && (
                    <p className="text-xs text-slate-500 mt-1">
                      {med.indication}
                    </p>
                  )}
                </div>

                <span
                  className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-md uppercase tracking-wider shrink-0 ${
                    isActive
                      ? "bg-teal-50 text-teal-700 border border-teal-200"
                      : "bg-slate-100 text-slate-600 border border-slate-200"
                  }`}
                >
                  {med.status}
                </span>
              </div>

              {/* Schedule Box */}
              <div className="bg-[#f8fafc] border border-slate-200/70 rounded-xl p-3 text-xs text-slate-700 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span>
                    <strong className="text-slate-800">Frequency:</strong> {med.frequency || "As prescribed"}
                  </span>
                  <span className="text-slate-500">
                    <strong className="text-slate-800">Route:</strong> {med.route || "Oral"}
                  </span>
                </div>
                {med.start_date && (
                  <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      Start Date: {new Date(med.start_date).toISOString().split("T")[0]}
                    </span>
                  </div>
                )}
              </div>

              {/* Prescribing Doctor & Reference */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                <div className="flex items-center gap-1.5">
                  <Stethoscope className="w-3.5 h-3.5 text-slate-400" />
                  <span>{med.doctor || "Attending Physician"}</span>
                </div>
                {med.reference_id && (
                  <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-500">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>{med.reference_id}</span>
                  </div>
                )}
              </div>

              {/* In-Card Discrepancy Callout if Conflicting */}
              {isConflicting && (
                <div className="p-3 bg-[#fffbeb] border border-[#fde68a] rounded-xl text-xs text-amber-900 leading-relaxed">
                  {med.conflict_details ||
                    "Conflicting information detected — Hospital HMS record is shown as the higher-priority source. The patient-entered record has been retained for history."}
                </div>
              )}

              {/* Provenance Pills */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200 px-2.5 py-0.5 rounded-lg">
                  <Building2 className="w-3 h-3 text-sky-600" />
                  {med.source || "Hospital HMS"}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-teal-50 text-teal-700 border border-teal-200 px-2.5 py-0.5 rounded-lg">
                  <ShieldCheck className="w-3 h-3 text-teal-600" />
                  Reliability: {med.reliability || "High"}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-teal-50 text-teal-700 border border-teal-200 px-2.5 py-0.5 rounded-lg">
                  <CheckCircle2 className="w-3 h-3 text-teal-600" />
                  {med.verification_status || "Hospital Verified"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
