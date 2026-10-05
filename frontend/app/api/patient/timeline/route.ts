import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    let token: string | null = null;
    const authHeader = req.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    }
    if (!token) {
      const { cookies } = await import("next/headers");
      const cookieStore = await cookies();
      token = cookieStore.get("auth_token")?.value || null;
    }

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload?.userId) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const patientId = payload.patientId || "483027156";
    const patientIds = [patientId, "CCM12578"].filter(Boolean);

    // 1. Fetch User's Documents from patient summary
    const documents = await query(
      `SELECT d.id, d."originalName", d."storedFilename", d."documentType", d.status, d."uploadedAt", d."filePath",
              a.summary, a."structuredResult"
       FROM "Document" d
       LEFT JOIN "Analysis" a ON d.id = a."documentId"
       WHERE d."userId" = $1 OR d."patientId" = ANY($2::text[])
       ORDER BY d."uploadedAt" DESC;`,
      [payload.userId, patientIds]
    );

    const docTimelineEvents = documents.map((doc) => {
      const sr = doc.structuredResult || {};
      const docDate = sr.date_iso || (doc.uploadedAt ? new Date(doc.uploadedAt).toISOString().split('T')[0] : '2026-09-10');
      const isConfirmed = doc.status === 'CONFIRMED';
      const facility = sr.hospital || "City Care Medical Centre";
      const doctor = typeof sr.doctor === 'string' ? sr.doctor : sr.doctor?.name || "Consulting Physician";
      const refId = sr.reference_id || `HMS-DOC-${doc.id}`;

      let category = "Consultation";
      const nameLower = (doc.originalName || "").toLowerCase();
      if (sr.medicines && Array.isArray(sr.medicines) && sr.medicines.length > 0) {
        category = "Medication";
      } else if (nameLower.includes("metabolic") || nameLower.includes("electrolytes") || nameLower.includes("thyroid") || nameLower.includes("ratio") || nameLower.includes("panel") || nameLower.includes("urine")) {
        category = "Lab Result";
      } else if (nameLower.includes("x-ray") || nameLower.includes("ultrasound") || nameLower.includes("imaging") || nameLower.includes("parenchyma")) {
        category = "Diagnostic Imaging";
      } else if (nameLower.includes("fundus") || nameLower.includes("ophthalmology") || nameLower.includes("eye")) {
        category = "Clinical Examination";
      } else if (nameLower.includes("cardiovascular") || nameLower.includes("ecg") || nameLower.includes("echo") || nameLower.includes("blood pressure")) {
        category = "Cardiovascular";
      }

      return {
        id: `doc-${doc.id}`,
        patient_id: patientId,
        user_id: payload.userId,
        event_date: docDate,
        category,
        title: doc.originalName || "Clinical Encounter Record",
        description: doc.summary || "Verified medical record stored in patient electronic health summary.",
        source: isConfirmed ? "Hospital HMS" : "Diagnostic Lab",
        reliability: isConfirmed ? "High" : "Medium",
        verification_status: isConfirmed ? "Hospital Verified" : "Patient Confirmed",
        facility,
        doctor,
        reference_id: refId,
        is_conflicting: false,
        conflict_details: null,
        created_at: doc.uploadedAt,
      };
    });

    // 2. Query patient's custom/added timeline events
    let customEvents: any[] = [];
    try {
      customEvents = await query(
        `SELECT id, patient_id, user_id, event_date, category, title, description,
                source, reliability, verification_status, facility, doctor, reference_id,
                is_conflicting, conflict_details, created_at
         FROM patient_timeline_events
         WHERE patient_id = ANY($1::text[]) OR user_id = $2
         ORDER BY event_date DESC, id DESC;`,
        [patientIds, payload.userId]
      );
    } catch (e) {
      console.warn("Could not query patient_timeline_events:", e);
    }

    const seenTl = new Set<string>();
    const unifiedTimeline: any[] = [];
    [...customEvents, ...docTimelineEvents].forEach((item) => {
      const key = `${(item.title || '').trim().toLowerCase()}_${item.event_date ? item.event_date.toString().slice(0, 10) : ''}`;
      if (!seenTl.has(key)) {
        seenTl.add(key);
        unifiedTimeline.push(item);
      }
    });
    unifiedTimeline.sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime());

    return NextResponse.json({
      success: true,
      events: unifiedTimeline,
      timelineEvents: unifiedTimeline,
      total: unifiedTimeline.length,
      conflictsCount: unifiedTimeline.filter(e => e.is_conflicting).length,
    });
  } catch (error: any) {
    console.error("Timeline API Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load medical timeline" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    let token: string | null = null;
    const authHeader = req.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    }
    if (!token) {
      const { cookies } = await import("next/headers");
      const cookieStore = await cookies();
      token = cookieStore.get("auth_token")?.value || null;
    }

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload?.userId) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      event_date,
      category,
      title,
      description,
      source = "Manual Entry",
      reliability = "Low",
      verification_status = "Patient Confirmed",
      facility = "Patient Home Portal",
      doctor,
      reference_id,
      is_conflicting = false,
      conflict_details = null,
    } = body;

    if (!title || !event_date || !category) {
      return NextResponse.json(
        { error: "Date, category, and title are required" },
        { status: 400 }
      );
    }

    const patientId = payload.patientId || "483027156";
    const refId = reference_id || `PATIENT-${category.toUpperCase().replace(/\s+/g, "_")}-${Date.now().toString().slice(-6)}`;
    const docName = doctor || `${payload.name || "Patient"} (Self-Report)`;

    const inserted = await query(
      `INSERT INTO patient_timeline_events 
       (patient_id, user_id, event_date, category, title, description, source, reliability, verification_status, facility, doctor, reference_id, is_conflicting, conflict_details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *;`,
      [
        patientId,
        payload.userId,
        event_date,
        category,
        title,
        description || null,
        source,
        reliability,
        verification_status,
        facility,
        docName,
        refId,
        Boolean(is_conflicting),
        conflict_details || null,
      ]
    );

    return NextResponse.json({
      success: true,
      event: inserted[0],
      message: "Timeline event recorded successfully",
    }, { status: 201 });
  } catch (error: any) {
    console.error("Create Timeline Event Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save timeline event" },
      { status: 500 }
    );
  }
}
