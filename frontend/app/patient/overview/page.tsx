"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  Info,
  Eye,
  FileImage,
  ShieldCheck,
  AlertTriangle,
  Upload,
  Calendar,
  Sparkles,
  FileText,
  Pill,
  Heart,
  CheckCircle2,
} from "lucide-react";
import { usePatientDashboard } from "@/app/patient/context";

export default function OverviewPage() {
  const router = useRouter();
  const { userData, metrics, documents, timelineEvents, recordedMedicines, setSelectedSummaryRecord } = usePatientDashboard();

  const userName = userData?.name || "Patient";
  const userEmail = userData?.email || "";
  const patientCode = userData?.patientId ?? userData?.patientCode ?? "";
  const legacyPatientCode = userData?.legacyPatientId ?? null;

  const conflictingItem = recordedMedicines.find((m: any) => m.is_conflicting) || timelineEvents.find((e: any) => e.is_conflicting);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h2 className="text-2xl font-extrabold text-slate-900">
              Welcome, {userName}
            </h2>
            {legacyPatientCode && (
              <span className="bg-slate-100 text-slate-600 text-[11px] font-medium px-2 py-0.5 rounded border border-slate-200 font-mono">
                Legacy: {legacyPatientCode}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Personal Medical Record • Longitudinal Care Summary
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => router.push("/upload")}
            className="flex items-center gap-2 bg-[#008080] hover:bg-[#006666] text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Upload className="w-4 h-4 stroke-[2.5]" />
            Upload Document
          </button>
        </div>
      </div>

      {/* Dynamic Alert Warning Box — Only shown if real conflicts exist */}
      {conflictingItem && (
        <div className="bg-[#fffbeb] border border-[#fef3c7] p-4 rounded-2xl flex items-start gap-3 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-[#b45309] shrink-0 mt-0.5" />
          <div className="flex-1 text-xs text-[#92400e]">
            <h3 className="font-bold text-[#b45309] mb-0.5">
              Conflicting Clinical Information Detected
            </h3>
            <p className="leading-relaxed">
              {conflictingItem.conflict_details || `A clinical conflict was detected for ${conflictingItem.name || conflictingItem.title}.`}
            </p>
          </div>
          <Link
            href="/patient/timeline"
            className="text-xs font-bold text-[#b45309] hover:underline flex items-center gap-1 shrink-0"
          >
            Review Discrepancy &rarr;
          </Link>
        </div>
      )}

      {/* 6 Key Dynamic Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* 1. Total Records */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold text-slate-500">Total Records</span>
            <FileText className="w-4 h-4 text-slate-400" />
          </div>
          <div>
            <span className="text-2xl font-extrabold text-slate-900">{metrics.totalRecords}</span>
            <p className="text-[10px] text-slate-400 mt-0.5">Across Patient EHR</p>
          </div>
        </div>

        {/* 2. Hospital Verified */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold text-slate-500">Hospital Verified</span>
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <span className="text-2xl font-extrabold text-slate-900">{metrics.hospitalVerified}</span>
            <p className="text-[10px] text-teal-600 font-medium mt-0.5">Verified EHR</p>
          </div>
        </div>

        {/* 3. Active Meds */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold text-slate-500">Active Meds</span>
            <Pill className="w-4 h-4 text-indigo-500" />
          </div>
          <div>
            <span className="text-2xl font-extrabold text-slate-900">{metrics.activeMeds}</span>
            <p className="text-[10px] text-slate-400 mt-0.5">Active therapies</p>
          </div>
        </div>

        {/* 4. Last HbA1c */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold text-slate-500">Last HbA1c</span>
            <Activity className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <span className="text-2xl font-extrabold text-slate-900">{metrics.lastHbA1c}</span>
            <p className="text-[10px] text-amber-600 font-medium mt-0.5">
              {metrics.lastHbA1c !== "--" ? "Latest result" : "No lab data"}
            </p>
          </div>
        </div>

        {/* 5. Blood Pressure */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold text-slate-500">Blood Pressure</span>
            <Heart className="w-4 h-4 text-rose-500" />
          </div>
          <div>
            <div className="text-lg font-extrabold text-slate-900 leading-tight">{metrics.bloodPressure}</div>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {metrics.bloodPressure !== "--" ? "Latest reading" : "No BP recorded"}
            </p>
          </div>
        </div>

        {/* 6. History Coverage */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold text-slate-500">History Coverage</span>
            <CheckCircle2 className="w-4 h-4 text-teal-500" />
          </div>
          <div>
            <span className="text-2xl font-extrabold text-slate-900">{metrics.historyCoverage}</span>
            <p className="text-[10px] text-teal-600 font-medium mt-0.5">
              {metrics.totalRecords > 0 ? "Coverage baseline" : "No records yet"}
            </p>
          </div>
        </div>
      </div>

      {/* Overview Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Longitudinal Care Summary & Saved Documents */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#008080]" />
              <h3 className="text-sm font-bold text-slate-900">
                Longitudinal Care Summary & Saved Documents
              </h3>
            </div>
            <span className="text-[11px] font-semibold text-slate-500">
              {documents.length} Records in EHR Database
            </span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Summary for patient <strong className="text-slate-800">{userName}</strong>{userEmail ? ` (${userEmail})` : ""}. Integrated with Supabase PostgreSQL and automated document OCR telemetry. Click any record to inspect details.
          </p>

          {/* Documents List or Clean Empty State */}
          {documents.length === 0 ? (
            <div className="text-center py-10 px-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 space-y-3">
              <div className="w-12 h-12 rounded-full bg-teal-50 text-teal-700 flex items-center justify-center mx-auto">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">No medical records uploaded yet</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                  Upload your paper prescriptions or lab reports to automatically extract structured clinical data with PaddleOCR.
                </p>
              </div>
              <button
                onClick={() => router.push("/upload")}
                className="inline-flex items-center gap-2 bg-[#008080] hover:bg-[#006666] text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                Upload First Document
              </button>
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              {documents.map((doc, idx) => {
                const docDate =
                  doc.structuredResult?.date_iso ||
                  new Date(doc.uploadedAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  });
                const meds = doc.structuredResult?.medicines || doc.medicines || [];

                return (
                  <div
                    key={doc.id || idx}
                    onClick={() => setSelectedSummaryRecord(doc)}
                    className="bg-slate-50/80 hover:bg-teal-50/40 p-4 rounded-xl border border-slate-200/80 hover:border-teal-400 hover:shadow-md cursor-pointer transition-all active:scale-[0.99] group flex flex-col md:flex-row md:items-center justify-between gap-4"
                    role="button"
                    tabIndex={0}
                    title="Click to view complete clinical summary"
                  >
                    <div className="flex items-start gap-3.5 overflow-hidden min-w-0">
                      <div className="w-12 h-12 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shrink-0 mt-0.5 group-hover:border-teal-400 transition-all shadow-2xs relative">
                        {doc.imageUrl ? (
                          <img
                            src={doc.imageUrl}
                            alt={doc.filename}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "/sample_prescription.png";
                            }}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400 bg-slate-100">
                            <FileImage className="w-5 h-5 text-slate-400" />
                          </div>
                        )}
                      </div>

                      <div className="overflow-hidden min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span className="text-xs font-bold text-slate-900 group-hover:text-teal-900 transition-colors truncate">
                            {doc.filename}
                          </span>
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                              doc.status === "CONFIRMED"
                                ? "bg-teal-50 text-teal-700 border-teal-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}
                          >
                            {doc.status === "CONFIRMED" ? "Hospital Verified" : "Draft Extraction"}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-500 truncate mb-1">
                          {doc.summary || doc.structuredResult?.summary || "Clinical encounter details recorded."}
                        </p>

                        <div className="flex items-center gap-3 text-[10px] text-slate-400">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            {docDate}
                          </span>
                          <span>•</span>
                          <span>
                            Facility:{" "}
                            <strong className="text-slate-600 font-semibold">
                              {doc.structuredResult?.hospital || "City Care Medical"}
                            </strong>
                          </span>
                          {meds.length > 0 && (
                            <>
                              <span>•</span>
                              <span className="text-teal-700 font-semibold">
                                {meds.length} Meds Extracted
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                      <span className="text-xs font-bold text-[#008080] group-hover:underline flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5" />
                        View Summary &rarr;
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: How Records Are Prioritized & Actions */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Info className="w-4 h-4 text-[#008080]" />
              <h3 className="text-sm font-bold text-slate-900">
                Deterministic Record Provenance
              </h3>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              To guarantee patient safety, this platform applies a clinical provenance hierarchy:
            </p>

            <div className="space-y-3">
              <div className="bg-sky-50/70 p-3.5 rounded-xl border border-sky-100 space-y-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-sky-900">1. Hospital HMS Records</h4>
                  <span className="bg-sky-200 text-sky-900 text-[10px] font-extrabold px-2 py-0.5 rounded uppercase">
                    Highest
                  </span>
                </div>
                <p className="text-[11px] text-sky-700 leading-relaxed">
                  Direct EHR/FHIR telemetry with cryptographic certificates. Takes priority in dose or medication conflicts.
                </p>
              </div>

              <div className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-100 space-y-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-amber-900">2. Patient Scanned Records</h4>
                  <span className="bg-amber-200 text-amber-900 text-[10px] font-extrabold px-2 py-0.5 rounded uppercase">
                    Medium
                  </span>
                </div>
                <p className="text-[11px] text-amber-700 leading-relaxed">
                  External clinic records, prescriptions, and lab printouts verified via PaddleOCR extraction engine.
                </p>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800">3. Manual Patient Entries</h4>
                  <span className="bg-slate-200 text-slate-800 text-[10px] font-extrabold px-2 py-0.5 rounded uppercase">
                    Low (History)
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Self-reported symptoms and notes. Maintained for clinical audit history without overriding doctor prescriptions.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Upload CTA */}
          <div className="bg-gradient-to-br from-[#0f766e] to-[#115e59] p-6 rounded-2xl text-white shadow-md space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-teal-200" />
              <h4 className="text-sm font-bold">Process New Medical Document</h4>
            </div>
            <p className="text-xs text-teal-100 leading-relaxed">
              Upload paper prescriptions, discharge summaries, or blood tests to extract structured data with PaddleOCR.
            </p>
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 bg-white text-[#0f766e] text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs hover:bg-teal-50 transition-colors"
            >
              <Upload className="w-4 h-4" />
              Upload Document Now
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
