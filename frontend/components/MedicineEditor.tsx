"use client";

import React, { useState } from "react";
import { MedicineRecord, FieldValidationFlag } from "@/lib/types";
import { FieldFlagBadge, MedicineDbBadge } from "./StatusBadge";
import {
  Pill,
  Plus,
  Trash2,
  AlertTriangle,
  Info,
  CheckCircle2,
  Undo2,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface MedicineEditorProps {
  medicines: MedicineRecord[];
  onChange: (updated: MedicineRecord[]) => void;
  readOnly?: boolean;
}

export function MedicineEditor({ medicines, onChange, readOnly = false }: MedicineEditorProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const handleFieldChange = (index: number, field: keyof MedicineRecord, value: string) => {
    const next = [...medicines];
    next[index] = {
      ...next[index],
      [field]: value.trim() === "" ? null : value,
    };
    onChange(next);
  };

  const handleAddMedicine = () => {
    const newMed: MedicineRecord = {
      name: "",
      form: "Tab",
      strength: "",
      dose: "1",
      frequency: "1-0-1",
      timing: "after food",
      duration: "5 days",
      route: "oral",
      status: "CHECK",
      issues: [{ field: "name", code: "manual_entry", msg: "Manually added medication" }],
    };
    onChange([...medicines, newMed]);
    setExpandedIndex(medicines.length);
  };

  const handleRemoveMedicine = (index: number) => {
    const next = medicines.filter((_, i) => i !== index);
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Pill className="w-5 h-5 text-teal-600" />
          <h3 className="text-base font-extrabold text-slate-900">Prescribed Medications</h3>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-50 text-teal-800 border border-teal-200">
            {medicines.length} {medicines.length === 1 ? "item" : "items"}
          </span>
        </div>

        {!readOnly && (
          <button
            type="button"
            onClick={handleAddMedicine}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Medication
          </button>
        )}
      </div>

      {medicines.length === 0 ? (
        <div className="p-8 text-center rounded-2xl bg-slate-50 border border-slate-200 text-slate-500 text-xs">
          No medications recorded. Click &quot;Add Medication&quot; to add one.
        </div>
      ) : (
        <div className="space-y-3">
          {medicines.map((med, index) => {
            const isExpanded = expandedIndex === index;
            const issues = med.issues || [];
            const warnings = med.warnings || [];
            const corrected = med.corrected || [];
            const hasIssues = issues.length > 0 || warnings.length > 0 || corrected.length > 0;

            const fieldsMeta = med.fields || {};

            return (
              <div
                key={index}
                className={`rounded-2xl border transition-all ${hasIssues
                    ? "bg-amber-50/40 border-amber-200 hover:border-amber-300"
                    : "bg-white border-slate-200/90 hover:border-slate-300"
                  }`}
              >
                {/* Header row */}
                <div className="p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-[240px] flex-1">
                    <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-teal-50 text-xs font-mono font-bold text-teal-700 border border-teal-200">
                      #{index + 1}
                    </span>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {readOnly ? (
                          <span className="font-extrabold text-slate-900 text-base">
                            {med.name || "(Unnamed Medication)"}
                          </span>
                        ) : (
                          <input
                            type="text"
                            value={med.name || ""}
                            onChange={(e) => handleFieldChange(index, "name", e.target.value)}
                            placeholder="Medicine Name (e.g. Paracetamol)"
                            className="font-bold text-slate-900 text-base bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 focus:outline-none focus:border-teal-500 focus:bg-white max-w-sm"
                          />
                        )}

                        <MedicineDbBadge
                          verified={med.db?.verified}
                          score={med.db?.score}
                          generic={med.db?.generic}
                        />

                        {fieldsMeta["name"] && (
                          <FieldFlagBadge
                            flag={fieldsMeta["name"].flag}
                            conf={fieldsMeta["name"].conf}
                          />
                        )}
                      </div>

                      {med.db?.verified && (
                        <div className="text-xs text-teal-800 mt-1 flex items-center gap-2">
                          <span className="font-semibold">Generic:</span> {med.db.generic}
                          {med.db.uses && (
                            <>
                              <span className="text-slate-300">•</span>
                              <span className="text-slate-500">{med.db.uses}</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setExpandedIndex(isExpanded ? null : index)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                      title={isExpanded ? "Collapse details" : "Expand details"}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMedicine(index)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Delete medication"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Quick Dosage Strip (Form, Strength, Dose, Frequency, Timing, Duration) */}
                <div className="px-4 pb-4 pt-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 text-xs">
                  {/* Form */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-slate-500 font-semibold">Form</span>
                      {fieldsMeta["form"] && <FieldFlagBadge flag={fieldsMeta["form"].flag} conf={fieldsMeta["form"].conf} />}
                    </div>
                    {readOnly ? (
                      <div className="py-1 px-2.5 rounded-lg bg-slate-50 text-slate-800 font-medium border border-slate-100">{med.form || "—"}</div>
                    ) : (
                      <input
                        type="text"
                        value={med.form || ""}
                        onChange={(e) => handleFieldChange(index, "form", e.target.value)}
                        placeholder="Tab / Cap / Syp"
                        className="w-full py-1 px-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-teal-500 focus:bg-white font-medium"
                      />
                    )}
                  </div>

                  {/* Strength */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-slate-500 font-semibold">Strength</span>
                      {fieldsMeta["strength"] && <FieldFlagBadge flag={fieldsMeta["strength"].flag} conf={fieldsMeta["strength"].conf} />}
                    </div>
                    {readOnly ? (
                      <div className="py-1 px-2.5 rounded-lg bg-slate-50 text-slate-800 font-medium border border-slate-100">{med.strength || "—"}</div>
                    ) : (
                      <input
                        type="text"
                        value={med.strength || ""}
                        onChange={(e) => handleFieldChange(index, "strength", e.target.value)}
                        placeholder="500 mg"
                        className={`w-full py-1 px-2.5 rounded-lg bg-slate-50 border text-slate-900 focus:outline-none focus:bg-white font-medium ${fieldsMeta["strength"]?.flag === "missing" || fieldsMeta["strength"]?.flag === "low"
                            ? "border-amber-300 focus:border-amber-500"
                            : "border-slate-200 focus:border-teal-500"
                          }`}
                      />
                    )}
                  </div>

                  {/* Dose */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-slate-500 font-semibold">Dose</span>
                      {fieldsMeta["dose"] && <FieldFlagBadge flag={fieldsMeta["dose"].flag} conf={fieldsMeta["dose"].conf} />}
                    </div>
                    {readOnly ? (
                      <div className="py-1 px-2.5 rounded-lg bg-slate-50 text-slate-800 font-medium border border-slate-100">{med.dose || "—"}</div>
                    ) : (
                      <input
                        type="text"
                        value={med.dose || ""}
                        onChange={(e) => handleFieldChange(index, "dose", e.target.value)}
                        placeholder="1 tab"
                        className="w-full py-1 px-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-teal-500 focus:bg-white font-medium"
                      />
                    )}
                  </div>

                  {/* Frequency */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-slate-500 font-semibold">Frequency</span>
                      {fieldsMeta["frequency"] && <FieldFlagBadge flag={fieldsMeta["frequency"].flag} conf={fieldsMeta["frequency"].conf} />}
                    </div>
                    {readOnly ? (
                      <div className="py-1 px-2.5 rounded-lg bg-[#e6f4f1] text-[#006666] font-bold border border-[#b2e0d8]">{med.frequency || "—"}</div>
                    ) : (
                      <input
                        type="text"
                        value={med.frequency || ""}
                        onChange={(e) => handleFieldChange(index, "frequency", e.target.value)}
                        placeholder="1-0-1 / TDS"
                        className="w-full py-1 px-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-teal-500 focus:bg-white font-medium"
                      />
                    )}
                  </div>

                  {/* Timing */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-slate-500 font-semibold">Timing</span>
                      {fieldsMeta["timing"] && <FieldFlagBadge flag={fieldsMeta["timing"].flag} conf={fieldsMeta["timing"].conf} />}
                    </div>
                    {readOnly ? (
                      <div className="py-1 px-2.5 rounded-lg bg-slate-50 text-slate-800 font-medium border border-slate-100">{med.timing || "—"}</div>
                    ) : (
                      <input
                        type="text"
                        value={med.timing || ""}
                        onChange={(e) => handleFieldChange(index, "timing", e.target.value)}
                        placeholder="after food"
                        className="w-full py-1 px-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-teal-500 focus:bg-white font-medium"
                      />
                    )}
                  </div>

                  {/* Duration */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-slate-500 font-semibold">Duration</span>
                      {fieldsMeta["duration"] && <FieldFlagBadge flag={fieldsMeta["duration"].flag} conf={fieldsMeta["duration"].conf} />}
                    </div>
                    {readOnly ? (
                      <div className="py-1 px-2.5 rounded-lg bg-slate-50 text-slate-800 font-medium border border-slate-100">{med.duration || "—"}</div>
                    ) : (
                      <input
                        type="text"
                        value={med.duration || ""}
                        onChange={(e) => handleFieldChange(index, "duration", e.target.value)}
                        placeholder="5 days"
                        className="w-full py-1 px-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-teal-500 focus:bg-white font-medium"
                      />
                    )}
                  </div>
                </div>

                {/* Expanded Details: Issues, OCR Corrections, Ambiguity Notes */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-2 border-t border-slate-100 space-y-2 text-xs">
                    {issues.length > 0 && (
                      <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
                        <div className="font-bold flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                          Validation Flags ({issues.length})
                        </div>
                        <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-800">
                          {issues.map((iss, i) => (
                            <li key={i}>
                              <span className="font-mono font-bold">{iss.field}:</span> {iss.msg}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {corrected.length > 0 && (
                      <div className="p-2.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-900 space-y-1">
                        <div className="font-bold flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                          Automated OCR Character Normalizations
                        </div>
                        <p className="text-[11px] text-teal-800">
                          {corrected.join(" • ")}
                        </p>
                      </div>
                    )}

                    {med.ambiguity_note && (
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700">
                        <span className="text-slate-900 font-bold">Ambiguity Note:</span> {med.ambiguity_note}
                      </div>
                    )}

                    {med.db?.composition && (
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700">
                        <span className="text-slate-900 font-bold">Composition:</span> {med.db.composition}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


