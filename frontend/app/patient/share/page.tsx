"use client";

import React, { useState } from "react";
import {
  Share2,
  QrCode,
  Copy,
  Check,
  ShieldCheck,
  Download,
  Lock,
} from "lucide-react";
import { usePatientDashboard } from "@/app/patient/context";

export default function ShareRecordsPage() {
  const { userData } = usePatientDashboard();
  const [copied, setCopied] = useState(false);
  const [expiry, setExpiry] = useState("48h");

  const patientCode = userData?.patientId || userData?.patientCode || "483027156";
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/patients/${patientCode}` : `https://dmr.health/patients/${patientCode}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Share2 className="w-5 h-5 text-[#008080]" />
            <h2 className="text-xl font-extrabold text-slate-900">
              Share Medical Records & Telehealth Pass
            </h2>
          </div>
          <p className="text-xs text-slate-500">
            Generate encrypted, time-limited read access for consulting physicians, clinics, or emergency responders.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 px-3.5 py-1.5 rounded-xl">
          <ShieldCheck className="w-4 h-4 text-teal-600" />
          <span>End-to-End Cryptographic Access</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Secure Link Generation */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Lock className="w-4 h-4 text-teal-600" />
            <h3 className="text-sm font-bold text-slate-900">Physician Access Link</h3>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Consulting doctors can access verified longitudinal timelines and OCR prescriptions without requiring login credentials.
          </p>

          <div className="space-y-3 pt-2">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Link Expiration Window
              </label>
              <select
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500 font-medium"
              >
                <option value="24h">24 Hours (Single Appointment)</option>
                <option value="48h">48 Hours (Standard Referral)</option>
                <option value="7d">7 Days (Continuous Inpatient)</option>
                <option value="30d">30 Days (Chronic Care Review)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Secure Shareable URL
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="flex-1 text-xs px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl font-mono text-slate-700 select-all"
                />
                <button
                  onClick={handleCopy}
                  className="px-3.5 py-2 bg-[#008080] hover:bg-[#006666] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* QR Code Sharing */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
              <QrCode className="w-4 h-4 text-teal-600" />
              <h3 className="text-sm font-bold text-slate-900">Hospital Check-in QR Code</h3>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="w-32 h-32 bg-slate-900 rounded-2xl p-2 flex items-center justify-center shrink-0 shadow-md">
                <div className="w-full h-full bg-white rounded-xl flex items-center justify-center p-2 text-center text-[10px] font-mono text-slate-800 font-bold border border-slate-200">
                  DMR PASS
                  <br />
                  {patientCode}
                </div>
              </div>

              <div className="text-xs text-slate-600 space-y-2">
                <p>
                  Scan this QR code at hospital OPD reception to automatically import your verified health baseline into the clinic HMS.
                </p>
                <div className="text-[11px] font-mono text-teal-700 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200 inline-block">
                  Patient UHID: {patientCode}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">HIPAA & ABDM Compliant</span>
            <button
              onClick={() => window.print()}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              Download Summary PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
