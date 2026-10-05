"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileCheck,
  Upload,
  Search,
  X,
  Filter,
  Eye,
  FileImage,
  ShieldCheck,
  AlertTriangle,
  Building2,
  Stethoscope,
  Sparkles,
  Calendar,
} from "lucide-react";
import { usePatientDashboard } from "@/app/patient/context";

export default function SummaryPage() {
  const router = useRouter();
  const { documents, setSelectedSummaryRecord } = usePatientDashboard();

  const [searchQuery, setSearchQuery] = useState("");
  const [summaryFilter, setSummaryFilter] = useState<"ALL" | "CONFIRMED" | "PROCESSED">("ALL");

  const filteredDocs = documents.filter((doc) => {
    if (summaryFilter !== "ALL" && doc.status !== summaryFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const filenameMatch = doc.filename?.toLowerCase().includes(q);
      const hospitalMatch = doc.structuredResult?.hospital?.toLowerCase().includes(q);
      const doctorMatch =
        typeof doc.structuredResult?.doctor === "string"
          ? doc.structuredResult.doctor.toLowerCase().includes(q)
          : doc.structuredResult?.doctor?.name?.toLowerCase().includes(q);
      const summaryMatch = doc.summary?.toLowerCase().includes(q);
      return filenameMatch || hospitalMatch || doctorMatch || summaryMatch;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileCheck className="w-5 h-5 text-[#008080]" />
            <h2 className="text-xl font-extrabold text-slate-900">
              Longitudinal Patient Summary & Verified Records
            </h2>
          </div>
          <p className="text-xs text-slate-500">
            Unified electronic health summary stored across Supabase PostgreSQL. Click any record below to view its complete clinical summary.
          </p>
        </div>
        <button
          onClick={() => router.push("/upload")}
          className="flex items-center gap-2 bg-[#008080] hover:bg-[#006666] text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs transition-colors shrink-0 cursor-pointer"
        >
          <Upload className="w-4 h-4 stroke-[2.5]" />
          Upload Document
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by hospital, doctor, medicine, or condition..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500 focus:bg-white transition-all text-slate-800"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Filter:
          </span>
          {(["ALL", "CONFIRMED", "PROCESSED"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setSummaryFilter(mode)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                summaryFilter === mode
                  ? "bg-[#008080] text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Records List */}
      <div className="space-y-4">
        {filteredDocs.map((doc, idx) => {
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
              className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:border-teal-400 hover:shadow-md transition-all space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
                    {doc.imageUrl ? (
                      <img
                        src={doc.imageUrl}
                        alt={doc.filename}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "/sample_prescription.png";
                        }}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400">
                        <FileImage className="w-5 h-5 text-slate-400" />
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="text-sm font-bold text-slate-900">{doc.filename}</h3>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          doc.status === "CONFIRMED"
                            ? "bg-teal-50 text-teal-800 border-teal-200"
                            : "bg-amber-50 text-amber-800 border-amber-300"
                        }`}
                      >
                        {doc.status === "CONFIRMED" ? "Hospital Verified" : "Draft Extraction"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{docDate}</span>
                      <span>•</span>
                      <span className="font-mono text-[11px]">Record #{doc.id}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    onClick={() => setSelectedSummaryRecord(doc)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#008080] hover:bg-teal-50 rounded-xl border border-teal-200 transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Inspect Summary
                  </button>
                  {doc.status !== "CONFIRMED" && (
                    <Link
                      href={`/extractions/${doc.id}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#008080] hover:bg-[#006666] rounded-xl shadow-xs transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Review & Confirm
                    </Link>
                  )}
                </div>
              </div>

              {/* Clinical Summary Narrative */}
              <p className="text-xs text-slate-600 leading-relaxed">
                {doc.summary || doc.structuredResult?.summary || "Clinical encounter details recorded."}
              </p>

              {/* Provider Info & Extracted Meds */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-slate-500">
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    {doc.structuredResult?.hospital || "City Care Medical Centre"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Stethoscope className="w-3.5 h-3.5 text-slate-400" />
                    {typeof doc.structuredResult?.doctor === "string"
                      ? doc.structuredResult.doctor
                      : doc.structuredResult?.doctor?.name || "Dr. Neha Verma"}
                  </span>
                </div>

                {meds.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-semibold text-slate-700">Meds:</span>
                    {meds.slice(0, 3).map((m: any, mIdx: number) => (
                      <span
                        key={mIdx}
                        className="bg-slate-100 text-slate-800 text-[10px] font-medium px-2 py-0.5 rounded-md"
                      >
                        {typeof m === "string" ? m : m.name}
                      </span>
                    ))}
                    {meds.length > 3 && (
                      <span className="text-[10px] text-slate-400">+{meds.length - 3} more</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
