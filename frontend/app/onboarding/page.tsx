"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  HeartPulse,
  ShieldCheck,
  Plus,
  Trash2,
  SkipForward,
  Stethoscope,
  Check,
  MapPin,
  Loader2,
} from "lucide-react";

interface CustomCondition {
  id: string;
  name: string;
  year: string;
  details: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<number>(1);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form states initialized empty for actual patient entry
  const [basicInfo, setBasicInfo] = useState({
    name: "",
    age: "" as string | number,
    gender: "Male",
    bloodGroup: "",
    phone: "",
    emergencyName: "",
    emergencyPhone: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
  });

  useEffect(() => {
    // Attempt to load current user from API / localstorage
    const loadUserData = async () => {
      try {
        const token = localStorage.getItem("auth_token");
        const userStr = localStorage.getItem("user");
        if (userStr) {
          try {
            const u = JSON.parse(userStr);
            if (u.name) setBasicInfo((prev) => ({ ...prev, name: u.name }));
          } catch {}
        }
        const res = await fetch("/api/user/onboarding", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          if (data.profile?.basicInfo) {
            setBasicInfo((prev) => ({ ...prev, ...data.profile.basicInfo }));
          }
          if (data.profile?.conditions) {
            setConditions(data.profile.conditions);
          }
          if (Array.isArray(data.profile?.customConditions)) {
            setCustomConditions(data.profile.customConditions);
          }
          if (data.profile?.history) {
            setHistory(data.profile.history);
          }
        }
      } catch (err) {}
    };
    loadUserData();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const [conditions, setConditions] = useState({
    hasDiabetes: false,
    diabetesType: "",
    diabetesYear: "",
    currentHba1c: "",
    hasHypertension: false,
    hypertensionYear: "",
    currentBp: "",
    hasDyslipidemia: false,
  });

  const [customConditions, setCustomConditions] = useState<CustomCondition[]>([]);

  const [showAddCustom, setShowAddCustom] = useState(false);
  const [newCondName, setNewCondName] = useState("");
  const [newCondYear, setNewCondYear] = useState("");
  const [newCondDetails, setNewCondDetails] = useState("");

  const handleAddCustomCondition = () => {
    if (!newCondName.trim()) return;
    setCustomConditions([
      ...customConditions,
      {
        id: `c-${Date.now()}`,
        name: newCondName.trim(),
        year: newCondYear.trim() || new Date().getFullYear().toString(),
        details: newCondDetails.trim() || "Logged by patient",
      },
    ]);
    setNewCondName("");
    setNewCondYear("");
    setNewCondDetails("");
    setShowAddCustom(false);
    showToast(`Added condition: ${newCondName.trim()}`);
  };

  const handleQuickAddPreset = (name: string, defaultDetails: string) => {
    if (customConditions.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      showToast(`${name} is already added`);
      return;
    }
    setCustomConditions([
      ...customConditions,
      {
        id: `c-${Date.now()}`,
        name,
        year: new Date().getFullYear().toString(),
        details: defaultDetails,
      },
    ]);
    showToast(`Added ${name}`);
  };

  const handleRemoveCustomCondition = (id: string) => {
    setCustomConditions(customConditions.filter((c) => c.id !== id));
  };

  const [history, setHistory] = useState({
    surgeries: "",
    allergies: "",
    smoking: "",
    alcohol: "",
    familyHistory: "",
  });

  const handleNext = () => {
    if (step < 4) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem("auth_token");
      await fetch("/api/user/onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          basicInfo,
          conditions,
          customConditions,
          history,
        }),
      });
      showToast("Initial health context confirmed. Opening pharmaBrain Dashboard...");
      setTimeout(() => {
        router.push("/patient/overview");
      }, 700);
    } catch (err) {
      router.push("/patient/overview");
    } finally {
      setSaving(false);
    }
  };

  const stepLabels = [
    { num: 1, label: "Basic Info" },
    { num: 2, label: "Existing Conditions" },
    { num: 3, label: "Major History" },
    { num: 4, label: "Review & Coverage" },
  ];

  return (
    <div className="min-h-screen bg-[#f4f7f6] text-slate-800 font-sans flex flex-col">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#008080] text-white flex items-center justify-center font-bold shadow-xs">
            <Activity className="w-5 h-5 stroke-[2.5]" />
          </div>
          <span className="text-lg font-extrabold text-slate-900 tracking-tight">
            pharmaBrain
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-teal-800 bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
          <ShieldCheck className="w-4 h-4 text-teal-600" />
          <span>Initial Health Context Initialization</span>
        </div>
      </header>

      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-16 right-6 z-50 bg-[#008080] text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Title Section */}
        <div className="text-center max-w-xl mx-auto space-y-2">
          <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-teal-50 text-teal-800 border border-teal-200 uppercase tracking-wider">
            Initial Profile Initialization
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Establish Patient Health Context
          </h1>
          <p className="text-xs text-slate-500">
            Capturing baseline information to initialize your longitudinal medical record.
          </p>
        </div>

        {/* Stepper Header */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            {stepLabels.map((s, idx) => (
              <React.Fragment key={s.num}>
                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-extrabold text-xs transition-colors ${
                      step === s.num
                        ? "bg-[#008080] text-white ring-4 ring-teal-100 shadow-xs"
                        : step > s.num
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-100 text-slate-500 border border-slate-300"
                    }`}
                  >
                    {step > s.num ? <CheckCircle2 className="w-4 h-4" /> : s.num}
                  </div>
                  <span
                    className={`text-xs font-semibold text-center sm:text-left ${
                      step === s.num ? "text-slate-900 font-extrabold" : "text-slate-500"
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
                {idx < stepLabels.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 rounded ${
                      step > idx + 1 ? "bg-emerald-500" : "bg-slate-200"
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Stepper Card */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 sm:p-8 space-y-6">
          {/* STEP 1: Basic Info */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-base font-extrabold text-slate-900">Step 1: Patient Basic Demographics</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pre-populated baseline demographics for verification.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Full Legal Name</label>
                  <input
                    type="text"
                    value={basicInfo.name}
                    onChange={(e) => setBasicInfo({ ...basicInfo, name: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-semibold text-slate-900 focus:outline-none focus:border-[#008080] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Age & Biological Sex</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      value={basicInfo.age}
                      onChange={(e) => setBasicInfo({ ...basicInfo, age: Number(e.target.value) })}
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-semibold text-slate-900 focus:outline-none focus:border-[#008080] focus:bg-white"
                    />
                    <select
                      value={basicInfo.gender}
                      onChange={(e) => setBasicInfo({ ...basicInfo, gender: e.target.value })}
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-semibold text-slate-900 focus:outline-none focus:border-[#008080]"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Blood Group</label>
                  <input
                    type="text"
                    value={basicInfo.bloodGroup}
                    onChange={(e) => setBasicInfo({ ...basicInfo, bloodGroup: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-semibold text-slate-900 focus:outline-none focus:border-[#008080] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mobile Contact</label>
                  <input
                    type="text"
                    value={basicInfo.phone}
                    onChange={(e) => setBasicInfo({ ...basicInfo, phone: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-semibold text-slate-900 focus:outline-none focus:border-[#008080] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Emergency Contact Person</label>
                  <input
                    type="text"
                    value={basicInfo.emergencyName}
                    onChange={(e) => setBasicInfo({ ...basicInfo, emergencyName: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-semibold text-slate-900 focus:outline-none focus:border-[#008080] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Emergency Phone</label>
                  <input
                    type="text"
                    value={basicInfo.emergencyPhone}
                    onChange={(e) => setBasicInfo({ ...basicInfo, emergencyPhone: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-semibold text-slate-900 focus:outline-none focus:border-[#008080] focus:bg-white"
                  />
                </div>
              </div>

              {/* Address & Location Information */}
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-teal-700" />
                  <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                    Residential Address & Location Details
                  </h4>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    House / Building No., Street & Area Address
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Flat 402, Sunshine Heights, MG Road"
                    value={basicInfo.address}
                    onChange={(e) => setBasicInfo({ ...basicInfo, address: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white font-semibold text-slate-900 focus:outline-none focus:border-[#008080]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">City / District</label>
                    <input
                      type="text"
                      placeholder="e.g. Mumbai"
                      value={basicInfo.city}
                      onChange={(e) => setBasicInfo({ ...basicInfo, city: e.target.value })}
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white font-semibold text-slate-900 focus:outline-none focus:border-[#008080]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">State / Province</label>
                    <input
                      type="text"
                      placeholder="e.g. Maharashtra"
                      value={basicInfo.state}
                      onChange={(e) => setBasicInfo({ ...basicInfo, state: e.target.value })}
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white font-semibold text-slate-900 focus:outline-none focus:border-[#008080]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Pincode / ZIP Code</label>
                    <input
                      type="text"
                      placeholder="e.g. 400001"
                      value={basicInfo.pincode}
                      onChange={(e) => setBasicInfo({ ...basicInfo, pincode: e.target.value })}
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white font-semibold text-slate-900 focus:outline-none focus:border-[#008080]"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Existing Conditions with Conditional Fields */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Step 2: Existing Diagnosed Conditions</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Select existing conditions to open conditional clinical detail fields, or add custom conditions.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setConditions({
                      hasDiabetes: false,
                      diabetesType: "",
                      diabetesYear: "",
                      currentHba1c: "",
                      hasHypertension: false,
                      hypertensionYear: "",
                      currentBp: "",
                      hasDyslipidemia: false,
                    });
                    setCustomConditions([]);
                    showToast("Skipped Step 2: No continuous medications or active conditions logged");
                    handleNext();
                  }}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <SkipForward className="w-3.5 h-3.5 text-slate-500" />
                  <span>Skip if no medication in continuation</span>
                </button>
              </div>

              {/* Diabetes block */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-teal-700" />
                    <span className="text-xs font-extrabold text-slate-900">Diabetes Mellitus</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={conditions.hasDiabetes}
                    onChange={(e) => setConditions({ ...conditions, hasDiabetes: e.target.checked })}
                    className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                  />
                </div>

                {conditions.hasDiabetes && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Specific Diagnosis</label>
                      <input
                        type="text"
                        value={conditions.diabetesType}
                        onChange={(e) => setConditions({ ...conditions, diabetesType: e.target.value })}
                        className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white font-semibold text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Year of Diagnosis</label>
                      <input
                        type="text"
                        value={conditions.diabetesYear}
                        onChange={(e) => setConditions({ ...conditions, diabetesYear: e.target.value })}
                        className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white font-semibold text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Latest Known HbA1c</label>
                      <input
                        type="text"
                        value={conditions.currentHba1c}
                        onChange={(e) => setConditions({ ...conditions, currentHba1c: e.target.value })}
                        className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white font-semibold text-slate-900"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Hypertension block */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HeartPulse className="w-4 h-4 text-indigo-700" />
                    <span className="text-xs font-extrabold text-slate-900">Hypertension (High Blood Pressure)</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={conditions.hasHypertension}
                    onChange={(e) => setConditions({ ...conditions, hasHypertension: e.target.checked })}
                    className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                  />
                </div>

                {conditions.hasHypertension && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Year of Onset</label>
                      <input
                        type="text"
                        value={conditions.hypertensionYear}
                        onChange={(e) => setConditions({ ...conditions, hypertensionYear: e.target.value })}
                        className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white font-semibold text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Typical Blood Pressure</label>
                      <input
                        type="text"
                        value={conditions.currentBp}
                        onChange={(e) => setConditions({ ...conditions, currentBp: e.target.value })}
                        className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white font-semibold text-slate-900"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Custom Conditions Section */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Stethoscope className="w-4 h-4 text-teal-600" />
                    <span className="text-xs font-extrabold text-slate-900">Additional / Other Diagnosed Conditions</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddCustom(!showAddCustom)}
                    className="text-xs text-teal-800 font-bold hover:text-teal-900 flex items-center gap-1 cursor-pointer bg-teal-50 px-3 py-1 rounded-xl border border-teal-200"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Custom Condition</span>
                  </button>
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="text-[11px] text-slate-500 self-center font-bold">Quick Presets:</span>
                  <button
                    type="button"
                    onClick={() => handleQuickAddPreset("Hypothyroidism", "TSH: 4.2 uIU/mL • Levothyroxine therapy")}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-900 border border-slate-200 text-[11px] font-semibold transition-colors cursor-pointer"
                  >
                    + Hypothyroidism
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAddPreset("Asthma / COPD", "Maintenance inhaler twice daily")}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-900 border border-slate-200 text-[11px] font-semibold transition-colors cursor-pointer"
                  >
                    + Asthma / COPD
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAddPreset("GERD / Acid Reflux", "Antacid therapy before breakfast")}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-900 border border-slate-200 text-[11px] font-semibold transition-colors cursor-pointer"
                  >
                    + GERD / Acid Reflux
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAddPreset("Chronic Kidney Disease", "eGFR: 58 mL/min • Stage 3a")}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-900 border border-slate-200 text-[11px] font-semibold transition-colors cursor-pointer"
                  >
                    + CKD
                  </button>
                </div>

                {/* Inline Custom Form */}
                {showAddCustom && (
                  <div className="p-4 bg-teal-50/70 border border-teal-300 rounded-2xl space-y-3 shadow-xs">
                    <h4 className="text-xs font-extrabold text-teal-950 flex items-center gap-1.5">
                      <Plus className="w-4 h-4 text-teal-700" />
                      <span>Log Additional Diagnosed Condition</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Condition Name *</label>
                        <input
                          type="text"
                          placeholder="e.g. Hypothyroidism"
                          value={newCondName}
                          onChange={(e) => setNewCondName(e.target.value)}
                          className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white font-semibold text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Diagnosis Year</label>
                        <input
                          type="text"
                          placeholder="e.g. 2022"
                          value={newCondYear}
                          onChange={(e) => setNewCondYear(e.target.value)}
                          className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white font-semibold text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Clinical Vitals / Notes</label>
                        <input
                          type="text"
                          placeholder="e.g. TSH level 4.2..."
                          value={newCondDetails}
                          onChange={(e) => setNewCondDetails(e.target.value)}
                          className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white font-semibold text-slate-900"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAddCustom(false)}
                        className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-50 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleAddCustomCondition}
                        className="px-4 py-1.5 bg-[#008080] text-white text-xs font-bold rounded-lg hover:bg-[#006666] shadow-xs cursor-pointer flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Save Condition</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Rendered Custom Conditions List */}
                {customConditions.length > 0 && (
                  <div className="space-y-2 pt-1">
                    {customConditions.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-3 shadow-2xs"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-extrabold text-slate-900">{item.name}</span>
                            <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                              Diagnosed: {item.year}
                            </span>
                          </div>
                          {item.details && (
                            <p className="text-[11px] text-slate-500 font-medium">{item.details}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomCondition(item.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
                          title="Remove condition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: Major History */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="border-b border-slate-100 pb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Step 3: Major Past Medical History</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Record documented surgical interventions, known drug allergies, and social risk factors.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    showToast("Skipped Step 3: No major past medical history or allergies recorded");
                    handleNext();
                  }}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <SkipForward className="w-3.5 h-3.5 text-slate-500" />
                  <span>Skip this step</span>
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Allergies & Adverse Drug Reactions</label>
                <input
                  type="text"
                  value={history.allergies}
                  onChange={(e) => setHistory({ ...history, allergies: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white font-semibold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Past Surgeries & Hospitalizations</label>
                <input
                  type="text"
                  value={history.surgeries}
                  onChange={(e) => setHistory({ ...history, surgeries: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white font-semibold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Family Medical History</label>
                <textarea
                  rows={2}
                  value={history.familyHistory}
                  onChange={(e) => setHistory({ ...history, familyHistory: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white font-semibold text-slate-900"
                />
              </div>
            </div>
          )}

          {/* STEP 4: Review & Initial Coverage Assessment */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-base font-extrabold text-slate-900">Step 4: Clinical Review & Medical History Coverage</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Review baseline context and coverage confidence prior to accessing longitudinal records.
                </p>
              </div>

              {/* Cautious review notice */}
              <div
                id="onboarding-review-cautious-notice"
                className="p-4 bg-amber-50 rounded-2xl border border-amber-300 flex items-start gap-3"
              >
                <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs text-amber-950">
                  <p className="font-extrabold">Important Notice Regarding Initial Medical Context</p>
                  <p className="leading-relaxed">
                    This profile is based on the information currently provided. It may not represent the patient&apos;s
                    complete lifetime medical history. You can add more records later.
                  </p>
                </div>
              </div>

              {/* Initial Medical History Coverage Table */}
              <div>
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-2">
                  Initial Medical History Coverage Assessment
                </h4>
                <div className="overflow-hidden border border-slate-200 rounded-2xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">Coverage Domain</th>
                        <th className="py-3 px-4">Coverage Status</th>
                        <th className="py-3 px-4">Confidence Level</th>
                        <th className="py-3 px-4">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      <tr>
                        <td className="py-3 px-4 font-bold text-slate-900">Basic Information</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 font-bold px-2.5 py-0.5 rounded-full border ${basicInfo.name && basicInfo.phone ? "text-emerald-800 bg-emerald-50 border-emerald-200" : "text-amber-800 bg-amber-50 border-amber-200"}`}>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {basicInfo.name && basicInfo.phone ? "Complete" : "Partial"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-700 font-semibold">{basicInfo.name ? "Self-Verified" : "Pending"}</td>
                        <td className="py-3 px-4 text-slate-500">
                          {basicInfo.name || "Patient"}, {basicInfo.city || "City unspecified"}, {basicInfo.phone || "No phone"}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-bold text-slate-900">Known Conditions</td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 text-teal-800 font-bold bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
                            {(conditions.hasDiabetes || conditions.hasHypertension || customConditions.length > 0) ? "Logged" : "None Logged"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-700 font-semibold">Primary Chronic</td>
                        <td className="py-3 px-4 text-slate-500">
                          {[
                            conditions.hasDiabetes ? `Diabetes (${conditions.diabetesYear || 'Logged'})` : null,
                            conditions.hasHypertension ? `Hypertension (${conditions.hypertensionYear || 'Logged'})` : null,
                            ...customConditions.map((c) => c.name),
                          ].filter(Boolean).join(", ") || "No continuous conditions logged."}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-bold text-slate-900">Past History & Allergies</td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 text-amber-800 font-bold bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                            {(history.allergies || history.surgeries) ? "Recorded" : "Self-Reported"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-700 font-semibold">Self-Reported</td>
                        <td className="py-3 px-4 text-slate-500">
                          Allergies: {history.allergies || "None logged"} • Surgeries: {history.surgeries || "None logged"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Stepper Navigation Buttons */}
          <div className="pt-6 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 mt-6">
            {step > 1 ? (
              <button
                type="button"
                onClick={handleBack}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Previous Step</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              {step === 2 && (
                <button
                  type="button"
                  onClick={() => {
                    showToast("Skipped Step 2 (No active conditions recorded)");
                    handleNext();
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center gap-1 border border-slate-200"
                >
                  <span>Skip (No continuous medication)</span>
                  <SkipForward className="w-3.5 h-3.5 text-slate-400" />
                </button>
              )}

              {step === 3 && (
                <button
                  type="button"
                  onClick={() => {
                    showToast("Skipped Step 3 (No past history recorded)");
                    handleNext();
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center gap-1 border border-slate-200"
                >
                  <span>Skip (No major past history)</span>
                  <SkipForward className="w-3.5 h-3.5 text-slate-400" />
                </button>
              )}

              {step < 4 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="px-5 py-2.5 bg-[#008080] hover:bg-[#006666] text-white text-xs font-extrabold rounded-xl flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  id="btn-confirm-initial-context"
                  type="button"
                  disabled={saving}
                  onClick={handleFinish}
                  className="px-6 py-2.5 bg-[#008080] hover:bg-[#006666] text-white text-xs font-extrabold rounded-xl flex items-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Saving Profile...
                    </>
                  ) : (
                    <>
                      <span>Confirm Initial Health Context</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
