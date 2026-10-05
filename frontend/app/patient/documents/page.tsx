"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  Upload,
  Eye,
  FileImage,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Calendar,
  Sparkles,
} from "lucide-react";
import { usePatientDashboard } from "@/app/patient/context";

export default function DocumentsPage() {
  const router = useRouter();
  const { documents, setSelectedSummaryRecord } = usePatientDashboard();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-5 h-5 text-[#008080]" />
            <h2 className="text-xl font-extrabold text-slate-900">
              Patient Medical Documents Vault
            </h2>
          </div>
          <p className="text-xs text-slate-500">
            Secure storage for scanned prescriptions, lab diagnostics, and hospital discharge notes.
          </p>
        </div>
        <button
          onClick={() => router.push("/upload")}
          className="flex items-center gap-2 bg-[#008080] hover:bg-[#006666] text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs transition-colors shrink-0 cursor-pointer"
        >
          <Upload className="w-4 h-4 stroke-[2.5]" />
          Upload New Document
        </button>
      </div>

      {/* Grid of Documents */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {documents.map((doc, idx) => {
          const docDate =
            doc.structuredResult?.date_iso ||
            new Date(doc.uploadedAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            });

          return (
            <div
              key={doc.id || idx}
              className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs hover:border-teal-400 hover:shadow-md transition-all flex flex-col justify-between"
            >
              {/* Document Image Preview */}
              <div className="relative h-44 bg-slate-950 flex items-center justify-center overflow-hidden border-b border-slate-100 group">
                <img
                  src={doc.imageUrl || "/sample_prescription.png"}
                  alt={doc.filename}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/sample_prescription.png";
                  }}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute top-3 right-3">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs ${
                      doc.status === "CONFIRMED"
                        ? "bg-teal-500 text-white"
                        : "bg-amber-500 text-white"
                    }`}
                  >
                    {doc.status === "CONFIRMED" ? "Verified" : "Draft"}
                  </span>
                </div>
              </div>

              {/* Info Body */}
              <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 truncate mb-1" title={doc.filename}>
                    {doc.filename}
                  </h3>
                  <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{docDate}</span>
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setSelectedSummaryRecord(doc)}
                    className="flex items-center gap-1 text-xs font-bold text-[#008080] hover:underline cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    View Details
                  </button>

                  <a
                    href={doc.imageUrl || "/sample_prescription.png"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Full Scan
                  </a>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
