import React from "react";
import { AlertTriangle, ShieldAlert } from "lucide-react";

export function MedicalDisclaimer({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs shadow-xs">
        <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600" />
        <span>
          <strong className="font-extrabold text-amber-950">Clinical Review Required:</strong> Unverified AI draft. An authorized medical professional must verify all medication names, strengths, and dosages before clinical use.
        </span>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start gap-3 shadow-xs">
      <div className="p-2 rounded-lg bg-amber-100 text-amber-700 shrink-0 mt-0.5">
        <AlertTriangle className="w-5 h-5" />
      </div>
      <div className="space-y-1">
        <h4 className="font-extrabold text-amber-950 text-xs tracking-wide uppercase">
          Clinical Review Required — Safety Notice
        </h4>
        <p className="text-xs text-amber-900 leading-relaxed">
          Unverified AI draft. An authorized medical professional must verify all medication names, strengths, and dosages before clinical use. Do not administer medication without direct verification against the original signed prescription.
        </p>
      </div>
    </div>
  );
}
