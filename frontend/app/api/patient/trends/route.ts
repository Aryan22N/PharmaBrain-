import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken, generate9DigitPatientId } from "@/lib/auth";
import { query } from "@/lib/db";
import {
  calculatePatientTrends,
  PatientLongitudinalTrends,
  PatientEligibilityInfo,
  EligiblePrescriptionItem,
} from "@/lib/trends";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const ALGORITHM_VERSION = "v1.2";
const PROMPT_VERSION = "v1.1";

interface CachedSummaryEntry {
  hash: string;
  summary: any;
  cachedAt: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __patientTrendsMemoryCache: Map<string, CachedSummaryEntry> | undefined;
}

const memoryCache: Map<string, CachedSummaryEntry> =
  global.__patientTrendsMemoryCache || new Map<string, CachedSummaryEntry>();

if (process.env.NODE_ENV !== "production") {
  global.__patientTrendsMemoryCache = memoryCache;
}

export interface GeminiTrendsResponse {
  narrative: string;
  keyHighlights: string[];
  questionsForDoctor: string[];
  safetyDisclaimer: string;
}

/**
 * Validates the structured JSON response from Gemini
 */
export function validateGeminiResponse(obj: any): GeminiTrendsResponse | null {
  if (!obj || typeof obj !== "object") return null;
  if (typeof obj.narrative !== "string" || obj.narrative.trim().length === 0) return null;
  if (!Array.isArray(obj.keyHighlights) || obj.keyHighlights.length === 0) return null;
  if (!Array.isArray(obj.questionsForDoctor) || obj.questionsForDoctor.length === 0) return null;
  if (typeof obj.safetyDisclaimer !== "string" || obj.safetyDisclaimer.trim().length === 0) return null;

  return {
    narrative: obj.narrative.trim(),
    keyHighlights: obj.keyHighlights.map((s: any) => String(s).trim()).filter(Boolean),
    questionsForDoctor: obj.questionsForDoctor.map((s: any) => String(s).trim()).filter(Boolean),
    safetyDisclaimer: obj.safetyDisclaimer.trim(),
  };
}

function isValidIsoDate(str: any): boolean {
  if (typeof str !== "string") return false;
  const trimmed = str.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return false;
  const d = new Date(trimmed);
  return !isNaN(d.getTime());
}

function extractClinicalDate(doc: any): string | null {
  const sr = doc.structuredResult || {};
  if (isValidIsoDate(sr.date_iso)) return sr.date_iso.trim().slice(0, 10);
  if (isValidIsoDate(sr.rx_date)) return sr.rx_date.trim().slice(0, 10);
  if (isValidIsoDate(sr.date)) return sr.date.trim().slice(0, 10);

  // Try parsing from originalName if contains YYYY-MM-DD
  if (typeof doc.originalName === "string") {
    const match = doc.originalName.match(/\b(\d{4}-\d{2}-\d{2})\b/);
    if (match && isValidIsoDate(match[1])) return match[1];
  }

  // Try parsing from date_raw if valid ISO
  if (typeof sr.date_raw === "string") {
    const match = sr.date_raw.match(/\b(\d{4}-\d{2}-\d{2})\b/);
    if (match && isValidIsoDate(match[1])) return match[1];
  }

  // Strictly DO NOT use uploadedAt! Upload timestamp is not the clinical encounter date.
  return null;
}

function normalizeStr(str: any): string {
  if (!str) return "";
  return String(str).trim().toLowerCase();
}

/**
 * Computes a deterministic SHA-256 fingerprint representing the exact normalized clinical state.
 * Incorporates patientCode, algorithm/prompt versions, distinct dates, prescriptions, and observations.
 */
function computeCacheFingerprint(
  patientCode: string,
  distinctDates: string[],
  prescriptions: EligiblePrescriptionItem[],
  observations: any[]
): string {
  const rxSig = prescriptions
    .map((p) => `${p.id}:${p.date}:${normalizeStr(p.doctor)}:${normalizeStr(p.hospital)}`)
    .sort()
    .join("|");

  const obsSig = observations
    .map(
      (o) =>
        `${(o.obs_date || o.date || "").slice(0, 10)}:${o.kind}:${o.systolic ?? ""}:${
          o.diastolic ?? ""
        }:${o.value ?? ""}:${o.unit ?? ""}`
    )
    .sort()
    .join("|");

  const datesSig = distinctDates.join(",");

  return crypto
    .createHash("sha256")
    .update(
      `${patientCode}::algo=${ALGORITHM_VERSION}::prompt=${PROMPT_VERSION}::dates=[${datesSig}]::rx=[${rxSig}]::obs=[${obsSig}]`
    )
    .digest("hex");
}

/**
 * Verifies confirmed, non-duplicate prescriptions across distinct clinical dates.
 * Unifies database mirrors between Document and confirmed_prescriptions.
 */
async function verifyPrescriptionEligibility(user: any, patientIds: string[]) {
  // 1. Fetch user documents from Document table
  const documents = await query(
    `SELECT d.id, d."originalName", d."storedFilename", d."documentType", d.status, d."uploadedAt", d."filePath",
            a.summary, a."structuredResult"
     FROM "Document" d
     LEFT JOIN "Analysis" a ON d.id = a."documentId"
     WHERE (d."userId" = $1 OR d."patientId" = $2)
     ORDER BY d.id ASC;`,
    [user.id, user.patientId]
  );

  // 2. Fetch confirmed prescriptions from confirmed_prescriptions table
  let confirmedPrescriptionsRows: any[] = [];
  try {
    confirmedPrescriptionsRows = await query(
      `SELECT cp.id, cp.extraction_id, cp.patient_id, cp.rx_date, cp.hospital, cp.doctor, cp.doctor_reg_no, cp.data_json, cp.confirmed_at
       FROM confirmed_prescriptions cp
       WHERE cp.patient_id = ANY($1::text[])
       ORDER BY cp.id ASC;`,
      [patientIds]
    );
  } catch (err) {
    console.warn("[Trends] Error querying confirmed_prescriptions:", err);
  }

  // Build mapping from extraction_id to Document row
  const extractionToDocMap = new Map<number, any>();
  documents.forEach((d) => {
    let extId: number | null = null;
    if (d.filePath) {
      const m = d.filePath.match(/\/extractions\/(\d+)/);
      if (m) extId = parseInt(m[1], 10);
    }
    if (!extId && d.structuredResult?.reference_id) {
      const m = String(d.structuredResult.reference_id).match(/(\d+)/);
      if (m) extId = parseInt(m[1], 10);
    }
    if (extId) extractionToDocMap.set(extId, d);
  });

  // Deduplicate prescriptions and eliminate database mirrors
  const prescriptMap = new Map<string, EligiblePrescriptionItem>();

  // A. Process confirmed_prescriptions rows (authoritative clinician records)
  for (const cp of confirmedPrescriptionsRows) {
    const rxDate = (cp.rx_date || "").toString().slice(0, 10);
    if (!isValidIsoDate(rxDate)) continue; // Exclude invalid dates

    let dataJson: any = {};
    if (cp.data_json) {
      dataJson = typeof cp.data_json === "string" ? JSON.parse(cp.data_json) : cp.data_json;
    }

    const linkedDoc = cp.extraction_id ? extractionToDocMap.get(cp.extraction_id) : null;
    const docName = linkedDoc?.originalName || `${cp.hospital || "Prescription"} - ${rxDate}`;
    const hosp = cp.hospital || dataJson.hospital || linkedDoc?.structuredResult?.hospital || null;
    const doc = cp.doctor || (typeof dataJson.doctor === "string" ? dataJson.doctor : dataJson.doctor?.name) || null;
    const imgUrl = linkedDoc?.storedFilename || dataJson.image_url || null;

    // Composite deduplication key: extraction_id takes precedence, fallback to normalized date + hospital + doctor
    const dedupKey = cp.extraction_id
      ? `ext_${cp.extraction_id}`
      : `date_${rxDate}_${normalizeStr(hosp)}_${normalizeStr(doc)}`;

    if (!prescriptMap.has(dedupKey)) {
      prescriptMap.set(dedupKey, {
        id: cp.id,
        documentId: linkedDoc?.id || null,
        extractionId: cp.extraction_id || null,
        date: rxDate,
        hospital: hosp,
        doctor: doc,
        documentName: docName,
        filePath: linkedDoc?.filePath || (cp.extraction_id ? `/extractions/${cp.extraction_id}` : null),
        imageUrl: imgUrl,
      });
    }
  }

  // B. Process confirmed Document records (status === 'CONFIRMED')
  for (const d of documents) {
    if (d.status !== "CONFIRMED") continue; // Exclude unconfirmed, discarded, not confirmed
    const rxDate = extractClinicalDate(d);
    if (!rxDate || !isValidIsoDate(rxDate)) continue; // Exclude invalid dates

    const sr = d.structuredResult || {};
    let extId: number | null = null;
    if (d.filePath) {
      const m = d.filePath.match(/\/extractions\/(\d+)/);
      if (m) extId = parseInt(m[1], 10);
    }
    if (!extId && sr.reference_id) {
      const m = String(sr.reference_id).match(/(\d+)/);
      if (m) extId = parseInt(m[1], 10);
    }

    const hosp = sr.hospital || null;
    const doc = typeof sr.doctor === "string" ? sr.doctor : sr.doctor?.name || null;
    const dedupKey = extId
      ? `ext_${extId}`
      : `date_${rxDate}_${normalizeStr(hosp)}_${normalizeStr(doc)}`;

    if (!prescriptMap.has(dedupKey)) {
      prescriptMap.set(dedupKey, {
        id: d.id,
        documentId: d.id,
        extractionId: extId,
        date: rxDate,
        hospital: hosp,
        doctor: doc,
        documentName: d.originalName || `${hosp || "Prescription"} - ${rxDate}`,
        filePath: d.filePath || (extId ? `/extractions/${extId}` : null),
        imageUrl: sr.image_url || d.storedFilename || null,
      });
    } else {
      // Mirror already matched from confirmed_prescriptions; enrich metadata
      const existing = prescriptMap.get(dedupKey)!;
      if (!existing.documentId) existing.documentId = d.id;
      if (!existing.documentName) existing.documentName = d.originalName;
      if (!existing.imageUrl) existing.imageUrl = sr.image_url || d.storedFilename;
    }
  }

  const eligiblePrescriptions = Array.from(prescriptMap.values()).sort((a, b) => {
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  // Extract distinct clinical dates
  // Rule: Multiple prescriptions on the same date count as ONE longitudinal time point
  const distinctDates = Array.from(new Set(eligiblePrescriptions.map((p) => p.date))).sort();
  const distinctDatesCount = distinctDates.length;
  const isEligible = distinctDatesCount >= 5;
  const progressPercentage = Math.min(100, Math.round((distinctDatesCount / 5) * 100));

  const message = isEligible
    ? `Longitudinal clinical threshold met (${distinctDatesCount} distinct clinical dates).`
    : `${distinctDatesCount} of 5 eligible clinical dates recorded. At least 5 confirmed prescriptions across distinct dates are required for full longitudinal trend analysis.`;

  const eligibility: PatientEligibilityInfo = {
    isEligible,
    distinctDatesCount,
    requiredCount: 5,
    distinctDates,
    eligiblePrescriptions,
    progressPercentage,
    message,
  };

  return {
    eligibility,
    documents,
  };
}

/**
 * Generate empathetic, plain-language patient summary and doctor questions using Google Gemini
 */
async function generateGeminiPatientSummary(
  trends: PatientLongitudinalTrends,
  userName: string
): Promise<{ summary: GeminiTrendsResponse | null; error?: { code: string; message: string } }> {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    const fallback = generateDeterministicFallbackSummary(trends, userName);
    return { summary: fallback };
  }

  const prompt = `You are an empathetic, clinical-intelligence communication specialist.
Generate a patient-facing longitudinal health review based STRICTLY on the deterministic clinical guidelines metrics below.

PATIENT NAME: ${userName}
CLINICAL FINDINGS:
- Overall Risk Tier: ${trends.clinicalSummary.overallRiskTier}
- Blood Pressure: ${trends.clinicalSummary.hypertensionStatus} (Baseline: ${
    trends.metrics.bp.baseline
      ? `${trends.metrics.bp.baseline.systolic}/${trends.metrics.bp.baseline.diastolic} mmHg`
      : "N/A"
  }, Latest: ${
    trends.metrics.bp.latest
      ? `${trends.metrics.bp.latest.systolic}/${trends.metrics.bp.latest.diastolic} mmHg`
      : "N/A"
  }, Overall Change: ${
    trends.metrics.bp.totalDeltaSystolic != null
      ? `${trends.metrics.bp.totalDeltaSystolic > 0 ? "+" : ""}${trends.metrics.bp.totalDeltaSystolic} mmHg`
      : "N/A"
  })
- Blood Sugar: Latest Fasting/Random ${
    trends.metrics.glucose.latest
      ? `${trends.metrics.glucose.latest.value} ${trends.metrics.glucose.latest.unit}`
      : "N/A"
  } (Trend: ${trends.metrics.glucose.overallTrend})
- HbA1c Glycemic Marker: Latest ${
    trends.metrics.hba1c.latest
      ? `${trends.metrics.hba1c.latest.value}% (${trends.metrics.hba1c.latest.stage})`
      : "N/A"
  }
- Resting Heart Rate: ${trends.metrics.pulse.latest ? `${trends.metrics.pulse.latest.value} bpm` : "N/A"}
- Oxygen Saturation (SpO2): ${trends.metrics.spo2.latest ? `${trends.metrics.spo2.latest.value}%` : "N/A"}
- Body Weight Trend: ${
    trends.metrics.weight.latest
      ? `${trends.metrics.weight.latest.value} kg (Change: ${
          trends.metrics.weight.overallDelta != null
            ? `${trends.metrics.weight.overallDelta > 0 ? "+" : ""}${trends.metrics.weight.overallDelta} kg`
            : "N/A"
        })`
      : "N/A"
  }
- Sustained Rise Flag: ${trends.metrics.bp.sustainedRiseWarning ? "YES (Warning: Sustained BP Rise Detected)" : "None"}
- Active Clinical Alerts: ${trends.allAlerts.length > 0 ? trends.allAlerts.join("; ") : "None"}

RULES FOR GENERATION:
1. Empathy & Clarity: Write in simple, reassuring, plain English suitable for patients without medical degrees.
2. Non-diagnostic phrasing: All statements are observational and informational drafts. Never declare a formal diagnosis or prescribe changes in medication dosage.
3. Positivity & Milestones: Explicitly celebrate positive trajectories (e.g. lowering BP, stable SpO2, weight loss).
4. Actionable Doctor Questions: Provide 3 specific, high-yield questions the patient can ask their doctor during their next appointment.
5. Return ONLY a valid JSON object matching this schema:
{
  "narrative": "A warm, cohesive 2-paragraph overview explaining what their multi-visit numbers show.",
  "keyHighlights": [
    "Short bullet 1 (e.g. Blood pressure decreased by 22 mmHg since April)",
    "Short bullet 2 (e.g. HbA1c improved from 7.8% towards 6.9%)",
    "Short bullet 3"
  ],
  "questionsForDoctor": [
    "Question 1 for doctor",
    "Question 2 for doctor",
    "Question 3 for doctor"
  ],
  "safetyDisclaimer": "Informational health analysis only. All clinical treatment decisions, drug dosages, and diagnosis must be confirmed directly with your licensed physician."
}`;

  const candidateModels = ["gemini-flash-latest", "gemini-2.5-flash-lite", "gemini-pro-latest"];
  let lastError: { code: string; message: string } | null = null;

  for (const modelName of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2,
          },
        }),
        signal: AbortSignal.timeout(20000),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        console.warn(`Gemini (${modelName}) API error:`, res.status, errText);
        if (res.status === 429) {
          return {
            summary: null,
            error: {
              code: "QUOTA_EXCEEDED",
              message: "Gemini API quota exhausted (HTTP 429). Deterministic clinical metrics remain active.",
            },
          };
        }
        lastError = {
          code: "GEMINI_ERROR",
          message: `Gemini service returned HTTP ${res.status}.`,
        };
        continue;
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        try {
          const parsed = JSON.parse(text);
          const validated = validateGeminiResponse(parsed);
          if (validated) {
            return { summary: validated };
          }
        } catch (parseErr) {
          console.warn("Error parsing Gemini JSON:", parseErr);
        }
      }
    } catch (err: any) {
      console.warn(`Failed calling Gemini (${modelName}):`, err);
      const isTimeout = err?.name === "TimeoutError" || String(err).includes("timeout");
      lastError = {
        code: isTimeout ? "TIMEOUT" : "NETWORK_ERROR",
        message: isTimeout
          ? "Gemini request timed out (20s limit). Please retry."
          : "Network error connecting to Gemini API.",
      };
      continue;
    }
  }

  return {
    summary: null,
    error: lastError || {
      code: "INVALID_RESPONSE",
      message: "Gemini response did not match expected clinical format.",
    },
  };
}

function generateDeterministicFallbackSummary(
  trends: PatientLongitudinalTrends,
  userName: string
): GeminiTrendsResponse {
  const bp = trends.metrics.bp;
  const gl = trends.metrics.glucose;
  const hba1c = trends.metrics.hba1c;

  let bpComment = "Blood pressure readings are currently within clinical monitoring targets.";
  if (bp.latest) {
    if (bp.overallTrend === "improving") {
      bpComment = `Your blood pressure shows an encouraging downward trend, moving to ${bp.latest.systolic}/${bp.latest.diastolic} mmHg (${bp.latest.stage}).`;
    } else if (bp.sustainedRiseWarning) {
      bpComment = `Your blood pressure has shown an upward shift over recent visits, currently recorded at ${bp.latest.systolic}/${bp.latest.diastolic} mmHg (${bp.latest.stage}).`;
    } else {
      bpComment = `Your latest recorded blood pressure is ${bp.latest.systolic}/${bp.latest.diastolic} mmHg (${bp.latest.stage}).`;
    }
  }

  let glycemicComment = "Glycemic parameters are stable across recent clinical visits.";
  if (hba1c.latest) {
    glycemicComment = `Your latest HbA1c is ${hba1c.latest.value}%, classified in the ${hba1c.latest.stage} range.`;
  } else if (gl.latest) {
    glycemicComment = `Your latest blood sugar is ${gl.latest.value} ${gl.latest.unit} (${gl.latest.stage}).`;
  }

  const narrative = `Hello ${userName || "Patient"}, reviewing your health trajectory across ${
    trends.totalEncounters
  } recorded visits indicates an overall ${trends.clinicalSummary.overallRiskTier.toLowerCase()} profile. ${bpComment} ${glycemicComment} Consistent monitoring between encounters gives your medical team actionable insight into how your wellness and therapeutic plans are working.`;

  const keyHighlights: string[] = [];
  if (bp.latest) {
    keyHighlights.push(`Latest BP: ${bp.latest.systolic}/${bp.latest.diastolic} mmHg (${bp.latest.stage})`);
  }
  if (bp.totalDeltaSystolic != null && bp.totalDeltaSystolic !== 0) {
    keyHighlights.push(
      `Systolic trajectory change: ${bp.totalDeltaSystolic > 0 ? "+" : ""}${bp.totalDeltaSystolic} mmHg from initial baseline`
    );
  }
  if (hba1c.latest) {
    keyHighlights.push(`HbA1c glycemic control: ${hba1c.latest.value}% (${hba1c.latest.stage})`);
  }
  if (trends.metrics.pulse.latest) {
    keyHighlights.push(`Resting heart rate stable at ${trends.metrics.pulse.latest.value} bpm`);
  }

  return {
    narrative,
    keyHighlights: keyHighlights.slice(0, 4),
    questionsForDoctor: [
      `How do my blood pressure readings (${
        bp.latest ? `${bp.latest.systolic}/${bp.latest.diastolic} mmHg` : "recent values"
      }) align with our long-term cardiovascular goals?`,
      `Are there any adjustments needed for my daily nutrition, physical activity, or current medications?`,
      `What target ranges should we establish for my next follow-up examination?`,
    ],
    safetyDisclaimer:
      "Informational health analysis only. All clinical treatment decisions, drug dosages, and diagnosis must be confirmed directly with your licensed physician.",
  };
}

export async function GET(req: NextRequest) {
  try {
    const forceRefresh =
      req.nextUrl.searchParams.get("force") === "true" ||
      req.nextUrl.searchParams.get("refresh") === "true";
    const generateAi = req.nextUrl.searchParams.get("generate") === "true";

    // 1. Authenticate patient request
    const cookieStore = await cookies();
    let token = cookieStore.get("auth_token")?.value;

    if (!token) {
      const authHeader = req.headers.get("authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Invalid or expired token." }, { status: 401 });
    }

    // 2. Fetch User Profile
    const users = await query(
      `SELECT id, name, email, "patientId", "legacyPatientId" 
       FROM "User" 
       WHERE id = $1 
       LIMIT 1;`,
      [payload.userId]
    );

    if (users.length === 0) {
      return NextResponse.json({ error: "User profile not found." }, { status: 404 });
    }

    const user = users[0];
    let patientCode = user.patientId;
    if (!patientCode) {
      patientCode = generate9DigitPatientId();
      await query(`UPDATE "User" SET "patientId" = $1 WHERE id = $2;`, [patientCode, user.id]);
      user.patientId = patientCode;
    }

    const patientIds = [user.patientId, user.legacyPatientId, String(user.id)].filter(Boolean);

    // 3. Verify prescription eligibility (Backend Enforcement: >= 5 confirmed, non-duplicate clinical dates)
    const { eligibility, documents } = await verifyPrescriptionEligibility(user, patientIds);

    // 4. Query observations table from Supabase DB
    let rawObs: any[] = [];
    try {
      rawObs = await query(
        `SELECT id, patient_id, prescription_id, obs_date, kind, systolic, diastolic, value, unit, raw_text, created_at
         FROM observations
         WHERE patient_id = ANY($1::text[])
         ORDER BY obs_date ASC, id ASC;`,
        [patientIds]
      );
    } catch (e) {
      console.warn("Query observations error:", e);
    }

    // Also extract observations embedded in confirmed Documents/Analyses
    const existingObsKeys = new Set(
      rawObs.map((o) => `${(o.obs_date || "").slice(0, 10)}_${o.kind}`)
    );

    documents.forEach((doc) => {
      if (doc.status !== "CONFIRMED") return;
      const sr = doc.structuredResult || {};
      const dateStr = extractClinicalDate(doc);
      if (!dateStr) return;
      const vitals = sr.vitals || [];

      if (Array.isArray(vitals)) {
        vitals.forEach((v: any, idx: number) => {
          const kind = v.kind || (v.name?.toLowerCase().includes("bp") ? "bp" : null);
          if (!kind) return;
          const key = `${dateStr}_${kind}`;
          if (!existingObsKeys.has(key)) {
            existingObsKeys.add(key);
            const parsed = v.parsed || {};
            rawObs.push({
              id: `doc-obs-${doc.id}-${idx}`,
              patient_id: patientCode,
              prescription_id: doc.id,
              obs_date: dateStr,
              kind,
              systolic: parsed.systolic || null,
              diastolic: parsed.diastolic || null,
              value: parsed.value || null,
              unit: parsed.unit || (kind === "bp" ? "mmHg" : ""),
              raw_text: `${v.name || ""} ${v.value || ""}`.trim(),
              created_at: doc.uploadedAt,
              isFromDocument: true,
              documentId: doc.id,
            });
          }
        });
      }
    });

    // Deduplicate observations by (obs_date + kind)
    const dedupedObsMap = new Map<string, any>();
    rawObs.forEach((o) => {
      const dateStr = (o.obs_date || o.date || "").slice(0, 10);
      const key = `${dateStr}_${o.kind}`;
      if (!dedupedObsMap.has(key)) {
        dedupedObsMap.set(key, o);
      } else {
        const existing = dedupedObsMap.get(key);
        if (
          (o.systolic != null || o.value != null) &&
          existing.systolic == null &&
          existing.value == null
        ) {
          dedupedObsMap.set(key, o);
        }
      }
    });
    const uniqueObs = Array.from(dedupedObsMap.values());

    // 5. Compute deterministic statistical and guideline trajectories
    const trends = calculatePatientTrends(patientCode, uniqueObs, documents, eligibility);

    // 6. Generate deterministic cache fingerprint
    const cacheFingerprint = computeCacheFingerprint(
      patientCode,
      eligibility.distinctDates,
      eligibility.eligiblePrescriptions,
      uniqueObs
    );

    // 7. Check eligibility: if < 5 distinct dates, suppress AI summary & trajectories, DO NOT call Gemini
    if (!eligibility.isEligible) {
      return NextResponse.json({
        success: true,
        isEligible: false,
        eligibility,
        cached: false,
        isStale: false,
        cachedAt: null,
        hash: cacheFingerprint.slice(0, 12),
        user: {
          id: user.id,
          name: user.name,
          patientCode,
        },
        trends,
        aiSummary: null,
      });
    }

    // 8. Eligibility threshold MET (>= 5 distinct clinical dates)
    // Check Cache first (Memory RAM + Supabase DB)
    let cachedEntry: CachedSummaryEntry | null = null;
    const memHit = memoryCache.get(patientCode);
    if (memHit && memHit.summary) {
      cachedEntry = memHit;
    } else {
      try {
        const cacheRows = await query(
          `SELECT obs_hash, ai_summary, updated_at
           FROM patient_trends_cache
           WHERE patient_id = $1
           LIMIT 1;`,
          [patientCode]
        );
        if (cacheRows.length > 0 && cacheRows[0].ai_summary) {
          let dbSummary = cacheRows[0].ai_summary;
          if (typeof dbSummary === "string") {
            try {
              dbSummary = JSON.parse(dbSummary);
            } catch (_) {}
          }
          cachedEntry = {
            hash: cacheRows[0].obs_hash,
            summary: dbSummary,
            cachedAt: cacheRows[0].updated_at
              ? new Date(cacheRows[0].updated_at).toISOString()
              : new Date().toISOString(),
          };
          memoryCache.set(patientCode, cachedEntry);
        }
      } catch (dbErr) {
        console.warn("[Trends/Cache] DB cache lookup error:", dbErr);
      }
    }

    // Scenario A: Normal page load (no explicit generate or force refresh click)
    if (!forceRefresh && !generateAi) {
      if (cachedEntry) {
        const isMatch = cachedEntry.hash === cacheFingerprint;
        return NextResponse.json({
          success: true,
          isEligible: true,
          eligibility,
          cached: true,
          isStale: !isMatch,
          staleReason: !isMatch ? "New clinical records detected since last AI summary" : null,
          cachedAt: cachedEntry.cachedAt,
          hash: cacheFingerprint.slice(0, 12),
          user: {
            id: user.id,
            name: user.name,
            patientCode,
          },
          trends,
          aiSummary: cachedEntry.summary,
        });
      }

      // No cached summary exists yet (State 4: Eligible history with no cached AI summary)
      return NextResponse.json({
        success: true,
        isEligible: true,
        eligibility,
        cached: false,
        isStale: false,
        hasCachedSummary: false,
        cachedAt: null,
        hash: cacheFingerprint.slice(0, 12),
        user: {
          id: user.id,
          name: user.name,
          patientCode,
        },
        trends,
        aiSummary: null,
      });
    }

    // Scenario B: User explicitly clicked "Generate AI Summary" or "Refresh Analysis"
    console.log(
      `[Trends/AI] Invoking Gemini for patient ${patientCode} (force=${forceRefresh}, generate=${generateAi}, hash=${cacheFingerprint.slice(
        0,
        8
      )})...`
    );

    const { summary: freshSummary, error: aiError } = await generateGeminiPatientSummary(
      trends,
      user.name
    );

    if (freshSummary) {
      const nowIso = new Date().toISOString();
      const newEntry: CachedSummaryEntry = {
        hash: cacheFingerprint,
        summary: freshSummary,
        cachedAt: nowIso,
      };

      // Update in-memory cache
      memoryCache.set(patientCode, newEntry);

      // Persist to Supabase patient_trends_cache table
      try {
        await query(
          `INSERT INTO patient_trends_cache (patient_id, obs_hash, ai_summary, updated_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (patient_id)
           DO UPDATE SET obs_hash = EXCLUDED.obs_hash, ai_summary = EXCLUDED.ai_summary, updated_at = NOW();`,
          [patientCode, cacheFingerprint, JSON.stringify(freshSummary)]
        );
      } catch (dbSaveErr) {
        console.warn("[Trends/Cache] Could not persist trends cache to DB:", dbSaveErr);
      }

      return NextResponse.json({
        success: true,
        isEligible: true,
        eligibility,
        cached: false,
        isStale: false,
        cachedAt: nowIso,
        hash: cacheFingerprint.slice(0, 12),
        user: {
          id: user.id,
          name: user.name,
          patientCode,
        },
        trends,
        aiSummary: freshSummary,
      });
    }

    // AI Generation failed (quota exhausted, timeout, or error)
    // Return structured error without presenting stale output as current
    return NextResponse.json({
      success: true,
      isEligible: true,
      eligibility,
      cached: false,
      isStale: false,
      aiError: aiError || { code: "ERROR", message: "Failed to generate AI summary" },
      cachedAt: null,
      hash: cacheFingerprint.slice(0, 12),
      user: {
        id: user.id,
        name: user.name,
        patientCode,
      },
      trends,
      aiSummary: null,
    });
  } catch (error: any) {
    console.error("Patient Trends API Error:", error);
    return NextResponse.json(
      { error: error.message || "Server error loading patient trends" },
      { status: 500 }
    );
  }
}
