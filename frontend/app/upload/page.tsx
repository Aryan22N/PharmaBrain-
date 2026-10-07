"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  FileImage,
  X,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  Sparkles,
  Stethoscope,
  Eye,
  Check,
  Camera,
  Sun,
  Maximize2,
  FileText,
  ShieldCheck,
} from "lucide-react";
import { clientApi } from "@/lib/api";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";

const MAX_UPLOAD_MB = 10;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg"];

type ProcessingStep = "idle" | "uploading" | "ocr" | "structuring" | "finalizing" | "success" | "error";

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [patientId, setPatientId] = useState("");
  const [patientName, setPatientName] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [zoomPreview, setZoomPreview] = useState(false);

  const [step, setStep] = useState<ProcessingStep>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rawOcrId, setRawOcrId] = useState<number | undefined>(undefined);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        let token = localStorage.getItem("auth_token");
        const res = await fetch("/api/user/dashboard", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            if (data.user.patientId) setPatientId(data.user.patientId);
            if (data.user.name) setPatientName(data.user.name);
          }
        }
      } catch (e) {
        const savedUser = localStorage.getItem("user");
        if (savedUser) {
          try {
            const u = JSON.parse(savedUser);
            if (u.patientId) setPatientId(u.patientId);
            if (u.name) setPatientName(u.name);
          } catch (err) {}
        }
      }
    };
    loadCurrentUser();
  }, []);

  const handleFileSelect = (file: File) => {
    setErrorMessage(null);

    if (!ALLOWED_MIME_TYPES.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|webp)$/i)) {
      setErrorMessage(`Unsupported format (${file.type || "unknown"}). Please upload a JPEG, PNG, or WebP image.`);
      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      setErrorMessage(
        `File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds maximum allowed limit of ${MAX_UPLOAD_MB} MB.`
      );
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMessage("Please select or drop a prescription image to analyze.");
      return;
    }

    setErrorMessage(null);
    setStep("uploading");
    setElapsedSeconds(0);

    const timerInterval = setInterval(() => {
      setElapsedSeconds((prev) => {
        const next = prev + 1;
        if (next < 2) {
          setStep("uploading");
        } else if (next >= 2 && next < 8) {
          setStep("ocr");
        } else if (next >= 8 && next < 18) {
          setStep("structuring");
        } else {
          setStep("finalizing");
        }
        return next;
      });
    }, 1000);

    try {
      const result = await clientApi.uploadPrescription(
        selectedFile,
        patientId.trim() || "483027156",
        patientName.trim() || undefined
      );

      clearInterval(timerInterval);
      setStep("success");
      router.push(`/patient/documents/${result.extraction_id}`);
    } catch (err: any) {
      clearInterval(timerInterval);
      setStep("error");
      setErrorMessage(err.message || "Failed to process prescription image.");
      if (err.rawOcrId) {
        setRawOcrId(err.rawOcrId);
      }
    }
  };

  const handleRetryStructuring = async () => {
    if (!rawOcrId) return;
    setStep("structuring");
    setErrorMessage(null);

    try {
      const result = await clientApi.retryStructure(rawOcrId, patientName || undefined);
      setStep("success");
      router.push(`/patient/documents/${result.extraction_id}`);
    } catch (err: any) {
      setStep("error");
      setErrorMessage(err.message || "Retry structuring failed.");
    }
  };

  const isProcessing = step !== "idle" && step !== "error" && step !== "success";

  return (
    <div className="min-h-screen bg-[#f4f7f6] text-slate-800 font-sans py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Header Bar */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
                <Upload className="w-7 h-7 text-[#008080]" />
                Upload Medical Prescription
              </h1>
              {patientName && (
                <span className="bg-teal-50 text-teal-800 text-xs font-bold px-3 py-1 rounded-full border border-teal-200 flex items-center gap-1.5 font-mono">
                  <Stethoscope className="w-3.5 h-3.5 text-teal-600" />
                  Patient: {patientName} {patientId ? `(UHID: ${patientId})` : ""}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 max-w-xl leading-relaxed">
              Upload paper prescriptions, lab reports, or clinic summaries for PaddleOCR text extraction and AI entity structuring.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/patient")}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors shrink-0 cursor-pointer"
          >
            Back to Dashboard
          </button>
        </div>

        <MedicalDisclaimer compact />

        {/* Main Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Document Dropzone & Image Preview (7 cols) */}
            <div className="lg:col-span-7 space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span className="flex items-center gap-1.5">
                  <FileImage className="w-4 h-4 text-teal-600" />
                  Prescription Document Image
                </span>
                <span className="text-slate-400 font-normal">
                  JPEG, PNG, WebP (Max {MAX_UPLOAD_MB}MB)
                </span>
              </div>

              {!selectedFile ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[300px] ${
                    isDragOver
                      ? "border-teal-500 bg-teal-50/50"
                      : "border-slate-300 hover:border-teal-500 bg-white"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp"
                    onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                    className="hidden"
                  />

                  <div className="w-14 h-14 rounded-2xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center mb-3 shadow-xs">
                    <Upload className="w-7 h-7" />
                  </div>

                  <h3 className="text-base font-bold text-slate-900">
                    Click to select or drop prescription image here
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm">
                    Upload camera photos or scanned clinic printouts.
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                        <FileImage className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {selectedFile.name}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setZoomPreview(!zoomPreview)}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                        title={zoomPreview ? "Fit" : "Expand"}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {!isProcessing && (
                        <button
                          type="button"
                          onClick={handleRemoveFile}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition-colors"
                          title="Remove image"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {previewUrl && (
                    <div
                      className={`relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center p-2 transition-all ${
                        zoomPreview ? "max-h-[500px]" : "max-h-[300px]"
                      }`}
                    >
                      <img
                        src={previewUrl}
                        alt="Prescription preview"
                        className="object-contain max-h-[500px] w-auto select-none rounded"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right: Guidance Card & Submit Action (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              {/* Guidance Card: How an Ideal Prescription Looks */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <Camera className="w-4 h-4 text-[#008080]" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    How an Ideal Prescription Looks
                  </h3>
                </div>

                <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
                  <div className="flex items-start gap-3">
                    <Sun className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-800 font-bold block mb-0.5">Clear & Well-Lit</strong>
                      Capture with bright lighting. Avoid dark shadows or strong camera flash glare.
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Maximize2 className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-800 font-bold block mb-0.5">Flat & Straight Angle</strong>
                      Place paper flat on a surface. Avoid folded corners or severe diagonal tilt.
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <FileText className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-800 font-bold block mb-0.5">Legible Medication Info</strong>
                      Ensure doctor header, medicine names, strengths (e.g., 500mg), and dosage schedules (1-0-1) are in focus.
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit Action Button */}

              {/* Submit Action Button */}
              <button
                type="submit"
                disabled={!selectedFile || isProcessing}
                className="w-full flex items-center justify-center gap-2 bg-[#008080] hover:bg-[#006666] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold py-3.5 px-4 rounded-xl shadow-xs transition-all cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Processing Prescription...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Analyze & Process Prescription
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Stepper Status Box */}
          {isProcessing && (
            <div className="bg-white p-5 rounded-2xl border border-teal-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full bg-teal-600 animate-ping" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">
                      Processing Prescription ({elapsedSeconds}s elapsed)
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      {step === "uploading" && "Optimizing image resolution..."}
                      {step === "ocr" && "PaddleOCR extracting text lines..."}
                      {step === "structuring" && "Structuring medications & dosages..."}
                      {step === "finalizing" && "Saving to Patient Summary..."}
                    </p>
                  </div>
                </div>

                <span className="px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-800 font-mono text-xs font-bold border border-teal-200">
                  {step === "uploading"
                    ? `${Math.min(25, 12 + elapsedSeconds * 6)}%`
                    : step === "ocr"
                    ? `${Math.min(60, 25 + (elapsedSeconds - 2) * 6)}%`
                    : step === "structuring"
                    ? `${Math.min(88, 60 + (elapsedSeconds - 8) * 3)}%`
                    : `${Math.min(97, 88 + (elapsedSeconds - 18) * 1)}%`}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#008080] transition-all duration-500 ease-out"
                  style={{
                    width:
                      step === "uploading"
                        ? `${Math.min(25, 12 + elapsedSeconds * 6)}%`
                        : step === "ocr"
                        ? `${Math.min(60, 25 + (elapsedSeconds - 2) * 6)}%`
                        : step === "structuring"
                        ? `${Math.min(88, 60 + (elapsedSeconds - 8) * 3)}%`
                        : `${Math.min(97, 88 + (elapsedSeconds - 18) * 1)}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-3 shadow-xs">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
              <div className="flex-1 space-y-2">
                <div className="font-bold text-rose-900">Processing Alert</div>
                <div className="leading-relaxed">{errorMessage}</div>
                <div className="pt-1 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage(null);
                      setStep("idle");
                      setElapsedSeconds(0);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-50 cursor-pointer"
                  >
                    Try Again
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push("/patient")}
                    className="px-3 py-1.5 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 font-semibold text-xs hover:bg-teal-100 cursor-pointer"
                  >
                    Check Patient Dashboard
                  </button>
                  {rawOcrId && (
                    <button
                      type="button"
                      onClick={handleRetryStructuring}
                      className="px-3 py-1.5 rounded-lg bg-rose-100 text-rose-800 font-semibold text-xs cursor-pointer"
                    >
                      Retry Gemini Structuring (OCR #{rawOcrId})
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
