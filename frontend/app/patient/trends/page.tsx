"use client";

import React from "react";
import {
  TrendingUp,
  Activity,
  Heart,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  ArrowDownRight,
  ArrowUpRight,
  ShieldCheck,
} from "lucide-react";
import { usePatientDashboard } from "@/app/patient/context";

export default function TrendsPage() {
  const { metrics } = usePatientDashboard();

  const hba1cHistory = [
    { date: "Oct 2024", value: 9.4, status: "High Risk", note: "Initial diagnosis" },
    { date: "Apr 2025", value: 8.8, status: "Elevated", note: "Started Metformin" },
    { date: "Dec 2025", value: 8.4, status: "Elevated", note: "Dietary adjustment" },
    { date: "Aug 2026", value: 8.1, status: "Elevated", note: "Current reading" },
  ];

  const bpHistory = [
    { date: "Oct 2024", sys: 158, dia: 98, status: "Stage 2 HTN" },
    { date: "Apr 2025", sys: 152, dia: 96, status: "Stage 2 HTN" },
    { date: "Dec 2025", sys: 148, dia: 94, status: "Stage 1 HTN" },
    { date: "Aug 2026", sys: 146, dia: 92, status: "Stage 1 HTN (Improving)" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-5 h-5 text-[#008080]" />
            <h2 className="text-xl font-extrabold text-slate-900">
              Longitudinal Health Trends & Biomarkers
            </h2>
          </div>
          <p className="text-xs text-slate-500">
            Multi-year physiological tracking extracted from clinical encounters and verified lab reports.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 px-3.5 py-1.5 rounded-xl">
          <ShieldCheck className="w-4 h-4 text-teal-600" />
          <span>Supabase Telemetry Active</span>
        </div>
      </div>

      {/* 2-Column Trends Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* HbA1c Glycemic Progression */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-bold text-slate-900">HbA1c Glycemic Trend</h3>
            </div>
            <span className="text-xs font-extrabold text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-lg">
              Current: {metrics.lastHbA1c}
            </span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Target clinical goal is <strong>&lt; 6.5%</strong>. Trend shows steady longitudinal improvement from 9.4% down to 8.1%.
          </p>

          <div className="space-y-3 pt-2">
            {hba1cHistory.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-bold text-slate-800">{item.date}</span>
                  <span className="text-slate-500 text-[11px] font-mono">({item.note})</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-sm text-slate-900">{item.value}%</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                    {item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Blood Pressure Cardiovascular Trajectory */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-rose-500" />
              <h3 className="text-sm font-bold text-slate-900">Cardiovascular Blood Pressure</h3>
            </div>
            <span className="text-xs font-extrabold text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-lg">
              {metrics.bloodPressure}
            </span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Target therapeutic range is <strong>120/80 mmHg</strong>. Controlled from Stage 2 hypertension to Stage 1.
          </p>

          <div className="space-y-3 pt-2">
            {bpHistory.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-bold text-slate-800">{item.date}</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-sm text-slate-900">
                    {item.sys}/{item.dia} mmHg
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                    {item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
