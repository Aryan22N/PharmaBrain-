"use client";

import React from "react";
import {
  Database,
  Building2,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  Activity,
  Layers,
} from "lucide-react";
import { usePatientDashboard } from "@/app/patient/context";

export default function HmsIntegrationPage() {
  const { metrics, refresh } = usePatientDashboard();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Database className="w-5 h-5 text-[#008080]" />
            <h2 className="text-xl font-extrabold text-slate-900">
              Hospital Information System (HMS) Integration
            </h2>
          </div>
          <p className="text-xs text-slate-500">
            Real-time HL7 FHIR bidirectional telemetry bridge with primary healthcare centers and hospital EHRs.
          </p>
        </div>

        <button
          onClick={refresh}
          className="flex items-center gap-2 bg-[#008080] hover:bg-[#006666] text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs transition-colors shrink-0 cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          Synchronize Now
        </button>
      </div>

      {/* Connected Nodes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Connected
            </span>
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-900">City Care Medical Centre</h3>
            <p className="text-[11px] text-slate-500 font-mono mt-0.5">HMS Endpoint: hms.citycare.org</p>
          </div>

          <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 space-y-1">
            <div>
              Protocol: <span className="font-semibold text-slate-700">HL7 FHIR R4 (Encrypted)</span>
            </div>
            <div>
              Verified Records:{" "}
              <span className="font-semibold text-teal-700">{metrics.hospitalVerified} documents</span>
            </div>
            <div>
              Last Sync:{" "}
              <span className="font-semibold text-slate-700">10 mins ago (Automatic)</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Active
            </span>
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-900">Supabase PostgreSQL EHR</h3>
            <p className="text-[11px] text-slate-500 font-mono mt-0.5">Database: Postgres 15 Telemetry</p>
          </div>

          <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 space-y-1">
            <div>
              Tables: <span className="font-semibold text-slate-700">User, Document, Analysis, Timeline, Medicine</span>
            </div>
            <div>
              Total Unified Records:{" "}
              <span className="font-semibold text-teal-700">{metrics.totalRecords} records</span>
            </div>
            <div>
              Reconciliation:{" "}
              <span className="font-semibold text-emerald-700">Priority Ranked</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              Verified
            </span>
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-900">PaddleOCR Engine</h3>
            <p className="text-[11px] text-slate-500 font-mono mt-0.5">Pipeline: PaddleOCR + LLM</p>
          </div>

          <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 space-y-1">
            <div>
              Line Detection: <span className="font-semibold text-slate-700">Sub-millimeter bounding box</span>
            </div>
            <div>
              Extraction Latency:{" "}
              <span className="font-semibold text-slate-700">~1.2 seconds</span>
            </div>
            <div>
              Safety Gating:{" "}
              <span className="font-semibold text-teal-700">Rule-based validation</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
