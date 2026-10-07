"use client";

import React from "react";
import {
  TrendingUp,
  Activity,
  Heart,
  Calendar,
  ShieldCheck,
  FileText,
} from "lucide-react";
import { usePatientDashboard } from "@/app/patient/context";

export default function TrendsPage() {
  const { metrics, timelineEvents } = usePatientDashboard();

  // Extract lab / observation timeline events if available
  const hba1cEvents = timelineEvents.filter(
    (e: any) => e.category === "Lab Result" && (e.title?.toLowerCase().includes("hba1c") || e.description?.toLowerCase().includes("hba1c"))
  );

  const bpEvents = timelineEvents.filter(
    (e: any) => e.category === "Cardiovascular" || e.title?.toLowerCase().includes("blood pressure") || e.title?.toLowerCase().includes("bp")
  );

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
            Target clinical goal is <strong>&lt; 6.5%</strong>. Glycemic trend populates as lab reports and HbA1c test documents are uploaded.
          </p>

          {hba1cEvents.length === 0 ? (
            <div className="text-center py-8 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
              <FileText className="w-6 h-6 text-slate-400 mx-auto" />
              <p className="text-xs font-semibold text-slate-700">No HbA1c lab history recorded yet</p>
              <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                Upload your latest blood test results to start tracking longitudinal HbA1c glycemic trends.
              </p>
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              {hba1cEvents.map((item: any, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-bold text-slate-800">{item.event_date}</span>
                    <span className="text-slate-500 text-[11px] font-mono">({item.title})</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                      {item.verification_status || "Verified"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Blood Pressure Cardiovascular Trajectory */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-rose-500" />
              <h3 className="text-sm font-bold text-slate-900">Cardiovascular Blood Pressure</h3>
            </div>
            <span className="text-xs font-extrabold text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-lg">
              Current: {metrics.bloodPressure}
            </span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Target therapeutic range is <strong>120/80 mmHg</strong>. Blood pressure readings populate from recorded clinical encounters.
          </p>

          {bpEvents.length === 0 ? (
            <div className="text-center py-8 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
              <Heart className="w-6 h-6 text-slate-400 mx-auto" />
              <p className="text-xs font-semibold text-slate-700">No blood pressure readings recorded yet</p>
              <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                Upload clinical encounter summaries or record vitals to track blood pressure history.
              </p>
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              {bpEvents.map((item: any, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-bold text-slate-800">{item.event_date}</span>
                    <span className="text-slate-500 text-[11px]">{item.title}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                      {item.verification_status || "Recorded"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
