"use client";

import React, { useState } from "react";
import {
  AlertCircle,
  Plus,
  AlertTriangle,
  Calendar,
  Pill,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";
import { usePatientDashboard } from "@/app/patient/context";

export default function SymptomsPage() {
  const { setAddTimelineModalOpen } = usePatientDashboard();

  const symptoms = [
    {
      id: 1,
      name: "Mild Gastric Discomfort & Nausea",
      severity: "Mild",
      onset: "11 Sep 2026",
      associatedDrug: "Metformin 1000 mg (Patient self-entry)",
      notes: "Occurred following self-increased dose. Conflicted with 500 mg prescription order.",
      resolved: false,
    },
    {
      id: 2,
      name: "Occasional Lightheadedness",
      severity: "Mild",
      onset: "14 Aug 2026",
      associatedDrug: "Amlodipine / Telmisartan",
      notes: "Associated with post-exercise morning blood pressure drops (118/76 mmHg).",
      resolved: true,
    },
    {
      id: 3,
      name: "Muscle Soreness (Myalgia)",
      severity: "Minimal",
      onset: "02 Mar 2026",
      associatedDrug: "Atorvastatin 20 mg",
      notes: "Reported at evening follow-up. CK levels verified normal within range.",
      resolved: true,
    },
  ];

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

      {/* Discrepancy Insight */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 leading-relaxed">
          <strong>Pharmacovigilance Alert:</strong> Gastrointestinal discomfort was flagged shortly following the unverified 1000 mg Metformin intake note. Hospital HMS order prescribes 500 mg BID with meals to minimize GI side effects.
        </div>
      </div>

      {/* Symptoms Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {symptoms.map((sym) => (
          <div
            key={sym.id}
            className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3 hover:border-teal-400 transition-all"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-sm font-bold text-slate-900">{sym.name}</h3>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                  sym.resolved
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-amber-100 text-amber-900 border border-amber-300"
                }`}
              >
                {sym.resolved ? "Resolved" : "Active Observation"}
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">{sym.notes}</p>

            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <div className="flex items-center gap-1.5 font-medium text-slate-700">
                <Pill className="w-3.5 h-3.5 text-teal-600" />
                <span>{sym.associatedDrug}</span>
              </div>

              <div className="flex items-center gap-1 text-[11px]">
                <Calendar className="w-3 h-3 text-slate-400" />
                <span>Onset: {sym.onset}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
