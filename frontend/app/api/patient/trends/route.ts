import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken, generate9DigitPatientId } from "@/lib/auth";
import { query } from "@/lib/db";
import { calculatePatientTrends, PatientLongitudinalTrends } from "@/lib/trends";
import { pythonBackendFetch } from "@/lib/api";

export const dynamic = "force-dynamic";

// Standard clinical demo baseline if patient has zero recorded historical encounters
const DEMO_LONGITUDINAL_OBSERVATIONS = [
  // Encounter 1 (2026-04-10)
  { id: "demo-1", patient_id: "demo", obs_date: "2026-04-10", kind: "bp", systolic: 144, diastolic: 92, unit: "mmHg", raw_text: "BP 144/92 mmHg" },
  { id: "demo-2", patient_id: "demo", obs_date: "2026-04-10", kind: "sugar_fasting", value: 138, unit: "mg/dL", raw_text: "FBS 138 mg/dL" },
  { id: "demo-3", patient_id: "demo", obs_date: "2026-04-10", kind: "hba1c", value: 7.8, unit: "%", raw_text: "HbA1c 7.8%" },
  { id: "demo-4", patient_id: "demo", obs_date: "2026-04-10", kind: "pulse", value: 84, unit: "bpm", raw_text: "Pulse 84 bpm" },
  { id: "demo-5", patient_id: "demo", obs_date: "2026-04-10", kind: "spo2", value: 97, unit: "%", raw_text: "SpO2 97%" },
  { id: "demo-6", patient_id: "demo", obs_date: "2026-04-10", kind: "weight", value: 79.5, unit: "kg", raw_text: "Weight 79.5 kg" },

  // Encounter 2 (2026-06-18)
  { id: "demo-7", patient_id: "demo", obs_date: "2026-06-18", kind: "bp", systolic: 136, diastolic: 86, unit: "mmHg", raw_text: "BP 136/86 mmHg" },
  { id: "demo-8", patient_id: "demo", obs_date: "2026-06-18", kind: "sugar_fasting", value: 122, unit: "mg/dL", raw_text: "FBS 122 mg/dL" },
  { id: "demo-9", patient_id: "demo", obs_date: "2026-06-18", kind: "pulse", value: 78, unit: "bpm", raw_text: "Pulse 78 bpm" },
  { id: "demo-10", patient_id: "demo", obs_date: "2026-06-18", kind: "spo2", value: 98, unit: "%", raw_text: "SpO2 98%" },
  { id: "demo-11", patient_id: "demo", obs_date: "2026-06-18", kind: "weight", value: 78.2, unit: "kg", raw_text: "Weight 78.2 kg" },

  // Encounter 3 (2026-08-05)
  { id: "demo-12", patient_id: "demo", obs_date: "2026-08-05", kind: "bp", systolic: 128, diastolic: 82, unit: "mmHg", raw_text: "BP 128/82 mmHg" },
  { id: "demo-13", patient_id: "demo", obs_date: "2026-08-05", kind: "sugar_fasting", value: 110, unit: "mg/dL", raw_text: "FBS 110 mg/dL" },
  { id: "demo-14", patient_id: "demo", obs_date: "2026-08-05", kind: "hba1c", value: 6.9, unit: "%", raw_text: "HbA1c 6.9%" },
  { id: "demo-15", patient_id: "demo", obs_date: "2026-08-05", kind: "pulse", value: 74, unit: "bpm", raw_text: "Pulse 74 bpm" },
  { id: "demo-16", patient_id: "demo", obs_date: "2026-08-05", kind: "spo2", value: 99, unit: "%", raw_text: "SpO2 99%" },
  { id: "demo-17", patient_id: "demo", obs_date: "2026-08-05", kind: "weight", value: 76.8, unit: "kg", raw_text: "Weight 76.8 kg" },

  // Encounter 4 (2026-09-22)
  { id: "demo-18", patient_id: "demo", obs_date: "2026-09-22", kind: "bp", systolic: 122, diastolic: 78, unit: "mmHg", raw_text: "BP 122/78 mmHg" },
  { id: "demo-19", patient_id: "demo", obs_date: "2026-09-22", kind: "sugar_fasting", value: 104, unit: "mg/dL", raw_text: "FBS 104 mg/dL" },
  { id: "demo-20", patient_id: "demo", obs_date: "2026-09-22", kind: "pulse", value: 72, unit: "bpm", raw_text: "Pulse 72 bpm" },
  { id: "demo-21", patient_id: "demo", obs_date: "2026-09-22", kind: "spo2", value: 98, unit: "%", raw_text: "SpO2 98%" },
  { id: "demo-22", patient_id: "demo", obs_date: "2026-09-22", kind: "weight", value: 75.9, unit: "kg", raw_text: "Weight 75.9 kg" },
];

/**
 * Generate empathetic, plain-language patient summary and doctor questions using Google Gemini
 */
async function generateGeminiPatientSummary(trends: PatientLongitudinalTrends, userName: string) {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    return generateDeterministicFallbackSummary(trends, userName);
  }

  const prompt = `You are an empathetic, clinical-intelligence communication specialist.
Generate a patient-facing longitudinal health review based STRICTLY on the deterministic clinical guidelines metrics below.

PATIENT NAME: ${userName}
CLINICAL FINDINGS:
- Overall Risk Tier: ${trends.clinicalSummary.overallRiskTier}
- Blood Pressure: ${trends.clinicalSummary.hypertensionStatus} (Baseline: ${trends.metrics.bp.baseline ? `${trends.metrics.bp.baseline.systolic}/${trends.metrics.bp.baseline.diastolic} mmHg` : 'N/A'}, Latest: ${trends.metrics.bp.latest ? `${trends.metrics.bp.latest.systolic}/${trends.metrics.bp.latest.diastolic} mmHg` : 'N/A'}, Overall Change: ${trends.metrics.bp.totalDeltaSystolic != null ? `${trends.metrics.bp.totalDeltaSystolic > 0 ? '+' : ''}${trends.metrics.bp.totalDeltaSystolic} mmHg` : 'N/A'})
- Blood Sugar: Latest Fasting/Random ${trends.metrics.glucose.latest ? `${trends.metrics.glucose.latest.value} ${trends.metrics.glucose.latest.unit}` : 'N/A'} (Trend: ${trends.metrics.glucose.overallTrend})
- HbA1c Glycemic Marker: Latest ${trends.metrics.hba1c.latest ? `${trends.metrics.hba1c.latest.value}% (${trends.metrics.hba1c.latest.stage})` : 'N/A'}
- Resting Heart Rate: ${trends.metrics.pulse.latest ? `${trends.metrics.pulse.latest.value} bpm` : 'N/A'}
- Oxygen Saturation (SpO2): ${trends.metrics.spo2.latest ? `${trends.metrics.spo2.latest.value}%` : 'N/A'}
- Body Weight Trend: ${trends.metrics.weight.latest ? `${trends.metrics.weight.latest.value} kg (Change: ${trends.metrics.weight.overallDelta != null ? `${trends.metrics.weight.overallDelta > 0 ? '+' : ''}${trends.metrics.weight.overallDelta} kg` : 'N/A'})` : 'N/A'}
- Sustained Rise Flag: ${trends.metrics.bp.sustainedRiseWarning ? 'YES (Warning: Sustained BP Rise Detected)' : 'None'}
- Active Clinical Alerts: ${trends.allAlerts.length > 0 ? trends.allAlerts.join('; ') : 'None'}

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

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;
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
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      console.warn("Gemini API error:", res.status, await res.text().catch(() => ""));
      return generateDeterministicFallbackSummary(trends, userName);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) {
      const parsed = JSON.parse(text);
      return parsed;
    }
  } catch (err) {
    console.warn("Failed calling Gemini for trend narrative:", err);
  }

  return generateDeterministicFallbackSummary(trends, userName);
}

function generateDeterministicFallbackSummary(trends: PatientLongitudinalTrends, userName: string) {
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

  const narrative = `Hello ${userName || "Patient"}, reviewing your health trajectory across ${trends.totalEncounters} recorded visits indicates an overall ${trends.clinicalSummary.overallRiskTier.toLowerCase()} profile. ${bpComment} ${glycemicComment} Consistent monitoring between encounters gives your medical team actionable insight into how your wellness and therapeutic plans are working.`;

  const keyHighlights: string[] = [];
  if (bp.latest) {
    keyHighlights.push(`Latest BP: ${bp.latest.systolic}/${bp.latest.diastolic} mmHg (${bp.latest.stage})`);
  }
  if (bp.totalDeltaSystolic != null && bp.totalDeltaSystolic !== 0) {
    keyHighlights.push(`Systolic trajectory change: ${bp.totalDeltaSystolic > 0 ? '+' : ''}${bp.totalDeltaSystolic} mmHg from initial baseline`);
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
      `How do my blood pressure readings (${bp.latest ? `${bp.latest.systolic}/${bp.latest.diastolic} mmHg` : 'recent values'}) align with our long-term cardiovascular goals?`,
      `Are there any adjustments needed for my daily nutrition, physical activity, or current medications?`,
      `What target ranges should we establish for my next follow-up examination?`,
    ],
    safetyDisclaimer:
      "Informational health analysis only. All clinical treatment decisions, drug dosages, and diagnosis must be confirmed directly with your licensed physician.",
  };
}

export async function GET(req: NextRequest) {
  try {
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

    // 1. Fetch User Profile
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

    // 2. Fetch User Documents to cross-reference prescriptions
    const documents = await query(
      `SELECT d.id, d."originalName", d."storedFilename", d."documentType", d.status, d."uploadedAt", d."filePath",
              a.summary, a."structuredResult"
       FROM "Document" d
       LEFT JOIN "Analysis" a ON d.id = a."documentId"
       WHERE (d."userId" = $1 OR d."patientId" = $2) AND d.status != 'DISCARDED'
       ORDER BY d."uploadedAt" ASC;`,
      [user.id, patientCode]
    );

    // 3. Query observations table from Supabase DB
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

    // Also extract any observations embedded in confirmed Documents/Analyses that may not have been mirrored
    const existingObsKeys = new Set(
      rawObs.map(o => `${(o.obs_date || '').slice(0, 10)}_${o.kind}`)
    );

    documents.forEach(doc => {
      const sr = doc.structuredResult || {};
      const dateStr = sr.date_iso || (doc.uploadedAt ? new Date(doc.uploadedAt).toISOString().split('T')[0] : '2026-09-10');
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
              raw_text: `${v.name || ''} ${v.value || ''}`.trim(),
              created_at: doc.uploadedAt,
              isFromDocument: true,
              documentId: doc.id,
            });
          }
        });
      }
    });

    // Deduplicate observations by (obs_date + kind) to avoid double counting across legacy/new IDs
    const dedupedObsMap = new Map<string, any>();
    rawObs.forEach((o) => {
      const dateStr = (o.obs_date || o.date || "").slice(0, 10);
      const key = `${dateStr}_${o.kind}`;
      if (!dedupedObsMap.has(key)) {
        dedupedObsMap.set(key, o);
      } else {
        const existing = dedupedObsMap.get(key);
        if ((o.systolic != null || o.value != null) && (existing.systolic == null && existing.value == null)) {
          dedupedObsMap.set(key, o);
        }
      }
    });
    let uniqueObs = Array.from(dedupedObsMap.values());

    // If zero observations exist, provide baseline demonstration timeline for preview
    let isDemoBaseline = false;
    if (uniqueObs.length === 0) {
      isDemoBaseline = true;
      uniqueObs = DEMO_LONGITUDINAL_OBSERVATIONS.map((d) => ({ ...d, patient_id: patientCode }));
    }

    // 4. Compute statistical and clinical guideline trajectories
    const trends = calculatePatientTrends(patientCode, uniqueObs, documents);

    // 5. Generate AI Patient Narrative
    const aiSummary = await generateGeminiPatientSummary(trends, user.name);

    return NextResponse.json({
      success: true,
      isDemoBaseline,
      user: {
        id: user.id,
        name: user.name,
        patientCode,
      },
      trends,
      aiSummary,
    });
  } catch (error: any) {
    console.error("Patient Trends API Error:", error);
    return NextResponse.json(
      { error: error.message || "Server error loading patient trends" },
      { status: 500 }
    );
  }
}
