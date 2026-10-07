import React from "react";
import { VitalRecord } from "@/lib/types";
import { Activity, Heart, Thermometer, Wind, Weight, Droplets, AlertTriangle } from "lucide-react";
import { FieldFlagBadge } from "./StatusBadge";

export function VitalsDisplay({ vitals }: { vitals: VitalRecord[] }) {
  if (!vitals || vitals.length === 0) {
    return (
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-xs">
        No vital signs or clinical measurements recorded on this prescription.
      </div>
    );
  }

  const getVitalIcon = (name: string, kind?: string) => {
    const k = (kind || name || "").toLowerCase();
    if (k.includes("bp") || k.includes("blood pressure")) return Heart;
    if (k.includes("sugar") || k.includes("glucose") || k.includes("hba1c") || k.includes("fbs")) return Droplets;
    if (k.includes("pulse") || k.includes("heart rate") || k.includes("pr") || k.includes("hr")) return Activity;
    if (k.includes("temp")) return Thermometer;
    if (k.includes("spo2") || k.includes("oxygen")) return Wind;
    if (k.includes("weight") || k.includes("wt")) return Weight;
    return Activity;
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {vitals.map((v, i) => {
        const Icon = getVitalIcon(v.name, v.kind);
        const hasIssue = v.flag === "check" || v.flag === "low";
        const parsed = v.parsed || {};

        return (
          <div
            key={i}
            className={`p-3.5 rounded-xl border transition-all ${
              hasIssue
                ? "bg-amber-50/80 border-amber-200 text-amber-900"
                : "bg-slate-50/80 border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex items-center justify-between text-xs mb-1.5">
              <div className="flex items-center gap-1.5 text-slate-600 font-semibold">
                <Icon className={`w-4 h-4 ${hasIssue ? "text-amber-600" : "text-teal-600"}`} />
                <span className="capitalize">{v.name}</span>
              </div>
              <FieldFlagBadge flag={v.flag} conf={v.conf} />
            </div>

            <div className="text-base font-bold text-slate-900 font-mono">
              {v.value || "—"}
            </div>

            {parsed.error && (
              <div className="mt-1 text-[11px] text-amber-700 flex items-center gap-1 font-medium">
                <AlertTriangle className="w-3 h-3 shrink-0 text-amber-600" />
                <span>{parsed.error}</span>
              </div>
            )}

            {parsed.systolic && parsed.diastolic && (
              <div className="mt-1 text-[11px] text-slate-500 font-mono">
                {parsed.systolic} / {parsed.diastolic} {parsed.unit || "mmHg"}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

