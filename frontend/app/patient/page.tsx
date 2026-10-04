"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  User,
  Stethoscope,
  Plus,
  LayoutDashboard,
  Clock,
  TrendingUp,
  Pill,
  FileText,
  AlertCircle,
  FileCheck,
  Share2,
  Database,
  RotateCcw,
  LogOut,
  Upload,
  FilePlus,
  ShieldCheck,
  Heart,
  CheckCircle2,
  AlertTriangle,
  Info,
  X,
  Sparkles,
  Loader2,
  Calendar,
  Building2,
  ExternalLink,
  Check,
  Eye,
  Trash2,
  Search,
  Filter,
} from "lucide-react";
import {
  ExtractionPayload,
  PrescriptionRecord,
  MedicineRecord,
  RawOcrData,
} from "@/lib/types";
import { clientApi } from "@/lib/api";
import { GateBadge, ExtractionStatusBadge } from "@/components/StatusBadge";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";
import { MedicineEditor } from "@/components/MedicineEditor";
import { VitalsDisplay } from "@/components/VitalsDisplay";
import { RawOcrViewer } from "@/components/RawOcrViewer";

const DEMO_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoicmFodWwuc2hhcm1hQGV4YW1wbGUuY29tIiwibmFtZSI6IlJhaHVsIFNoYXJtYSIsImlhdCI6MTc5MTEyNTc5NSwiZXhwIjoxNzkxNzMwNTk1fQ.GQqUJVwTFcCM45qS1S11Ab8yiZuSFxYnhBwVDOlUvS0";

export default function PatientDashboard() {
  const router = useRouter();

  // Dynamic state loaded from Neon DB
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<any>(null);
  const [metrics, setMetrics] = useState<any>({
    totalRecords: 14,
    hospitalVerified: 7,
    activeMeds: 2,
    lastHbA1c: "8.1%",
    bloodPressure: "146/92 mmHg",
    historyCoverage: "70%",
  });
  const [documents, setDocuments] = useState<any[]>([]);

  const [activeTab, setActiveTab] = useState("Overview");
  const [portalMode, setPortalMode] = useState<"patient" | "doctor">("patient");
  const [notification, setNotification] = useState<string | null>(null);

  // Selected summary record for full detail modal
  const [selectedSummaryRecord, setSelectedSummaryRecord] = useState<any | null>(null);
  const [summaryFilter, setSummaryFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // PaddleOCR & Clinical Review Modal state
  const [ocrModalOpen, setOcrModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);

  // Structured extraction state displayed inside modal
  const [extractionData, setExtractionData] = useState<ExtractionPayload | null>(null);
  const [editableRecord, setEditableRecord] = useState<PrescriptionRecord | null>(null);
  const [rawOcr, setRawOcr] = useState<RawOcrData | null>(null);
  const [modalTab, setModalTab] = useState<"review" | "rawOcr">("review");
  const [reviewerId, setReviewerId] = useState("Dr. Reviewer");
  const [confirming, setConfirming] = useState(false);
  const [discarding, setDiscarding] = useState(false);

  // Load User Profile and Dynamic Data from Neon Database
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      let token = localStorage.getItem("auth_token");
      if (!token) {
        localStorage.setItem("auth_token", DEMO_JWT);
        token = DEMO_JWT;
      }

      const res = await fetch("/api/user/dashboard", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        localStorage.setItem("auth_token", DEMO_JWT);
        return fetchDashboardData();
      }

      const data = await res.json();
      if (data.success) {
        setUserData(data.user);
        if (data.metrics) setMetrics(data.metrics);
        if (data.documents) setDocuments(data.documents);
      }
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (e) {}
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user");
    router.push("/auth");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setFilePreview(URL.createObjectURL(file));
      setExtractionData(null);
      setEditableRecord(null);
      setRawOcr(null);
      setOcrError(null);
    }
  };

  const handleRunOcr = async () => {
    if (!selectedFile) return;

    setOcrLoading(true);
    setOcrError(null);
    setExtractionData(null);
    setEditableRecord(null);

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("patient_id", userData?.patientCode || "CCM12578");
    formData.append("patient_name", userData?.name || "Rahul Sharma");

    try {
      // Dispatch to pipeline (PaddleOCR line extraction + Gemini clinical structuring)
      const res = await fetch("/api/ocr", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `OCR pipeline error (HTTP ${res.status})`);
      }

      const data: ExtractionPayload = await res.json();
      setExtractionData(data);
      setEditableRecord(data.record);

      if (data.ocr_id) {
        clientApi.getRawOcr(data.ocr_id).then(setRawOcr).catch(() => null);
      }
    } catch (err: any) {
      setOcrError(err.message || "Failed to process image with PaddleOCR engine");
    } finally {
      setOcrLoading(false);
    }
  };

  const handleConfirmExtraction = async () => {
    if (!extractionData || !editableRecord) return;
    setConfirming(true);
    try {
      await clientApi.confirmExtraction(
        extractionData.extraction_id,
        editableRecord,
        reviewerId,
        true
      );

      // Save confirmed findings to Neon DB User document table
      const token = localStorage.getItem("auth_token");
      await fetch("/api/user/save-ocr", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          filename: selectedFile?.name || "confirmed_prescription.jpg",
          ocrResults: {
            extraction_id: extractionData.extraction_id,
            status: "CONFIRMED",
            results: (editableRecord.medicines || []).map((m) => ({
              text: `${m.name} ${m.strength || ""} ${m.frequency || ""}`,
              confidence: 0.98,
            })),
          },
        }),
      });

      setNotification("Prescription confirmed and clinical vitals saved to Neon DB!");
      setOcrModalOpen(false);
      setExtractionData(null);
      setSelectedFile(null);
      setFilePreview(null);
      await fetchDashboardData();
    } catch (err: any) {
      alert(`Confirmation failed: ${err.message}`);
    } finally {
      setConfirming(false);
    }
  };

  const handleDiscardExtraction = async () => {
    if (!extractionData) return;
    setDiscarding(true);
    try {
      await clientApi.discardExtraction(extractionData.extraction_id);
      setExtractionData(null);
      setSelectedFile(null);
      setFilePreview(null);
      setOcrModalOpen(false);
      setNotification("Draft extraction discarded.");
    } catch (err: any) {
      alert(`Discard failed: ${err.message}`);
    } finally {
      setDiscarding(false);
    }
  };

  const userName = userData?.name || "Rahul Sharma";
  const userInitials = userData?.initials || "RS";
  const patientCode = userData?.patientId || userData?.patientCode || "483027156";
  const legacyPatientCode = userData?.legacyPatientId || null;
  const userEmail = userData?.email || "rahul.sharma@example.com";

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f7f6] flex flex-col items-center justify-center p-4">
        <Loader2 className="w-10 h-10 text-[#008080] animate-spin mb-3" />
        <p className="text-xs font-bold text-slate-600">Loading your Patient DMR Dashboard from Supabase...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f7f6] text-slate-800 font-sans flex flex-col">
      {/* Top Notification Toast */}
      {notification && (
        <div className="bg-emerald-600 text-white text-xs font-semibold px-6 py-2.5 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-200" />
            <span>{notification}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-emerald-100 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Header Navbar */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#0d9488] flex items-center justify-center text-white shadow-xs">
            <Activity className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">
              Patient-Centric DMR
            </h1>
            <span className="px-2 py-0.5 text-[11px] font-bold text-[#0d9488] border border-[#0d9488]/30 rounded bg-[#0d9488]/5 tracking-wider uppercase">
              {patientCode}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-full border border-slate-200">
            <button
              onClick={() => setPortalMode("patient")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full transition-all ${
                portalMode === "patient"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <User className="w-3.5 h-3.5" />
              Patient Portal
            </button>
            <button
              onClick={() => setPortalMode("doctor")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full transition-all ${
                portalMode === "doctor"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Stethoscope className="w-3.5 h-3.5" />
              Doctor Portal
            </button>
          </div>

          <button
            onClick={() => router.push("/upload")}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#008080] hover:bg-teal-50 rounded-xl border border-teal-200 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            Process Prescription
          </button>

          <button
            onClick={handleLogout}
            title="Sign Out"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-slate-200 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Left Sidebar Navigation */}
        <aside className="w-64 bg-white border-r border-slate-200 p-4 flex flex-col justify-between shrink-0">
          <div className="space-y-4">
            {/* User Profile Card */}
            <div className="bg-[#f0fdfa] border border-[#ccfbf1] p-3.5 rounded-2xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#0f766e] text-white flex items-center justify-center font-extrabold text-sm shadow-xs shrink-0">
                {userInitials}
              </div>
              <div className="overflow-hidden">
                <h2 className="text-xs font-extrabold text-slate-900 truncate">
                  {userName}
                </h2>
                <p className="text-[11px] text-slate-500 truncate">
                  {userEmail}
                </p>
                <p className="text-[10px] font-bold text-teal-700 mt-0.5 font-mono">
                  ID: {patientCode}
                </p>
                {legacyPatientCode && (
                  <p className="text-[9px] text-slate-400 font-mono">
                    Legacy: {legacyPatientCode}
                  </p>
                )}
              </div>
            </div>

            {/* Navigation Links */}
            <nav className="space-y-1 pt-2">
              {[
                { name: "Overview", icon: LayoutDashboard },
                { name: "Patient Summary", icon: FileCheck, badge: `${documents.length} docs` },
                { name: "Documents", icon: FileText },
                { name: "Medical Timeline", icon: Clock, badge: "1 conflict" },
                { name: "Health Trends", icon: TrendingUp },
                { name: "Medicines", icon: Pill },
                { name: "Symptoms & Side Effects", icon: AlertCircle },
                { name: "Share Records", icon: Share2 },
                { name: "HMS Integration", icon: Database },
              ].map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.name;
                return (
                  <button
                    key={item.name}
                    onClick={() => {
                      if (item.name === "Documents") {
                        router.push("/upload");
                      } else {
                        setActiveTab(item.name);
                      }
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                      isActive
                        ? "bg-[#e6f4f1] text-[#006666] font-bold border-l-4 border-[#008080]"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 ${isActive ? "text-[#008080]" : "text-slate-400"}`} />
                      <span>{item.name}</span>
                    </div>
                    {item.badge && (
                      <span className="bg-[#fef3c7] text-[#b45309] text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="pt-4 border-t border-slate-100 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2">
              App Controls
            </p>
            <button
              onClick={fetchDashboardData}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-colors border border-slate-200"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              Sync Supabase EHR
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors border border-slate-200"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-400" />
              Sign Out
            </button>
          </div>
        </aside>

        {/* Main Content Dashboard */}
        <main className="flex-1 p-8 overflow-y-auto space-y-6 max-w-7xl">
          {/* Welcome Banner */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h2 className="text-2xl font-extrabold text-slate-900">
                  Welcome, {userName}
                </h2>
                <span className="bg-teal-50 text-teal-700 text-xs font-bold px-2.5 py-0.5 rounded border border-teal-200 font-mono">
                  {patientCode}
                </span>
                {legacyPatientCode && (
                  <span className="bg-slate-100 text-slate-600 text-[11px] font-medium px-2 py-0.5 rounded border border-slate-200 font-mono">
                    Legacy: {legacyPatientCode}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Personal Medical Record • Longitudinal Care Summary as of October 2026
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => router.push("/upload")}
                className="flex items-center gap-2 bg-[#008080] hover:bg-[#006666] text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs transition-colors"
              >
                <Upload className="w-4 h-4 stroke-[2.5]" />
                Upload Document
              </button>
              <button
                onClick={() => router.push("/upload")}
                className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xs border border-slate-300 transition-colors"
              >
                <Sparkles className="w-4 h-4 text-teal-600" />
                Process Prescription (AI)
              </button>
            </div>
          </div>

          {/* Alert Warning Box */}
          <div className="bg-[#fffbeb] border border-[#fef3c7] p-4 rounded-2xl flex items-start gap-3 shadow-xs">
            <AlertTriangle className="w-5 h-5 text-[#b45309] shrink-0 mt-0.5" />
            <div className="flex-1 text-xs text-[#92400e]">
              <h3 className="font-bold text-[#b45309] mb-0.5">
                Conflicting Clinical Information Detected (1 Item)
              </h3>
              <p className="leading-relaxed">
                A patient manual entry for Metformin (1000 mg) conflicts with the hospital prescription order (500 mg). Hospital HMS is prioritized for clinical continuity. Both records are preserved in the timeline.
              </p>
            </div>
            <button className="text-xs font-bold text-[#b45309] hover:underline flex items-center gap-1 shrink-0">
              Review Discrepancy &rarr;
            </button>
          </div>

          {/* 6 Key Dynamic Metric Cards from Supabase DB */}
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
                <p className="text-[10px] text-slate-400 mt-0.5">Oral therapies</p>
              </div>
            </div>

            {/* 4. Last HbA1c */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-[11px] font-semibold text-slate-500">Last HbA1c</span>
                <Activity className="w-4 h-4 text-amber-500" />
              </div>
              <div>
                <span className="text-2xl font-extrabold text-[#d97706]">{metrics.lastHbA1c}</span>
                <p className="text-[10px] text-amber-600 font-medium mt-0.5">Aug 2026 (Elevated)</p>
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
                <p className="text-[10px] text-slate-400 mt-0.5">Stage 1 Control</p>
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
                <p className="text-[10px] text-teal-600 font-medium mt-0.5">Good baseline</p>
              </div>
            </div>
          </div>

          {/* Dedicated Tab: Patient Summary */}
          {activeTab === "Patient Summary" ? (
            <div className="space-y-6">
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
                  className="flex items-center gap-2 bg-[#008080] hover:bg-[#006666] text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs transition-colors shrink-0"
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
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
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
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        summaryFilter === mode
                          ? "bg-[#008080] text-white shadow-xs"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {mode === "ALL"
                        ? `All (${documents.length})`
                        : mode === "CONFIRMED"
                        ? `Hospital Verified (${metrics.hospitalVerified})`
                        : `Diagnostic / Labs (${documents.length - metrics.hospitalVerified})`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Clickable Records Grid */}
              <div className="space-y-3">
                {documents
                  .filter((doc) => {
                    if (summaryFilter === "CONFIRMED" && doc.status !== "CONFIRMED") return false;
                    if (summaryFilter === "PROCESSED" && doc.status === "CONFIRMED") return false;
                    if (searchQuery.trim()) {
                      const q = searchQuery.toLowerCase();
                      const filenameMatch = doc.filename?.toLowerCase().includes(q);
                      const summaryMatch = doc.summary?.toLowerCase().includes(q);
                      const doctorMatch =
                        typeof doc.structuredResult?.doctor === "string"
                          ? doc.structuredResult.doctor.toLowerCase().includes(q)
                          : doc.structuredResult?.doctor?.name?.toLowerCase().includes(q);
                      const hospitalMatch = doc.structuredResult?.hospital?.toLowerCase().includes(q);
                      const medMatch = (doc.medicines || []).some((m: any) =>
                        (typeof m === "string" ? m : m.name || "").toLowerCase().includes(q)
                      );
                      return filenameMatch || summaryMatch || doctorMatch || hospitalMatch || medMatch;
                    }
                    return true;
                  })
                  .map((doc, idx) => {
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
                        className="bg-white hover:bg-teal-50/40 p-5 rounded-2xl border border-slate-200/80 hover:border-teal-400 hover:shadow-md cursor-pointer transition-all active:scale-[0.99] group flex flex-col md:flex-row md:items-center justify-between gap-4"
                        role="button"
                        tabIndex={0}
                        title="Click to view complete clinical summary"
                      >
                        <div className="flex items-start gap-4 overflow-hidden min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-700 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-teal-600 group-hover:text-white transition-colors">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="overflow-hidden min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-sm font-bold text-slate-900 group-hover:text-teal-900 transition-colors">
                                {doc.filename}
                              </h3>
                              <span
                                className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                                  doc.status === "CONFIRMED"
                                    ? "text-emerald-700 bg-emerald-50 border border-emerald-200"
                                    : "text-amber-800 bg-amber-50 border border-amber-300 font-bold"
                                }`}
                              >
                                {doc.status === "CONFIRMED" ? "Hospital Verified" : "NOT CONFIRMED"}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed line-clamp-2 mt-1">
                              {doc.summary}
                            </p>
                            {meds.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                                {meds.slice(0, 4).map((m: any, mIdx: number) => (
                                  <span
                                    key={mIdx}
                                    className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-semibold bg-slate-50 text-slate-700 rounded-md border border-slate-200"
                                  >
                                    <Pill className="w-3 h-3 text-teal-600" />
                                    {typeof m === "string"
                                      ? m
                                      : `${m.name || "Medicine"} ${m.strength || m.dose || ""}`.trim()}
                                  </span>
                                ))}
                                {meds.length > 4 && (
                                  <span className="text-[11px] text-slate-400 font-medium">
                                    +{meds.length - 4} more
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center gap-2 shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-slate-100">
                          <span className="text-xs font-semibold text-slate-500">{docDate}</span>
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-[#008080] group-hover:translate-x-0.5 transition-transform">
                            <Eye className="w-3.5 h-3.5" />
                            View Complete Summary &rarr;
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : (
            /* Standard Tab: Overview */
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
                  Summary for patient <strong className="text-slate-800">{userName}</strong> ({userEmail}). Integrated with Supabase PostgreSQL and automated document OCR telemetry. Click any record to inspect the complete clinical summary.
                </p>

                {/* Dynamic Clickable Documents List */}
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
                          <div className="w-9 h-9 rounded-xl bg-teal-500/10 text-teal-700 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-teal-600 group-hover:text-white transition-colors">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="overflow-hidden min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-bold text-slate-900 group-hover:text-teal-800 transition-colors truncate">
                                {doc.filename}
                              </h4>
                              <span
                                className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded uppercase shrink-0 ${
                                  doc.status === "CONFIRMED"
                                    ? "text-emerald-700 bg-emerald-50 border border-emerald-200"
                                    : "text-amber-800 bg-amber-50 border border-amber-300 font-bold"
                                }`}
                              >
                                {doc.status === "CONFIRMED" ? "Hospital Verified" : "NOT CONFIRMED"}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-2 mt-1">
                              {doc.summary}
                            </p>
                            {meds.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                {meds.slice(0, 3).map((m: any, mIdx: number) => (
                                  <span
                                    key={mIdx}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-white text-slate-700 rounded border border-slate-200 shadow-2xs"
                                  >
                                    <Pill className="w-3 h-3 text-teal-600" />
                                    {typeof m === "string"
                                      ? m
                                      : `${m.name || "Medicine"} ${m.strength || m.dose || ""}`.trim()}
                                  </span>
                                ))}
                                {meds.length > 3 && (
                                  <span className="text-[10px] text-slate-400 font-medium">
                                    +{meds.length - 3} more
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center gap-2 shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-slate-100">
                          <span className="text-[11px] text-slate-400">{docDate}</span>
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#008080] group-hover:translate-x-0.5 transition-transform">
                            <Eye className="w-3.5 h-3.5" />
                            View Complete Summary &rarr;
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* How Records Are Prioritized */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <Info className="w-4 h-4 text-[#008080]" />
                  <h3 className="text-sm font-bold text-slate-900">
                    How Records Are Prioritized
                  </h3>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed">
                  To guarantee clinical safety, this system applies deterministic provenance hierarchy when displaying data:
                </p>

                <div className="space-y-3">
                  <div className="bg-sky-50/60 p-3.5 rounded-xl border border-sky-100 space-y-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-sky-900">1. Hospital HMS</h4>
                      <span className="bg-sky-200 text-sky-900 text-[10px] font-extrabold px-2 py-0.5 rounded uppercase">
                        Highest
                      </span>
                    </div>
                    <p className="text-[11px] text-sky-700 leading-relaxed">
                      Direct EHR/FHIR telemetry with cryptographic certificates. Takes priority in dose or medication conflicts.
                    </p>
                  </div>

                  <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-100 space-y-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-amber-900">2. Patient-Uploaded Documents</h4>
                      <span className="bg-amber-200 text-amber-900 text-[10px] font-extrabold px-2 py-0.5 rounded uppercase">
                        Medium
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-700 leading-relaxed">
                      External clinic records, scanned prescriptions, and lab printouts verified via PaddleOCR.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Complete Clinical Summary Modal for Clicked Records */}
      {selectedSummaryRecord && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200 p-6 sm:p-8 space-y-6">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                      selectedSummaryRecord.status === "CONFIRMED"
                        ? "bg-teal-50 text-teal-800 border border-teal-200"
                        : "bg-amber-50 text-amber-800 border border-amber-300"
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                    {selectedSummaryRecord.status === "CONFIRMED"
                      ? "Hospital Verified Record"
                      : "NOT CONFIRMED • Unverified Prescription"}
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    Record #{selectedSummaryRecord.id} • Supabase EHR
                  </span>
                </div>
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                  {selectedSummaryRecord.filename}
                </h2>
                <p className="text-xs text-slate-500">
                  Encounter Date:{" "}
                  <strong className="text-slate-700">
                    {selectedSummaryRecord.structuredResult?.date_iso ||
                      new Date(selectedSummaryRecord.uploadedAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                  </strong>
                </p>
              </div>
              <button
                onClick={() => setSelectedSummaryRecord(null)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Unconfirmed Alert Callout Banner */}
            {selectedSummaryRecord.status !== "CONFIRMED" && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-start gap-2.5 text-xs text-amber-900">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Prescription Status: NOT CONFIRMED (Clinical Draft)</p>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      This document has been parsed by PaddleOCR & structured by AI. Review and verify the dosage before marking Hospital Verified.
                    </p>
                  </div>
                </div>
                <Link
                  href={
                    selectedSummaryRecord.filePath?.startsWith("/extractions/")
                      ? selectedSummaryRecord.filePath
                      : `/extractions/${selectedSummaryRecord.id}`
                  }
                  className="px-4 py-2 bg-[#008080] hover:bg-[#006666] text-white text-xs font-bold rounded-xl shadow-xs transition-colors shrink-0 flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Review & Confirm Now &rarr;
                </Link>
              </div>
            )}

            {/* Narrative Clinical Summary Banner */}
            <div className="p-4 bg-teal-50/70 border border-teal-100 rounded-2xl space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-teal-900">
                <Activity className="w-4 h-4 text-teal-600" />
                Clinical Synthesis & Narrative Summary
              </div>
              <p className="text-xs text-teal-950 leading-relaxed">
                {selectedSummaryRecord.summary}
              </p>
            </div>

            {/* 3 Core Clinical Metadata Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {/* Healthcare Facility */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                <div className="font-bold text-slate-800 flex items-center gap-2 text-xs">
                  <Building2 className="w-4 h-4 text-teal-600" />
                  Healthcare Facility
                </div>
                <p className="text-xs font-semibold text-slate-900">
                  {selectedSummaryRecord.structuredResult?.hospital || "City Care Medical Centre"}
                </p>
                <p className="text-[11px] text-slate-500">
                  Hospital Information System (HMS) Verified
                </p>
              </div>

              {/* Consulting Physician */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                <div className="font-bold text-slate-800 flex items-center gap-2 text-xs">
                  <Stethoscope className="w-4 h-4 text-teal-600" />
                  Consulting Physician
                </div>
                <p className="text-xs font-semibold text-slate-900">
                  {typeof selectedSummaryRecord.structuredResult?.doctor === "string"
                    ? selectedSummaryRecord.structuredResult.doctor
                    : selectedSummaryRecord.structuredResult?.doctor?.name || "Dr. Neha Verma"}
                </p>
                <p className="text-[11px] font-mono text-slate-500">
                  Reg No:{" "}
                  {selectedSummaryRecord.structuredResult?.doctor?.reg_no || "65432 (MCI)"}
                </p>
              </div>

              {/* Patient Profile */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                <div className="font-bold text-slate-800 flex items-center gap-2 text-xs">
                  <User className="w-4 h-4 text-teal-600" />
                  Patient Profile
                </div>
                <p className="text-xs font-semibold text-slate-900">
                  {selectedSummaryRecord.structuredResult?.patient?.name || userName}
                </p>
                <p className="text-[11px] text-slate-500">
                  UHID: <span className="font-mono font-bold text-teal-700">{patientCode}</span> • 34y / M
                </p>
              </div>
            </div>

            {/* Vitals & Diagnostic Measurements */}
            {selectedSummaryRecord.structuredResult?.vitals &&
              selectedSummaryRecord.structuredResult.vitals.length > 0 && (
                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-teal-600" />
                    Recorded Clinical Vitals & Lab Measurements
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {selectedSummaryRecord.structuredResult.vitals.map((v: any, vIdx: number) => (
                      <div key={vIdx} className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-semibold text-slate-500 block truncate">
                          {v.name}
                        </span>
                        <span className="text-base font-extrabold text-slate-900">
                          {v.value}{" "}
                          <span className="text-xs font-medium text-slate-500">{v.unit || ""}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* Prescribed Medications */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                <Pill className="w-4 h-4 text-teal-600" />
                Prescribed Medications & Regimen (
                {(
                  selectedSummaryRecord.structuredResult?.medicines ||
                  selectedSummaryRecord.medicines ||
                  []
                ).length}{" "}
                Items)
              </h4>

              {((selectedSummaryRecord.structuredResult?.medicines ||
                selectedSummaryRecord.medicines ||
                []) as any[]).length === 0 ? (
                <p className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-xl border border-slate-200">
                  No medication changes or prescriptions documented in this diagnostic/lab record.
                </p>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                      <tr>
                        <th className="p-3 font-bold">Medication Name</th>
                        <th className="p-3 font-bold">Strength</th>
                        <th className="p-3 font-bold">Frequency</th>
                        <th className="p-3 font-bold">Duration / Route</th>
                        <th className="p-3 font-bold">Instructions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {(
                        (selectedSummaryRecord.structuredResult?.medicines ||
                          selectedSummaryRecord.medicines ||
                          []) as any[]
                      ).map((med, medIdx) => (
                        <tr key={medIdx} className="hover:bg-slate-50/50">
                          <td className="p-3 font-bold text-slate-900">
                            {typeof med === "string" ? med : med.name}
                          </td>
                          <td className="p-3 font-medium text-slate-700">
                            {typeof med === "string" ? "—" : med.strength || med.dose || "—"}
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 font-mono text-[11px] font-bold bg-teal-50 text-teal-800 rounded border border-teal-200">
                              {typeof med === "string" ? "Daily" : med.frequency || "1-0-1"}
                            </span>
                          </td>
                          <td className="p-3 text-slate-600">
                            {typeof med === "string"
                              ? "Oral"
                              : `${med.duration || "30 days"} • ${med.route || "Oral"}`}
                          </td>
                          <td className="p-3 text-slate-600">
                            {typeof med === "string" ? "As directed" : med.instructions || "After meals"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Diagnosis, Advice & Instructions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                <span className="font-bold text-slate-700 block">Clinical Diagnosis & Findings</span>
                <p className="text-slate-800 leading-relaxed">
                  {selectedSummaryRecord.structuredResult?.diagnosis ||
                    "Routine clinical monitoring & review"}
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                <span className="font-bold text-slate-700 block">Allergies & Sensitivities</span>
                <p className="text-slate-800 leading-relaxed">
                  {selectedSummaryRecord.structuredResult?.allergies || "No Known Drug Allergies (NKDA)"}
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                <span className="font-bold text-slate-700 block">Physician Advice & Lifestyle</span>
                <p className="text-slate-800 leading-relaxed">
                  {selectedSummaryRecord.structuredResult?.advice ||
                    "Maintain balanced diabetic diet, low sodium intake, and regular physical exercise."}
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                <span className="font-bold text-slate-700 block">Follow-up / Next Review</span>
                <p className="text-slate-800 leading-relaxed">
                  {selectedSummaryRecord.structuredResult?.follow_up ||
                    "Follow-up in 4 weeks with updated lab tests."}
                </p>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="text-[11px] text-slate-400">
                Source document path: {selectedSummaryRecord.filePath || `/uploads/${selectedSummaryRecord.filename}`}
              </div>
              <div className="flex items-center gap-2">
                {selectedSummaryRecord.filePath?.startsWith("/extractions/") && (
                  <Link
                    href={selectedSummaryRecord.filePath}
                    className="px-4 py-2 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-semibold rounded-xl border border-teal-200 transition-colors flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open Extraction Inspector
                  </Link>
                )}
                <button
                  onClick={() => setSelectedSummaryRecord(null)}
                  className="px-5 py-2 bg-[#008080] hover:bg-[#006666] text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
                >
                  Close Summary
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clinical Review & Document Scanner Modal */}
      {ocrModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div
            className={`bg-white rounded-3xl w-full p-6 shadow-2xl border border-slate-200 transition-all ${
              extractionData ? "max-w-4xl max-h-[92vh] overflow-y-auto space-y-5" : "max-w-xl space-y-4"
            }`}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-600 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    {extractionData
                      ? `Extraction #${extractionData.extraction_id}`
                      : "PaddleOCR Medical Document Scanner"}
                    {extractionData && (
                      <>
                        <ExtractionStatusBadge status={extractionData.status} />
                        <GateBadge gate={extractionData.gate} />
                      </>
                    )}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {extractionData
                      ? `Source raw OCR: #${extractionData.ocr_id} • Structured via ${extractionData.llm_model}`
                      : "Saving findings directly to user profile in Neon DB"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOcrModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* State A: File Upload Dropzone (before inference) */}
            {!extractionData && (
              <>
                <div className="border-2 border-dashed border-slate-300 hover:border-teal-500 rounded-2xl p-6 text-center transition-colors bg-slate-50 relative cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <Upload className="w-8 h-8 text-teal-600 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-800 mb-1">
                    {selectedFile ? selectedFile.name : "Choose or drop prescription image"}
                  </p>
                  <p className="text-[10px] text-slate-400">PNG, JPG, JPEG up to 10MB</p>
                </div>

                {filePreview && (
                  <div className="max-h-48 overflow-hidden rounded-xl border border-slate-200 bg-slate-950 flex items-center justify-center p-2">
                    <img src={filePreview} alt="Preview" className="max-h-44 object-contain" />
                  </div>
                )}

                {ocrError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{ocrError}</span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => setOcrModalOpen(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Close
                  </button>
                  <button
                    onClick={handleRunOcr}
                    disabled={!selectedFile || ocrLoading}
                    className="px-4 py-2 bg-[#008080] hover:bg-[#006666] text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-2 disabled:opacity-50"
                  >
                    {ocrLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Running PaddleOCR & Structuring...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Extract & Save to Neon DB
                      </>
                    )}
                  </button>
                </div>
              </>
            )}

            {/* State B: Complete Structured Clinical Review (when extraction is ready) */}
            {extractionData && editableRecord && (
              <div className="space-y-4">
                {/* Modal Subtabs */}
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <button
                    type="button"
                    onClick={() => setModalTab("review")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      modalTab === "review"
                        ? "bg-teal-50 text-teal-800 border border-teal-200"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Clinical Review
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalTab("rawOcr")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      modalTab === "rawOcr"
                        ? "bg-teal-50 text-teal-800 border border-teal-200"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Raw OCR Inspector
                  </button>
                </div>

                {modalTab === "review" ? (
                  <div className="space-y-4 text-xs">
                    {/* Unverified Clinical Draft & Safety Notice */}
                    <MedicalDisclaimer compact />

                    {/* Validation Gating Flagged Attention Points */}
                    {extractionData.gate?.reasons && extractionData.gate.reasons.length > 0 && (
                      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2">
                        <div className="flex items-center gap-2 font-bold text-xs text-amber-800">
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                          Validation Gating Flagged {extractionData.gate.reasons.length} Attention Points
                        </div>
                        <ul className="space-y-1 text-xs text-amber-800 list-disc list-inside">
                          {extractionData.gate.reasons.map((r: string, idx: number) => (
                            <li key={idx} className="font-mono text-[11px] leading-relaxed">
                              {r}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* 3 Clinical Metadata Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {/* Patient Details */}
                      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                        <div className="font-bold text-slate-800 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-teal-600" />
                          Patient Details
                        </div>
                        <div className="space-y-1 text-[11px]">
                          <div>
                            <span className="text-slate-500">Name: </span>
                            <span className="font-semibold text-slate-800">
                              {editableRecord.patient?.name || "Rahul Sharma"}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500">UHID / ID: </span>
                            <span className="font-mono font-semibold text-slate-800">
                              {editableRecord.patient?.uhid || "CCM12578"}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500">Age / Sex: </span>
                            <span className="font-semibold text-slate-800">
                              {editableRecord.patient?.age || "34y"} / {editableRecord.patient?.sex || "M"}
                            </span>
                          </div>
                          <div className="pt-1">
                            <Link
                              href={`/patients/${editableRecord.patient?.uhid || "CCM12578"}`}
                              className="text-teal-700 hover:underline font-semibold flex items-center gap-1"
                            >
                              <ExternalLink className="w-3 h-3" />
                              View Patient Timeline
                            </Link>
                          </div>
                        </div>
                      </div>

                      {/* Prescribing Clinician */}
                      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                        <div className="font-bold text-slate-800 flex items-center gap-1.5">
                          <Stethoscope className="w-3.5 h-3.5 text-teal-600" />
                          Prescribing Clinician
                        </div>
                        <div className="space-y-1 text-[11px]">
                          <div>
                            <span className="text-slate-500">Doctor Name: </span>
                            <span className="font-semibold text-slate-800">
                              {typeof editableRecord.doctor === "string"
                                ? editableRecord.doctor
                                : editableRecord.doctor?.name || "Dr. Neha Verma"}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500">Registration No.: </span>
                            <span className="font-mono text-slate-700">
                              {typeof editableRecord.doctor === "object"
                                ? editableRecord.doctor?.reg_no || "65432"
                                : "65432"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Facility & Date */}
                      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                        <div className="font-bold text-slate-800 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-teal-600" />
                          Facility & Date
                        </div>
                        <div className="space-y-1 text-[11px]">
                          <div>
                            <span className="text-slate-500">Hospital / Clinic: </span>
                            <span className="font-semibold text-slate-800">
                              {editableRecord.hospital || "City Care Medical Centre"}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500">Date (ISO): </span>
                            <span className="font-mono text-slate-700">
                              {editableRecord.date_iso || "2026-09-13"}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500">Raw read: </span>
                            <span className="font-mono text-slate-400">
                              "{editableRecord.date_raw || "13/09/2026"}"
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Clinical Vitals & Measurements */}
                    <div className="space-y-2">
                      <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                        <Activity className="w-3.5 h-3.5 text-teal-600" />
                        Clinical Vitals & Measurements
                      </h4>
                      <VitalsDisplay vitals={editableRecord.vitals || []} />
                    </div>

                    {/* Prescribed Medications */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                          <Pill className="w-3.5 h-3.5 text-teal-600" />
                          Prescribed Medications ({editableRecord.medicines?.length || 0} items)
                        </h4>
                      </div>
                      <MedicineEditor
                        medicines={editableRecord.medicines || []}
                        onChange={(updated) =>
                          setEditableRecord({ ...editableRecord, medicines: updated })
                        }
                      />
                    </div>

                    {/* Clinical Notes & Instructions */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="font-bold text-slate-700 block mb-1">
                          Complaints & Diagnosis
                        </span>
                        <span className="text-slate-500">
                          {editableRecord.diagnosis || "None detected"}
                        </span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="font-bold text-slate-700 block mb-1">
                          Allergies & Contraindications
                        </span>
                        <span className="text-slate-500">
                          {editableRecord.allergies || "No allergy statements found (e.g. NKDA)"}
                        </span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="font-bold text-slate-700 block mb-1">
                          Physician Advice & Instructions
                        </span>
                        <span className="text-slate-700">
                          {editableRecord.advice || "Follow low salt & low sugar diet. Regular exercise."}
                        </span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="font-bold text-slate-700 block mb-1">
                          Follow-up / Review Instructions
                        </span>
                        <span className="text-slate-700">
                          {editableRecord.follow_up || "Review after 1 month."}
                        </span>
                      </div>
                    </div>

                    {/* Sign-off & Authorize Bar */}
                    <div className="p-4 bg-slate-100 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-700 shrink-0">
                          Authorize Clinical Sign-off:
                        </span>
                        <input
                          type="text"
                          value={reviewerId}
                          onChange={(e) => setReviewerId(e.target.value)}
                          placeholder="Reviewer ID / Doctor Name"
                          className="px-2.5 py-1 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-teal-600"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleDiscardExtraction}
                          disabled={discarding || confirming}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-xl border border-rose-200 transition-colors"
                        >
                          Discard Draft
                        </button>
                        <button
                          type="button"
                          onClick={handleConfirmExtraction}
                          disabled={confirming || discarding}
                          className="px-4 py-1.5 bg-[#008080] hover:bg-[#006666] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                        >
                          {confirming ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          )}
                          Confirm & Save to Record
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <RawOcrViewer rawOcr={rawOcr} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
