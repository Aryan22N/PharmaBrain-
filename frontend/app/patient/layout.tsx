"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Activity,
  User,
  Stethoscope,
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
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Heart,
  Sparkles,
  X,
} from "lucide-react";
import { PatientDashboardProvider, usePatientDashboard } from "./context";
import { PatientModals } from "@/components/patient/PatientModals";

function Sidebar() {
  const { userData, documents, timelineEvents, recordedMedicines, refresh } = usePatientDashboard();
  const router = useRouter();
  const pathname = usePathname();

  const userName = userData?.name ?? "Rahul Sharma";
  const userInitials = userData?.initials ?? "RS";
  const patientCode = userData?.patientId ?? userData?.patientCode ?? "483027156";
  const legacyPatientCode = userData?.legacyPatientId ?? null;
  const userEmail = userData?.email ?? "rahul.sharma@example.com";

  const navItems = [
    { name: "Overview", href: "/patient/overview", icon: LayoutDashboard },
    {
      name: "Patient Summary",
      href: "/patient/summary",
      icon: FileCheck,
      badge: `${documents.length} docs`,
    },
    { name: "Documents", href: "/patient/documents", icon: FileText },
    {
      name: "Medical Timeline",
      href: "/patient/timeline",
      icon: Clock,
      badge: timelineEvents.some((e: any) => e.is_conflicting) ? "1 conflict" : undefined,
    },
    { name: "Health Trends", href: "/patient/trends", icon: TrendingUp },
    {
      name: "Medicines",
      href: "/patient/medicines",
      icon: Pill,
      badge: `${recordedMedicines.filter((m: any) => m.status === "ACTIVE").length || 2} active`,
    },
    { name: "Symptoms & Side Effects", href: "/patient/symptoms", icon: AlertCircle },
    { name: "Share Records", href: "/patient/share", icon: Share2 },
    { name: "HMS Integration", href: "/patient/hms", icon: Database },
  ];

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    if (typeof window !== "undefined") {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("user");
    }
    router.push("/auth");
  };

  return (
    <aside className="w-64 bg-white border-r border-slate-200 p-4 flex flex-col justify-between shrink-0">
      <div className="space-y-4">
        {/* User Profile Card */}
        <div className="bg-[#f0fdfa] border border-[#ccfbf1] p-3.5 rounded-2xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#0f766e] text-white flex items-center justify-center font-extrabold text-sm shadow-xs shrink-0">
            {userInitials}
          </div>
          <div className="overflow-hidden">
            <h2 className="text-xs font-extrabold text-slate-900 truncate">{userName}</h2>
            <p className="text-[11px] text-slate-500 truncate">{userEmail}</p>
            <p className="text-[10px] font-bold text-teal-700 mt-0.5 font-mono">ID: {patientCode}</p>
            {legacyPatientCode && (
              <p className="text-[9px] text-slate-400 font-mono">Legacy: {legacyPatientCode}</p>
            )}
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1 pt-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href === "/patient/overview" && pathname === "/patient");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
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
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      item.badge.includes("conflict")
                        ? "bg-[#fef3c7] text-[#b45309]"
                        : "bg-teal-50 text-teal-700 border border-teal-200"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="pt-4 border-t border-slate-100 space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2">
          App Controls
        </p>
        <button
          onClick={refresh}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-colors border border-slate-200 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
          Sync Supabase EHR
        </button>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors border border-slate-200 cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5 text-slate-400" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}

function TopHeader() {
  const { userData } = usePatientDashboard();
  const router = useRouter();
  const [portalMode, setPortalMode] = useState<"patient" | "doctor">("patient");
  const patientCode = userData?.patientId ?? userData?.patientCode ?? "483027156";

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    if (typeof window !== "undefined") {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("user");
    }
    router.push("/auth");
  };

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      <div className="flex items-center gap-3">
        <Link href="/patient/overview" className="w-8 h-8 rounded-lg bg-[#0d9488] flex items-center justify-center text-white shadow-xs">
          <Activity className="w-5 h-5 stroke-[2.5]" />
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/patient/overview" className="text-lg font-bold text-slate-900 tracking-tight hover:text-[#0d9488] transition-colors">
            Patient-Centric DMR
          </Link>
          <span className="px-2 py-0.5 text-[11px] font-bold text-[#0d9488] border border-[#0d9488]/30 rounded bg-[#0d9488]/5 tracking-wider uppercase font-mono">
            {patientCode}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-2 bg-slate-100 p-1 rounded-full border border-slate-200">
          <button
            onClick={() => setPortalMode("patient")}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full transition-all ${
              portalMode === "patient"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <User className="w-3.5 h-3.5" />
            Patient Portal
          </button>
          <button
            onClick={() => {
              setPortalMode("doctor");
              router.push(`/patients/${userData?.patientCode || "CCM12578"}`);
            }}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full transition-all ${
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
          <span className="hidden sm:inline">Sign Out</span>
        </button>
      </div>
    </header>
  );
}

function PatientLayoutContent({ children }: { children: React.ReactNode }) {
  const { userData, metrics, notification, setNotification } = usePatientDashboard();
  const router = useRouter();

  const userName = userData?.name ?? "Rahul Sharma";
  const patientCode = userData?.patientId ?? userData?.patientCode ?? "483027156";
  const legacyPatientCode = userData?.legacyPatientId ?? null;

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

      <TopHeader />

      <div className="flex flex-1">
        <Sidebar />

        <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl">
          {children}
        </main>
      </div>

      {/* Global Modals */}
      <PatientModals />
    </div>
  );
}

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  return (
    <PatientDashboardProvider>
      <PatientLayoutContent>{children}</PatientLayoutContent>
    </PatientDashboardProvider>
  );
}
