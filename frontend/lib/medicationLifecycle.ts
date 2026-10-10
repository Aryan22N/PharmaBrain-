/**
 * Generalized Prescription-Based Medication Lifecycle Management Engine
 * Pure mathematical, deterministic, and evidence-based rules without condition-specific branching.
 */

export type MedicationLifecycleStatus =
  | "ACTIVE"
  | "COMPLETED"
  | "DISCONTINUED"
  | "ON_HOLD"
  | "NEEDS_REVIEW";

export type ReconciliationCategory =
  | "NEW_COURSE"
  | "POTENTIAL_DUPLICATE"
  | "POSSIBLE_CONTINUATION"
  | "CHANGE_IN_STRENGTH_OR_INSTRUCTIONS"
  | "CONFLICTING_INSTRUCTIONS"
  | "OVERLAPPING_TREATMENT"
  | "INSUFFICIENT_INFORMATION";

export interface PrescriptionEntity {
  id: number | string;
  extractionId?: number | null;
  patientId: string;
  prescriptionDate: string; // YYYY-MM-DD
  uploadedAt: string;
  doctor?: string | null;
  hospital?: string | null;
  verificationStatus: string;
  source: string;
}

export interface MedicationRecordInput {
  name: string;
  strength?: string | null;
  frequency?: string | null;
  route?: string | null;
  dosageInstructions?: string | null;
  durationRaw?: string | null;
  indication?: string | null;
  prescriptionDate?: string | null;
  uploadedAt?: string | null;
  startDate?: string | null;
  doctor?: string | null;
  hospital?: string | null;
  referenceId?: string | null;
  prescriptionId?: number | null;
  documentId?: number | null;
  source?: string | null;
  reliability?: string | null;
  verificationStatus?: string | null;
}

export interface MedicationCourse {
  id: number | string;
  patientId: string;
  userId?: number | null;
  prescriptionId?: number | null;
  documentId?: number | null;
  name: string;
  normalizedName: string;
  strength: string;
  status: MedicationLifecycleStatus;
  indication: string | null;
  frequency: string;
  route: string;
  prescriptionDate: string | null;
  uploadedAt: string | null;
  startDate: string | null;
  durationRaw: string | null;
  durationDays: number | null;
  expectedEndDate: string | null;
  actualEndDate: string | null;
  discontinuedReason: string | null;
  statusReason?: string | null;
  doctor: string;
  hospital?: string | null;
  referenceId: string;
  reconciliationCategory: ReconciliationCategory;
  reconciliationNotes: string | null;
  isConflicting: boolean;
  conflictDetails: string | null;
  source: string;
  reliability: string;
  verificationStatus: string;
  isExpectedEndDatePassed: boolean;
  imageUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Normalizes medication name by stripping dosage forms, salts, and non-drug tokens.
 * Generic across all drug classes.
 */
export function normalizeMedicineName(name: string): string {
  if (!name) return "";
  let clean = name.toLowerCase().trim();

  // Strip dosage form prefixes & suffixes
  clean = clean.replace(
    /\b(tab|tablet|tablets|cap|capsule|capsules|syp|syrup|inj|injection|oint|ointment|cream|gel|lotion|drops|drop|susp|suspension|inhaler|rotacap|respule|solution|powder)\b/gi,
    " "
  );

  // Strip dosage numbers embedded in name (e.g. 500mg, 10 mg, 60k, 0.1%, 50mcg, 20 iu)
  clean = clean.replace(
    /\b\d+(\.\d+)?\s*(mg|mcg|g|gm|ml|iu|k|%|units|amp|vial|cc)\b/gi,
    " "
  );

  // Strip special symbols and collapse whitespace
  clean = clean.replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();

  return clean;
}

/**
 * Parses prescribed duration from free text into exact number of calendar days.
 * Returns null if duration is not explicitly specified.
 */
export function parsePrescribedDuration(raw?: string | null): number | null {
  if (!raw) return null;
  const s = raw.toLowerCase().trim();

  // Immediate or STAT
  if (s.includes("stat") || s.includes("immediate") || s.includes("single dose") || s.includes("once")) {
    return 1;
  }

  // Look for days: e.g. "3 days", "for 5 days", "3d", "5-7 days" (use upper bound 7)
  const daysMatch = s.match(/(\d+)(?:\s*-\s*(\d+))?\s*(?:day|days|d\b)/i);
  if (daysMatch) {
    return daysMatch[2] ? parseInt(daysMatch[2], 10) : parseInt(daysMatch[1], 10);
  }

  // Look for weeks: e.g. "2 weeks", "8 weeks"
  const weeksMatch = s.match(/(\d+)(?:\s*-\s*(\d+))?\s*(?:week|weeks|wk|wks)\b/i);
  if (weeksMatch) {
    const w = weeksMatch[2] ? parseInt(weeksMatch[2], 10) : parseInt(weeksMatch[1], 10);
    return w * 7;
  }

  // Look for months: e.g. "1 month", "3 months"
  const monthsMatch = s.match(/(\d+)(?:\s*-\s*(\d+))?\s*(?:month|months|mo|mos)\b/i);
  if (monthsMatch) {
    const m = monthsMatch[2] ? parseInt(monthsMatch[2], 10) : parseInt(monthsMatch[1], 10);
    return m * 30;
  }

  // Direct number of days
  const directNum = s.match(/^(\d+)$/);
  if (directNum) {
    return parseInt(directNum[1], 10);
  }

  return null;
}

/**
 * Calculates expected end date given a start date and duration in days.
 * Only calculates when start date is a valid YYYY-MM-DD string and duration is a positive integer.
 */
export function calculateExpectedEndDate(
  startDate?: string | null,
  durationDays?: number | null
): string | null {
  if (!startDate || durationDays === null || durationDays === undefined || durationDays <= 0) {
    return null;
  }

  try {
    const d = new Date(startDate);
    if (isNaN(d.getTime())) return null;

    // Add duration in days
    d.setDate(d.getDate() + durationDays);
    return d.toISOString().split("T")[0];
  } catch {
    return null;
  }
}

/**
 * Checks whether an expected end date has passed relative to reference date (today).
 */
export function isExpectedEndDatePassed(
  expectedEndDate?: string | null,
  referenceDateStr?: string
): boolean {
  if (!expectedEndDate) return false;
  const todayStr = referenceDateStr || new Date().toISOString().split("T")[0];
  return expectedEndDate < todayStr;
}

/**
 * Normalizes strength for comparison (e.g. "500 mg" vs "500mg" vs "0.5g").
 */
export function normalizeStrength(strength?: string | null): string {
  if (!strength) return "";
  return strength.toLowerCase().replace(/\s+/g, "").trim();
}

/**
 * Normalizes frequency/dosage instructions for comparison (e.g. "1-0-1" vs "1 - 0 - 1" vs "Twice daily").
 */
export function normalizeFrequency(freq?: string | null): string {
  if (!freq) return "";
  return freq.toLowerCase().replace(/\s+/g, "").trim();
}

/**
 * Core Generalized Medication Reconciliation Service
 * Compares an incoming medication order against a patient's existing active and historical courses.
 */
export function reconcileMedication(
  incoming: MedicationRecordInput,
  existingCourses: MedicationCourse[],
  currentDateStr: string = new Date().toISOString().split("T")[0]
): {
  reconciliationCategory: ReconciliationCategory;
  reconciliationNotes: string;
  isConflicting: boolean;
  conflictDetails: string | null;
  assignedStatus: MedicationLifecycleStatus;
  matchingCourseId?: number | string;
} {
  const normName = normalizeMedicineName(incoming.name);
  const normStr = normalizeStrength(incoming.strength);
  const normFreq = normalizeFrequency(incoming.frequency);
  const incStartDate = incoming.startDate || incoming.prescriptionDate || null;
  const durationDays = parsePrescribedDuration(incoming.durationRaw);

  // Check 0: Insufficient Information check
  // If start date or duration is missing, it is clinically uncertain
  const hasDuration = durationDays !== null && durationDays > 0;
  const hasStartDate = Boolean(incStartDate);

  // Filter existing courses for the same normalized medication name
  const sameMedCourses = existingCourses.filter(
    (c) => c.normalizedName === normName || normalizeMedicineName(c.name) === normName
  );

  if (sameMedCourses.length === 0) {
    if (!hasStartDate || !hasDuration) {
      return {
        reconciliationCategory: "INSUFFICIENT_INFORMATION",
        reconciliationNotes: !hasDuration
          ? "Course duration not specified in prescription. Requires clinical review."
          : "Encounter start date uncertain.",
        isConflicting: false,
        conflictDetails: null,
        assignedStatus: "ACTIVE", // Active, but tagged with needs review notice
      };
    }

    return {
      reconciliationCategory: "NEW_COURSE",
      reconciliationNotes: "New medication course initiated for patient.",
      isConflicting: false,
      conflictDetails: null,
      assignedStatus: "ACTIVE",
    };
  }

  // We have existing records for this medicine.
  // Evaluate chronological and clinical relationship across encounters.

  // 1. Exact Duplicate Check (same prescription ID or exact same encounter date & doctor & dose)
  const exactDuplicate = sameMedCourses.find((c) => {
    const samePrescription =
      incoming.prescriptionId && c.prescriptionId && incoming.prescriptionId === c.prescriptionId;
    const sameDate = incStartDate && c.startDate && incStartDate === c.startDate;
    const sameDose = normStr === normalizeStrength(c.strength);
    const sameFreq = normFreq === normalizeFrequency(c.frequency);
    return samePrescription || (sameDate && sameDose && sameFreq);
  });

  if (exactDuplicate) {
    return {
      reconciliationCategory: "POTENTIAL_DUPLICATE",
      reconciliationNotes: `Matches existing record #${exactDuplicate.id} from ${exactDuplicate.startDate} (${exactDuplicate.doctor || "Same encounter"}).`,
      isConflicting: false,
      conflictDetails: null,
      assignedStatus: exactDuplicate.status,
      matchingCourseId: exactDuplicate.id,
    };
  }

  // 2. Active Courses of this medicine
  const activeExisting = sameMedCourses.filter(
    (c) => c.status === "ACTIVE" || c.status === "NEEDS_REVIEW"
  );

  for (const existing of activeExisting) {
    const existingStr = normalizeStrength(existing.strength);
    const existingFreq = normalizeFrequency(existing.frequency);
    const doseDiffers = Boolean(normStr && existingStr && normStr !== existingStr);
    const freqDiffers = Boolean(normFreq && existingFreq && normFreq !== existingFreq);

    // If dates overlap or incoming prescription is on a subsequent date
    const isNewerDate = Boolean(
      incStartDate && existing.startDate && incStartDate > existing.startDate
    );
    const isSameDate = Boolean(
      incStartDate && existing.startDate && incStartDate === existing.startDate
    );

    // A. Conflicting Instructions on Same Date (e.g. two prescriptions on same date with conflicting doses)
    if (isSameDate && (doseDiffers || freqDiffers)) {
      return {
        reconciliationCategory: "CONFLICTING_INSTRUCTIONS",
        reconciliationNotes: `Conflicting instructions on ${incStartDate}: Prescribed ${incoming.strength || "dose"} (${incoming.frequency || "freq"}) vs existing ${existing.strength || "dose"} (${existing.frequency || "freq"}).`,
        isConflicting: true,
        conflictDetails: `Conflicting instructions: ${existing.strength || "unknown"} (${existing.frequency || ""}) vs ${incoming.strength || "unknown"} (${incoming.frequency || ""})`,
        assignedStatus: "NEEDS_REVIEW",
        matchingCourseId: existing.id,
      };
    }

    // B. Change in Strength or Instructions on Subsequent Encounter
    if (isNewerDate && (doseDiffers || freqDiffers)) {
      return {
        reconciliationCategory: "CHANGE_IN_STRENGTH_OR_INSTRUCTIONS",
        reconciliationNotes: `Prescription change on ${incStartDate}: Dosage modified from ${existing.strength || "prior dose"} (${existing.frequency || "prior freq"}) to ${incoming.strength || "new dose"} (${incoming.frequency || "new freq"}). Previous course preserved for review.`,
        isConflicting: true,
        conflictDetails: `Modified regimen: Previously ${existing.strength || ""} ${existing.frequency || ""}, now prescribed ${incoming.strength || ""} ${incoming.frequency || ""}`,
        assignedStatus: "NEEDS_REVIEW",
        matchingCourseId: existing.id,
      };
    }

    // C. Overlapping Treatment from Different Clinicians during active window
    if (
      incoming.doctor &&
      existing.doctor &&
      incoming.doctor !== existing.doctor &&
      (!existing.expectedEndDate || (incStartDate ? existing.expectedEndDate >= incStartDate : true))
    ) {
      return {
        reconciliationCategory: "OVERLAPPING_TREATMENT",
        reconciliationNotes: `Concurrent active order for ${incoming.name} from Dr. ${incoming.doctor} while active course exists from Dr. ${existing.doctor}.`,
        isConflicting: true,
        conflictDetails: `Concurrent active treatment from multiple prescribers (${incoming.doctor} and ${existing.doctor})`,
        assignedStatus: "NEEDS_REVIEW",
        matchingCourseId: existing.id,
      };
    }

    // D. Possible Continuation of Existing Course (Same Clinician or Post-Course Renewal)
    if (isNewerDate && !doseDiffers && !freqDiffers) {
      return {
        reconciliationCategory: "POSSIBLE_CONTINUATION",
        reconciliationNotes: `Follow-up renewal/continuation of ${incoming.name} ${incoming.strength || ""} prescribed on ${incStartDate} following visit on ${existing.startDate}.`,
        isConflicting: false,
        conflictDetails: null,
        assignedStatus: "ACTIVE",
        matchingCourseId: existing.id,
      };
    }
  }

  // If previous courses exist but are COMPLETED or DISCONTINUED
  const historical = sameMedCourses.filter(
    (c) => c.status === "COMPLETED" || c.status === "DISCONTINUED"
  );
  if (historical.length > 0) {
    const latestHist = historical[0];
    return {
      reconciliationCategory: "NEW_COURSE",
      reconciliationNotes: `Re-initiation of medication course. Prior course completed on ${latestHist.actualEndDate || latestHist.expectedEndDate || latestHist.startDate}.`,
      isConflicting: false,
      conflictDetails: null,
      assignedStatus: "ACTIVE",
    };
  }

  // Fallback default
  return {
    reconciliationCategory: hasDuration && hasStartDate ? "NEW_COURSE" : "INSUFFICIENT_INFORMATION",
    reconciliationNotes: hasDuration
      ? "Course recorded."
      : "Prescription duration or start date not specified. Flagged for review.",
    isConflicting: false,
    conflictDetails: null,
    assignedStatus: "ACTIVE",
  };
}

/**
 * Validates whether a requested lifecycle status transition is allowable.
 */
export function validateStatusTransition(
  currentStatus: MedicationLifecycleStatus,
  targetStatus: MedicationLifecycleStatus,
  reason?: string | null
): { allowed: boolean; error?: string } {
  if (currentStatus === targetStatus) {
    return { allowed: true };
  }

  if (targetStatus === "DISCONTINUED" && (!reason || !reason.trim())) {
    return {
      allowed: false,
      error: "A clinical reason must be provided when discontinuing a medication.",
    };
  }

  const validTransitions: Record<MedicationLifecycleStatus, MedicationLifecycleStatus[]> = {
    ACTIVE: ["COMPLETED", "DISCONTINUED", "ON_HOLD", "NEEDS_REVIEW"],
    ON_HOLD: ["ACTIVE", "DISCONTINUED", "COMPLETED"],
    NEEDS_REVIEW: ["ACTIVE", "DISCONTINUED", "COMPLETED", "ON_HOLD"],
    COMPLETED: ["ACTIVE"], // Re-activation if marked by mistake
    DISCONTINUED: ["ACTIVE"], // Re-activation if discontinued by mistake
  };

  const allowedTargets = validTransitions[currentStatus] || [];
  if (!allowedTargets.includes(targetStatus)) {
    return {
      allowed: false,
      error: `Invalid transition from ${currentStatus} to ${targetStatus}.`,
    };
  }

  return { allowed: true };
}
