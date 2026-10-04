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
import { GateBadge, ExtractionStatusBadge } from "@/components/StatusBadge";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";
import { MedicineEditor } from "@/components/MedicineEditor";
import { VitalsDisplay } from "@/components/VitalsDisplay";
import { RawOcrViewer } from "@/components/RawOcrViewer";
import {
  User,
  Calendar,
  Building2,
  Stethoscope,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
  FileText,
  ShieldCheck,
  AlertCircle,
  Edit3,
  ExternalLink,
  Sparkles,
  Check,
} from "lucide-react";

export default function ExtractionDetailsPage({
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

  // Clinician name for confirmation
  const [confirmedBy, setConfirmedBy] = useState("Dr. Reviewer");
  const [confirming, setConfirming] = useState(false);
  const [discarding, setDiscarding] = useState(false);

  // Duplicate prompt state (HTTP 409)
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [confirmSuccess, setConfirmSuccess] = useState<ConfirmResult | null>(null);

  // Active view tab (Extraction vs Raw OCR)
  const [activeTab, setActiveTab] = useState<"review" | "rawOcr">("review");

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
      setError(err.message || `Failed to load extraction #${id}`);
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

    // Ensure valid ISO date or fallback to today
    let dateIso = record.date_iso?.trim();
    if (!dateIso) {
      dateIso = new Date().toISOString().split("T")[0];
    }

    if (!record.medicines || record.medicines.length === 0) {
      setError("At least one medicine is required to confirm the prescription. Please add a medication.");
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
      // Immediately reflect confirmed status in state
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
    if (!confirm("Are you sure you want to discard this extraction? It will be marked as DISCARDED.")) {
      return;
    }

    setDiscarding(true);
    try {
      await clientApi.discardExtraction(payload.extraction_id);
      loadData();
    } catch (err: any) {
      setError(err.message || "Failed to discard extraction.");
    } finally {
      setDiscarding(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f7f6] flex flex-col items-center justify-center p-4">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-[#008080] mb-3" />
        <h2 className="text-sm font-bold text-slate-700">
          Loading clinical extraction #{id}...
        </h2>
      </div>
    );
  }

  if (error && !payload) {
    return (
      <div className="min-h-screen bg-[#f4f7f6] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 border border-slate-200 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Extraction Not Found</h2>
          <p className="text-xs text-rose-700">{error}</p>
          <Link
            href="/patient"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#008080] text-white text-xs font-semibold hover:bg-[#006666] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (!payload || !record) return null;

  const isConfirmed = payload.status === "CONFIRMED";
  const isDiscarded = payload.status === "DISCARDED";
  const isPending = payload.status === "PENDING_USER_CONFIRMATION";
  const patientId = record.patient?.uhid?.trim() || payload.patient_id || "483027156";

  return (
    <div className="min-h-screen bg-[#f4f7f6] text-slate-800 font-sans py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Top Header Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/patient"
              className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors border border-slate-200"
              title="Return to Patient Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                  Extraction #{payload.extraction_id}
                </h1>
                <span
                  className={`inline-block text-[11px] font-bold px-2.5 py-0.5 rounded uppercase ${
                    isConfirmed
                      ? "text-emerald-700 bg-emerald-50 border border-emerald-200"
                      : "text-amber-800 bg-amber-50 border border-amber-300"
                  }`}
                >
                  {isConfirmed ? "Hospital Verified" : "Not Confirmed"}
                </span>
                <GateBadge gate={payload.gate} />
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Source raw OCR: #{payload.ocr_id} • Structured via {payload.llm_model}
              </p>
            </div>
          </div>

          {/* View Switcher Tabs & Navigation */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-semibold">
              <button
                onClick={() => setActiveTab("review")}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                  activeTab === "review"
                    ? "bg-white text-slate-900 shadow-xs font-bold"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <Edit3 className="w-3.5 h-3.5 text-teal-600" />
                Clinical Review
              </button>
              <button
                onClick={() => setActiveTab("rawOcr")}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                  activeTab === "rawOcr"
                    ? "bg-white text-slate-900 shadow-xs font-bold"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-teal-600" />
                Raw OCR Inspector
              </button>
            </div>

            <Link
              href="/patient"
              className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
            >
              Dashboard
            </Link>
          </div>
        </div>

        {/* Safety Notice & Medical Disclaimer */}
        <MedicalDisclaimer compact />

        {/* Success Confirmation Banner */}
        {confirmSuccess && (
          <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-emerald-200">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-700 shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                    Prescription Confirmed & Saved to Patient Summary!
                  </h3>
                  <p className="text-xs text-emerald-800 mt-0.5">
                    Saved under Patient ID: <strong className="font-mono text-emerald-900">{confirmSuccess.patient_id}</strong> • Date: <strong className="font-mono text-emerald-900">{confirmSuccess.rx_date}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <Link
                  href="/patient"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#008080] hover:bg-[#006666] text-white font-bold text-xs shadow-xs transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Return to Patient Dashboard</span>
                </Link>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-[11px] text-emerald-800">
              <span>• Status updated in database to: <strong className="font-bold text-emerald-900">CONFIRMED (Hospital Verified)</strong></span>
              <span>• Clinician modifications saved: <strong className="text-emerald-900">{confirmSuccess.edits?.length || 0}</strong></span>
              <span>• Clinical vitals saved: <strong className="text-emerald-900">{confirmSuccess.observations_saved || 0}</strong></span>
            </div>
          </div>
        )}

        {/* Error Alert Notice */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <div className="flex-1 space-y-1">
              <div className="font-bold text-rose-900">Confirmation Alert</div>
              <div className="leading-relaxed">{error}</div>
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

        {/* Duplicate Warning Dialog (HTTP 409) */}
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

        {/* Quality Gate Reasons Notice */}
        {payload.gate?.reasons && payload.gate.reasons.length > 0 && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-1.5 text-xs">
            <div className="font-bold text-amber-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Validation Gating Flagged {payload.gate.reasons.length} Attention Points
            </div>
            <ul className="list-disc list-inside space-y-1 text-amber-800 text-[11px]">
              {payload.gate.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}

        {/* MAIN REVIEW TAB */}
        {activeTab === "review" && (
          <div className="space-y-6">
            {/* Patient, Doctor & Hospital Card */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Patient Block */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-teal-700 uppercase tracking-wider">
                    <User className="w-3.5 h-3.5" />
                    Patient Details
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-0.5">Name</label>
                    {isConfirmed ? (
                      <div className="text-sm font-bold text-slate-900">{record.patient?.name || "Not detected"}</div>
                    ) : (
                      <input
                        type="text"
                        value={record.patient?.name || ""}
                        onChange={(e) => handleRecordFieldChange("patient", "name", e.target.value)}
                        placeholder="Patient Name"
                        className="w-full text-xs font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-teal-500 focus:bg-white"
                      />
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs pt-1">
                    <div>
                      <label className="text-[10px] text-slate-400 block">Patient ID</label>
                      <span className="font-mono text-teal-700 font-bold">{patientId}</span>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block">Age</label>
                      <span className="text-slate-700 font-medium">{record.patient?.age ? `${record.patient.age}y` : "—"}</span>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block">Sex</label>
                      <span className="text-slate-700 font-medium">{record.patient?.sex || "—"}</span>
                    </div>
                  </div>
                </div>

                {/* Prescribing Doctor Block */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-teal-700 uppercase tracking-wider">
                    <Stethoscope className="w-3.5 h-3.5" />
                    Prescribing Clinician
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-0.5">Doctor Name</label>
                    {isConfirmed ? (
                      <div className="text-sm font-bold text-slate-900">
                        {typeof record.doctor === "string" ? record.doctor : record.doctor?.name || "Dr. Not detected"}
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={typeof record.doctor === "string" ? record.doctor : record.doctor?.name || ""}
                        onChange={(e) => handleRecordFieldChange("doctor", "name", e.target.value)}
                        placeholder="Doctor Name"
                        className="w-full text-xs font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-teal-500 focus:bg-white"
                      />
                    )}
                  </div>
                  <div className="pt-1">
                    <label className="text-[10px] text-slate-400 block">Registration No.</label>
                    <span className="font-mono text-xs text-slate-700 font-semibold">
                      {typeof record.doctor === "object" ? record.doctor?.reg_no || "—" : "—"}
                    </span>
                  </div>
                </div>

                {/* Hospital & Prescription Date Block */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-teal-700 uppercase tracking-wider">
                    <Building2 className="w-3.5 h-3.5" />
                    Facility & Date
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-0.5">Hospital / Clinic</label>
                    <div className="text-xs font-semibold text-slate-800 truncate">{record.hospital || "Not detected"}</div>
                  </div>
                  <div className="pt-1">
                    <label className="text-[11px] text-slate-500 block mb-0.5">Prescription Date (ISO)</label>
                    {isConfirmed ? (
                      <div className="font-mono text-xs text-teal-700 font-bold">{record.date_iso || "Missing"}</div>
                    ) : (
                      <input
                        type="date"
                        value={record.date_iso || ""}
                        onChange={(e) => setRecord({ ...record, date_iso: e.target.value })}
                        className="w-full text-xs font-mono text-slate-900 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-teal-500 focus:bg-white"
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Vitals Section */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                Clinical Vitals & Measurements
              </h3>
              <VitalsDisplay vitals={record.vitals} />
            </div>

            {/* Medicines Section (Interactive Editor) */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
              <MedicineEditor
                medicines={record.medicines}
                onChange={handleMedicinesChange}
                readOnly={isConfirmed || isDiscarded}
              />
            </div>

            {/* Diagnosis, Allergies, Advice, Follow-up */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Diagnosis / Complaints */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Complaints & Diagnosis
                </h4>
                {record.diagnosis && record.diagnosis.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {record.diagnosis.map((d, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-lg text-xs bg-slate-100 border border-slate-200 text-slate-800 font-medium"
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">None detected</p>
                )}
              </div>

              {/* Allergies */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
                <h4 className="text-xs font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Allergies & Contraindications
                </h4>
                {record.allergies && record.allergies.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {record.allergies.map((a, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-lg text-xs bg-rose-50 border border-rose-200 text-rose-800 font-semibold"
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">No allergy statements found (e.g. NKDA)</p>
                )}
              </div>

              {/* Advice */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Physician Advice & Instructions
                </h4>
                {record.advice && record.advice.length > 0 ? (
                  <ul className="list-disc list-inside space-y-1 text-xs text-slate-700">
                    {record.advice.map((adv, i) => (
                      <li key={i}>{adv}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-400">None detected</p>
                )}
              </div>

              {/* Follow-up */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Follow-up / Review Instructions
                </h4>
                <p className="text-xs text-slate-700">
                  {record.follow_up || "Review as needed"}
                </p>
              </div>
            </div>

            {/* Bottom Confirmation Action Bar */}
            {isPending && (
              <div className="sticky bottom-4 p-4 rounded-2xl bg-white/95 border border-teal-200 shadow-xl backdrop-blur-md flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5 text-teal-600" />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">
                      Authorize Clinical Sign-off
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-slate-500">Reviewer ID:</span>
                      <input
                        type="text"
                        value={confirmedBy}
                        onChange={(e) => setConfirmedBy(e.target.value)}
                        placeholder="e.g. Dr. John Doe"
                        className="text-xs px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-300 text-slate-800 focus:outline-none focus:border-teal-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={discarding}
                    onClick={handleDiscard}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 text-xs font-semibold transition-colors"
                  >
                    {discarding ? "Discarding..." : "Discard Draft"}
                  </button>

                  <button
                    type="button"
                    disabled={confirming}
                    onClick={() => handleConfirm(false)}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#008080] hover:bg-[#006666] text-white font-bold text-xs shadow-xs transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {confirming ? "Saving Record..." : "Confirm & Save to Record"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* RAW OCR INSPECTOR TAB */}
        {activeTab === "rawOcr" && (
          <div className="space-y-4">
            {rawOcr ? (
              <RawOcrViewer data={rawOcr} />
            ) : (
              <div className="p-8 text-center rounded-2xl bg-white border border-slate-200 text-slate-500 text-xs shadow-xs">
                <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2 text-teal-600" />
                Loading raw OCR lines...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
