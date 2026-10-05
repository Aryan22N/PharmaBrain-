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
  Zap,
  Clock,
  Stethoscope,
  ShieldCheck,
  FileText,
  Activity,
  Check,
  Eye,
  Pill,
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
  const [isLoadingSample, setIsLoadingSample] = useState(false);
  const [zoomPreview, setZoomPreview] = useState(false);

  const [step, setStep] = useState<ProcessingStep>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rawOcrId, setRawOcrId] = useState<number | undefined>(undefined);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        let token = localStorage.getItem("auth_token");
        const res = await fetch("/api/auth/me", {
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

  const generateRandomUhid = () => {
    // Generate 9-digit patient ID fallback
    const randomNum = Math.floor(100000000 + Math.random() * 900000000);
    setPatientId(randomNum.toString());
    if (!patientName) {
      setPatientName("Rahul Sharma");
    }
  };

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

    if (!patientId.trim()) {
      generateRandomUhid();
    }
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

  const loadSamplePrescription = async () => {
    setIsLoadingSample(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/sample_prescription.png");
      if (!response.ok) {
        throw new Error("Sample prescription file not found");
      }
      const blob = await response.blob();
      const sampleFile = new File([blob], "sample_rx_cardio.png", { type: "image/png" });
      setSelectedFile(sampleFile);
      const url = URL.createObjectURL(sampleFile);
      setPreviewUrl(url);
      setPatientId("UHID-2026-4821");
      setPatientName("Priyanka Sharma");
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to load sample image.");
    } finally {
      setIsLoadingSample(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMessage("Please select or drop a prescription image to analyze.");
      return;
    }
    if (!patientId.trim()) {
      setErrorMessage("Please enter a Patient ID / UHID.");
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
        patientId.trim(),
        patientName.trim() || undefined
      );

      clearInterval(timerInterval);
      setStep("success");
      router.push(`/extractions/${result.extraction_id}`);
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
      router.push(`/extractions/${result.extraction_id}`);
    } catch (err: any) {
      setStep("error");
      setErrorMessage(err.message || "Retry structuring failed.");
    }
  };

  const isProcessing = step !== "idle" && step !== "error" && step !== "success";

  return (
    <div className="min-h-screen bg-[#f4f7f6] text-slate-800 font-sans py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Header Bar */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                <Zap className="w-3.5 h-3.5 text-teal-600" />
                PaddleOCR Neural Engine (~2s)
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                Gemini 3.5 Flash Structuring
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
              <Upload className="w-7 h-7 text-[#008080]" />
              Process Medical Prescription
            </h1>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Upload prescription images for real-time line extraction, entity normalization, and Drug Master verification.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              type="button"
              onClick={loadSamplePrescription}
              disabled={isProcessing || isLoadingSample}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-semibold shadow-xs transition-colors"
            >
              {isLoadingSample ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-teal-600" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-teal-600" />
              )}
              Load Sample Prescription
            </button>
            <button
              type="button"
              onClick={() => router.push("/patient")}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>

        <MedicalDisclaimer compact />

        {/* Main Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Document Drop & Preview (7 cols) */}
            <div className="lg:col-span-7 space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span className="flex items-center gap-1.5">
                  <FileImage className="w-4 h-4 text-teal-600" />
                  Prescription Document
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
                  className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[320px] ${
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

                  <h3 className="text-sm font-bold text-slate-900">
                    Choose or drop prescription image here
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm">
                    Upload camera photos or clinic scan printouts to parse text and clinical entities.
                  </p>

                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-medium border border-slate-200">
                      Handwritten Rx
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-medium border border-slate-200">
                      Printed Slips
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-medium border border-slate-200">
                      Discharge Cards
                    </span>
                  </div>
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
                          {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • {selectedFile.type || "image"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setZoomPreview(!zoomPreview)}
                        className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                        title={zoomPreview ? "Fit" : "Expand"}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {!isProcessing && (
                        <button
                          type="button"
                          onClick={handleRemoveFile}
                          className="p-1 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition-colors"
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
                        zoomPreview ? "max-h-[500px]" : "max-h-[280px]"
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

            {/* Right: Metadata & Form Controls (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Stethoscope className="w-4 h-4 text-teal-600" />
                    Patient Identification
                  </span>
                  <button
                    type="button"
                    onClick={generateRandomUhid}
                    className="text-[11px] font-bold text-teal-700 hover:underline flex items-center gap-1"
                  >
                    <Zap className="w-3 h-3 text-teal-600" />
                    Auto-Generate UHID
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Patient UHID / ID <span className="text-teal-600">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      disabled={isProcessing}
                      placeholder="e.g. UHID-2026-4821"
                      value={patientId}
                      onChange={(e) => setPatientId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-600 focus:bg-white transition-all"
                    />
                    {patientId && (
                      <span className="absolute right-2.5 top-2 text-emerald-600">
                        <Check className="w-4 h-4" />
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Unique 9-digit patient ID mapped in Supabase EHR.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Patient Full Name <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    disabled={isProcessing}
                    placeholder="e.g. Priyanka Sharma"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-600 focus:bg-white transition-all"
                  />
                  <div className="flex items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-slate-400">Suggestions:</span>
                    {["Rahul Sharma", "Priyanka Sharma", "Amit Patel"].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setPatientName(n)}
                        className="text-[10px] px-2 py-0.5 rounded bg-slate-100 hover:bg-teal-50 text-slate-600 hover:text-teal-700 border border-slate-200"
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Features Checklist */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                  <div className="font-bold text-slate-700 text-[11px] uppercase tracking-wider">
                    Pipeline Capabilities
                  </div>
                  <div className="space-y-1 text-slate-600 text-[11px]">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Medicines, strengths, dosages & frequencies</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Vital signs (BP, blood sugar, pulse, temp)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Drug Master validation & clinical safety gate</span>
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={!selectedFile || !patientId.trim() || isProcessing}
                  className="w-full flex items-center justify-center gap-2 bg-[#008080] hover:bg-[#006666] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold py-3 px-4 rounded-xl shadow-xs transition-colors"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Processing Prescription...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Analyze & Structure Prescription
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
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
                      Prescription Pipeline Running ({elapsedSeconds}s elapsed)
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      {step === "uploading" && "Optimizing image resolution & contrast enhancement..."}
                      {step === "ocr" && "PaddleOCR Neural Engine extracting text boxes & reading order..."}
                      {step === "structuring" && "Gemini AI structuring medications, dosages, vitals & conditions..."}
                      {step === "finalizing" && "Cross-referencing Drug Master & saving to Patient Summary..."}
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

              {/* Steps Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className={`p-2.5 rounded-xl border ${step === "uploading" ? "bg-teal-50 border-teal-300 text-teal-900" : "bg-emerald-50 border-emerald-300 text-emerald-800"}`}>
                  <div className="font-bold flex items-center gap-1.5 mb-0.5">
                    1. Preprocess
                  </div>
                  <div className="text-[10px] text-slate-400">1280px scaling</div>
                </div>

                <div className={`p-2.5 rounded-xl border ${step === "ocr" ? "bg-teal-50 border-teal-300 text-teal-900" : step === "structuring" || step === "finalizing" || step === "success" ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-slate-50 border-slate-200 text-slate-400"}`}>
                  <div className="font-bold flex items-center gap-1.5 mb-0.5">
                    2. PaddleOCR
                  </div>
                  <div className="text-[10px] text-slate-400">Line bounding boxes</div>
                </div>

                <div className={`p-2.5 rounded-xl border ${step === "structuring" ? "bg-teal-50 border-teal-300 text-teal-900" : step === "finalizing" || step === "success" ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-slate-50 border-slate-200 text-slate-400"}`}>
                  <div className="font-bold flex items-center gap-1.5 mb-0.5">
                    3. Gemini AI
                  </div>
                  <div className="text-[10px] text-slate-400">Clinical entities</div>
                </div>

                <div className={`p-2.5 rounded-xl border ${step === "finalizing" ? "bg-teal-50 border-teal-300 text-teal-900" : "bg-slate-50 border-slate-200 text-slate-400"}`}>
                  <div className="font-bold flex items-center gap-1.5 mb-0.5">
                    4. Safety & Sync
                  </div>
                  <div className="text-[10px] text-slate-400">Drug Master verify</div>
                </div>
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
                    className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-50"
                  >
                    Try Again
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push("/patient")}
                    className="px-3 py-1.5 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 font-semibold text-xs hover:bg-teal-100"
                  >
                    Check Patient Dashboard
                  </button>
                  {rawOcrId && (
                    <button
                      type="button"
                      onClick={handleRetryStructuring}
                      className="px-3 py-1.5 rounded-lg bg-rose-100 text-rose-800 font-semibold text-xs"
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
