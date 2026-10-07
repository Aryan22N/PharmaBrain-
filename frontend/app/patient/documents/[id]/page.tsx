"use client";

import React, { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ExtractionPayload,
  PrescriptionRecord,
  MedicineRecord,
  RawOcrData,
  ConfirmResult,
} from "@/lib/types";
import { clientApi } from "@/lib/api";
import { GateBadge } from "@/components/StatusBadge";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";
import { MedicineEditor } from "@/components/MedicineEditor";
import { VitalsDisplay } from "@/components/VitalsDisplay";
import { RawOcrViewer } from "@/components/RawOcrViewer";
import {
  User,
  Calendar,
  Building2,
  Stethoscope,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
  FileText,
  ShieldCheck,
  AlertCircle,
  Eye,
  FileImage,
  Pill,
  Check,
} from "lucide-react";

export default function PatientDocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [payload, setPayload] = useState<ExtractionPayload | null>(null);
  const [record, setRecord] = useState<PrescriptionRecord | null>(null);
  const [rawOcr, setRawOcr] = useState<RawOcrData | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [confirmedBy, setConfirmedBy] = useState("Dr. Reviewer");
  const [confirming, setConfirming] = useState(false);
  const [discarding, setDiscarding] = useState(false);

  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [confirmSuccess, setConfirmSuccess] = useState<ConfirmResult | null>(null);

  const [activeTab, setActiveTab] = useState<"summary" | "ocrLines">("summary");

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await clientApi.getExtraction(Number(id));
      setPayload(data);
      setRecord(data.record);

      if (data.ocr_id) {
        clientApi.getRawOcr(data.ocr_id).then(setRawOcr).catch(() => null);
      }
    } catch (err: any) {
      setError(err.message || `Failed to load document #${id}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleRecordFieldChange = (section: "patient" | "doctor", field: string, value: string) => {
    if (!record) return;
    setRecord({
      ...record,
      [section]: {
        ...((record[section] || {}) as any),
        [field]: value.trim() === "" ? null : value,
      },
    });
  };

  const handleMedicinesChange = (updatedMeds: MedicineRecord[]) => {
    if (!record) return;
    setRecord({
      ...record,
      medicines: updatedMeds,
    });
  };

  const handleConfirm = async (allowDuplicate = false) => {
    if (!record || !payload) return;
    setError(null);
    setDuplicateWarning(null);

    let dateIso = record.date_iso?.trim();
    if (!dateIso) {
      dateIso = new Date().toISOString().split("T")[0];
    }

    if (!record.medicines || record.medicines.length === 0) {
      setError("At least one medicine is required to confirm the prescription.");
      return;
    }

    const currentPatientId = record.patient?.uhid?.trim() || payload.patient_id || "483027156";

    const updatedRecord: PrescriptionRecord = {
      ...record,
      date_iso: dateIso,
      patient: {
        ...(record.patient || {}),
        name: record.patient?.name || null,
        uhid: record.patient?.uhid || null,
      },
      doctor: {
        ...(record.doctor || {}),
        name: record.doctor?.name || null,
        reg_no: record.doctor?.reg_no || null,
      },
    };
    setRecord(updatedRecord);
    setConfirming(true);

    try {
      const result = await clientApi.confirmExtraction(
        payload.extraction_id,
        updatedRecord,
        confirmedBy,
        allowDuplicate
      );
      setConfirmSuccess(result);
      setError(null);
      setPayload((prev) => (prev ? { ...prev, status: "CONFIRMED" } : null));
    } catch (err: any) {
      if (err.status === 409 && err.message?.includes("duplicate")) {
        setDuplicateWarning(err.message);
      } else if (err.status === 409 && err.message?.includes("already confirmed")) {
        setPayload((prev) => (prev ? { ...prev, status: "CONFIRMED" } : null));
        setConfirmSuccess({
          prescription_id: Number(id),
          patient_id: currentPatientId,
          rx_date: dateIso,
          edits: [],
          observations_saved: 0,
          observations_skipped: [],
        });
      } else {
        setError(err.message || "Failed to confirm prescription.");
      }
    } finally {
      setConfirming(false);
    }
  };

  const handleDiscard = async () => {
    if (!payload) return;
    if (!confirm("Are you sure you want to discard this draft? It will be permanently removed.")) return;

    setDiscarding(true);
    try {
      await clientApi.discardExtraction(payload.extraction_id);
      router.push("/patient/documents");
    } catch (err: any) {
      setError(err.message || "Failed to discard draft.");
      setDiscarding(false);
    }
  };

  if (loading) {
    return (
      <div className="py-16 text-center space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-[#008080]" />
        <h2 className="text-sm font-bold text-slate-700">Loading Patient Document Record #{id}...</h2>
      </div>
    );
  }

  if (error && !payload) {
    return (
      <div className="py-12 max-w-lg mx-auto">
        <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Document Record Not Found</h2>
          <p className="text-xs text-rose-700">{error}</p>
          <Link
            href="/patient/documents"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#008080] text-white text-xs font-bold hover:bg-[#006666] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Documents Vault
          </Link>
        </div>
      </div>
    );
  }

  if (!payload || !record) return null;

  const isConfirmed = payload.status === "CONFIRMED";
  const isDiscarded = payload.status === "DISCARDED";
  const isPending = payload.status === "PENDING_USER_CONFIRMATION";
  const patientId = record.patient?.uhid?.trim() || payload.patient_id || "";

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/patient/documents"
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors border border-slate-200"
            title="Return to Documents Vault"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Medical Document #{payload.extraction_id}
              </h1>
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                  isConfirmed
                    ? "text-emerald-700 bg-emerald-50 border border-emerald-200"
                    : "text-amber-800 bg-amber-50 border border-amber-300"
                }`}
              >
                {isConfirmed ? "Hospital Verified" : "Draft Summary"}
              </span>
              <GateBadge gate={payload.gate} />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Extracted via PaddleOCR • Reconciled against authentic Drug Master
            </p>
          </div>
        </div>

        {/* View Tabs */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setActiveTab("summary")}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === "summary"
                  ? "bg-white text-slate-900 shadow-xs font-bold"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-teal-600" />
              Prescription Summary
            </button>
            <button
              onClick={() => setActiveTab("ocrLines")}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === "ocrLines"
                  ? "bg-white text-slate-900 shadow-xs font-bold"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <Eye className="w-3.5 h-3.5 text-teal-600" />
              OCR Text Lines
            </button>
          </div>
        </div>
      </div>

      <MedicalDisclaimer compact />

      {/* Confirmation Success Banner */}
      {confirmSuccess && (
        <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs shadow-xs space-y-2">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-emerald-950">
                Prescription Confirmed & Saved to Patient Summary!
              </h3>
              <p className="text-xs text-emerald-800 mt-0.5">
                Saved under Patient ID: <strong className="font-mono text-emerald-900">{confirmSuccess.patient_id}</strong>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
          <div className="flex-1 space-y-1">
            <div className="font-bold text-rose-900">Processing Alert</div>
            <div>{error}</div>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-slate-500 hover:text-slate-800 text-xs px-2 py-1 rounded bg-white border border-slate-200"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Duplicate Warning Dialog */}
      {duplicateWarning && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-3">
          <div className="font-bold text-amber-900 flex items-center gap-2 text-sm">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            Potential Duplicate Prescription Detected
          </div>
          <p className="text-xs text-amber-800 leading-relaxed">{duplicateWarning}</p>
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={() => handleConfirm(true)}
              className="px-3 py-1.5 rounded-xl bg-amber-500 text-white font-bold text-xs hover:bg-amber-600 transition-colors"
            >
              Confirm Anyway (Allow Duplicate)
            </button>
            <button
              onClick={() => setDuplicateWarning(null)}
              className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs hover:bg-slate-200 transition-colors border border-slate-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* SUMMARY TAB */}
      {activeTab === "summary" && (
        <div className="space-y-6">
          {/* Metadata Grid */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Patient Info */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-teal-700 uppercase tracking-wider">
                  <User className="w-3.5 h-3.5" />
                  Patient Profile
                </div>
                <div className="text-sm font-bold text-slate-900">
                  {record.patient?.name || "Patient Record"}
                </div>
                {patientId && (
                  <div className="text-xs text-slate-500 font-mono">
                    UHID: <strong className="text-teal-700">{patientId}</strong>
                  </div>
                )}
              </div>

              {/* Prescribing Doctor */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-teal-700 uppercase tracking-wider">
                  <Stethoscope className="w-3.5 h-3.5" />
                  Prescribing Physician
                </div>
                <div className="text-sm font-bold text-slate-900">
                  {typeof record.doctor === "string" ? record.doctor : record.doctor?.name || "Attending Physician"}
                </div>
                <div className="text-xs text-slate-500">
                  Reg No: <span className="font-mono text-slate-700 font-semibold">{typeof record.doctor === "object" ? record.doctor?.reg_no || "—" : "—"}</span>
                </div>
              </div>

              {/* Facility & Date */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-teal-700 uppercase tracking-wider">
                  <Building2 className="w-3.5 h-3.5" />
                  Facility & Date
                </div>
                <div className="text-xs font-bold text-slate-800">
                  {record.hospital || "City Care Medical Centre"}
                </div>
                <div className="text-xs text-slate-500 font-mono">
                  Date: <strong className="text-slate-800">{record.date_iso || "Record Uploaded"}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Vitals Section */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-600" />
              Clinical Vitals & Measurements
            </h3>
            <VitalsDisplay vitals={record.vitals} />
          </div>

          {/* Prescribed Medicines Editor */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <MedicineEditor
              medicines={record.medicines}
              onChange={handleMedicinesChange}
              readOnly={isConfirmed || isDiscarded}
            />
          </div>

          {/* Confirmation Action Bar */}
          {isPending && (
            <div className="sticky bottom-4 p-4 rounded-2xl bg-white/95 border border-teal-200 shadow-xl backdrop-blur-md flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-teal-600" />
                <span className="text-xs font-bold text-slate-900">
                  Confirm Prescription Order
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={discarding}
                  onClick={handleDiscard}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                >
                  {discarding ? "Discarding..." : "Discard Draft"}
                </button>

                <button
                  type="button"
                  disabled={confirming}
                  onClick={() => handleConfirm(false)}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#008080] hover:bg-[#006666] text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {confirming ? "Saving Record..." : "Confirm & Save to Record"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* OCR TEXT LINES TAB */}
      {activeTab === "ocrLines" && (
        <div className="space-y-4">
          {rawOcr ? (
            <RawOcrViewer data={rawOcr} />
          ) : (
            <div className="p-8 text-center rounded-2xl bg-white border border-slate-200 text-slate-500 text-xs shadow-xs">
              <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2 text-teal-600" />
              Loading raw OCR text lines...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
