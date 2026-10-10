import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import {
  MedicationCourse,
  MedicationLifecycleStatus,
  normalizeMedicineName,
  parsePrescribedDuration,
  calculateExpectedEndDate,
  isExpectedEndDatePassed,
  reconcileMedication,
} from "@/lib/medicationLifecycle";

export const dynamic = "force-dynamic";

/**
 * Synchronizes confirmed prescriptions into patient_medications idempotently.
 * Preserves true clinical encounter dates and avoids duplicating existing records.
 */
async function syncConfirmedPrescriptionsToMedications(
  patientIds: string[],
  userId: number
): Promise<void> {
  try {
    // 1. Fetch confirmed prescriptions from confirmed_prescriptions table
    const confirmedPrescriptions = await query(
      `SELECT cp.id, cp.extraction_id, cp.patient_id, cp.rx_date, cp.hospital, cp.doctor, cp.data_json
       FROM confirmed_prescriptions cp
       WHERE cp.patient_id = ANY($1::text[])
       ORDER BY cp.id ASC;`,
      [patientIds]
    );

    // 2. Fetch confirmed documents from Document / Analysis table
    const confirmedDocs = await query(
      `SELECT d.id, d."originalName", d."storedFilename", d."patientId", d."uploadedAt",
              a.summary, a."structuredResult"
       FROM "Document" d
       LEFT JOIN "Analysis" a ON d.id = a."documentId"
       WHERE (d."userId" = $1 OR d."patientId" = ANY($2::text[]))
         AND d.status = 'CONFIRMED'
       ORDER BY d.id ASC;`,
      [userId, patientIds]
    );

    // 3. Fetch existing medications already stored in patient_medications
    const existingMedsRaw = await query(
      `SELECT * FROM patient_medications WHERE patient_id = ANY($1::text[]) OR user_id = $2;`,
      [patientIds, userId]
    );

    const existingCourses: MedicationCourse[] = existingMedsRaw.map((r: any) => ({
      id: r.id,
      patientId: r.patient_id,
      userId: r.user_id,
      prescriptionId: r.prescription_id,
      documentId: r.document_id,
      name: r.name,
      normalizedName: r.normalized_name || normalizeMedicineName(r.name),
      strength: r.strength || "",
      status: r.status as MedicationLifecycleStatus,
      indication: r.indication,
      frequency: r.frequency || "As prescribed",
      route: r.route || "Oral",
      prescriptionDate: r.prescription_date,
      uploadedAt: r.uploaded_at,
      startDate: r.start_date,
      durationRaw: r.duration_raw,
      durationDays: r.duration_days,
      expectedEndDate: r.expected_end_date,
      actualEndDate: r.actual_end_date,
      discontinuedReason: r.discontinued_reason,
      statusReason: r.status_reason || null,
      doctor: r.doctor || "Attending Physician",
      hospital: r.hospital,
      referenceId: r.reference_id,
      reconciliationCategory: r.reconciliation_category,
      reconciliationNotes: r.reconciliation_notes,
      isConflicting: Boolean(r.is_conflicting),
      conflictDetails: r.conflict_details,
      source: r.source || "Prescription Scan",
      reliability: r.reliability || "High",
      verificationStatus: r.verification_status || "Prescription Verified",
      isExpectedEndDatePassed: isExpectedEndDatePassed(r.expected_end_date),
      imageUrl: null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    // Helper set of already inserted reference signatures
    const existingKeys = new Set(
      existingCourses.map(
        (c) =>
          `${c.patientId}_${normalizeMedicineName(c.name)}_${c.startDate || ""}_${c.prescriptionId || ""}`
      )
    );

    const todayStr = new Date().toISOString().split("T")[0];

    // Process confirmed_prescriptions rows
    for (const cp of confirmedPrescriptions) {
      let data: any = {};
      try {
        data = typeof cp.data_json === "string" ? JSON.parse(cp.data_json) : cp.data_json || {};
      } catch {
        data = {};
      }

      const medicines = Array.isArray(data.medicines) ? data.medicines : [];
      const rxDate = cp.rx_date || (data.date_iso ? String(data.date_iso).slice(0, 10) : todayStr);
      const doctorName = cp.doctor || (typeof data.doctor === "string" ? data.doctor : data.doctor?.name) || "Attending Physician";
      const hospitalName = cp.hospital || data.hospital || "Medical Facility";
      const refId = `CP-RX-${cp.id}`;

      for (const med of medicines) {
        if (!med || !med.name) continue;
        const medName = String(med.name).trim();
        const normName = normalizeMedicineName(medName);
        const checkKey = `${cp.patient_id}_${normName}_${rxDate}_${cp.id}`;

        if (existingKeys.has(checkKey)) continue;

        const strength = med.strength || med.dose || "";
        const freq = med.frequency || med.instructions || "Once daily";
        const route = med.route || "Oral";
        const durationRaw = med.duration || null;
        const durationDays = parsePrescribedDuration(durationRaw);
        const expectedEndDate = calculateExpectedEndDate(rxDate, durationDays);
        const indication = data.diagnosis || med.indication || null;

        // Reconcile against current courses
        const recon = reconcileMedication(
          {
            name: medName,
            strength,
            frequency: freq,
            route,
            durationRaw,
            startDate: rxDate,
            prescriptionDate: rxDate,
            doctor: doctorName,
            hospital: hospitalName,
            prescriptionId: cp.id,
            indication,
          },
          existingCourses,
          todayStr
        );

        // If it's a potential duplicate of an already inserted record, skip re-inserting
        if (recon.reconciliationCategory === "POTENTIAL_DUPLICATE") {
          continue;
        }

        const inserted = await query(
          `INSERT INTO patient_medications (
            patient_id, user_id, prescription_id, document_id, name, normalized_name,
            strength, status, indication, frequency, route, prescription_date, uploaded_at,
            start_date, duration_raw, duration_days, expected_end_date, actual_end_date,
            discontinued_reason, doctor, reference_id, reconciliation_category, reconciliation_notes,
            is_conflicting, conflict_details, source, reliability, verification_status
          ) VALUES ($1, $2, $3, NULL, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NULL, NULL, $17, $18, $19, $20, $21, $22, 'Prescription Scan', 'High', 'Prescription Verified')
          RETURNING *;`,
          [
            cp.patient_id,
            userId,
            cp.id,
            medName,
            normName,
            strength,
            recon.assignedStatus,
            indication,
            freq,
            route,
            rxDate,
            todayStr,
            rxDate,
            durationRaw,
            durationDays,
            expectedEndDate,
            doctorName,
            refId,
            recon.reconciliationCategory,
            recon.reconciliationNotes,
            recon.isConflicting,
            recon.conflictDetails,
          ]
        );

        if (inserted.length > 0) {
          existingKeys.add(checkKey);
          existingCourses.push({
            id: inserted[0].id,
            patientId: cp.patient_id,
            userId,
            prescriptionId: cp.id,
            name: medName,
            normalizedName: normName,
            strength,
            status: recon.assignedStatus,
            indication,
            frequency: freq,
            route,
            prescriptionDate: rxDate,
            uploadedAt: todayStr,
            startDate: rxDate,
            durationRaw,
            durationDays,
            expectedEndDate,
            actualEndDate: null,
            discontinuedReason: null,
            doctor: doctorName,
            hospital: hospitalName,
            referenceId: refId,
            reconciliationCategory: recon.reconciliationCategory,
            reconciliationNotes: recon.reconciliationNotes,
            isConflicting: recon.isConflicting,
            conflictDetails: recon.conflictDetails,
            source: "Prescription Scan",
            reliability: "High",
            verificationStatus: "Prescription Verified",
            isExpectedEndDatePassed: isExpectedEndDatePassed(expectedEndDate),
          });

          // Log audit creation
          await query(
            `INSERT INTO patient_medication_audit (
              medication_id, patient_id, user_id, action, previous_status, new_status, reason, actor
            ) VALUES ($1, $2, $3, 'CREATED', NULL, $4, $5, 'Prescription Confirmation Pipeline');`,
            [inserted[0].id, cp.patient_id, userId, recon.assignedStatus, recon.reconciliationNotes]
          );
        }
      }
    }

    // Process confirmed documents (where Document.status = 'CONFIRMED')
    for (const doc of confirmedDocs) {
      const sr = doc.structuredResult || {};
      const medicines = Array.isArray(sr.medicines) ? sr.medicines : [];
      const rxDate = sr.date_iso || (doc.uploadedAt ? new Date(doc.uploadedAt).toISOString().split("T")[0] : todayStr);
      const docPatientId = doc.patientId || patientIds[0];
      const doctorName = typeof sr.doctor === "string" ? sr.doctor : sr.doctor?.name || "Attending Physician";
      const hospitalName = sr.hospital || "Medical Facility";
      const refId = sr.reference_id || `DOC-RX-${doc.id}`;

      for (const med of medicines) {
        if (!med || !med.name) continue;
        const medName = String(med.name).trim();
        const normName = normalizeMedicineName(medName);
        const checkKey = `${docPatientId}_${normName}_${rxDate}_doc_${doc.id}`;

        if (existingKeys.has(checkKey)) continue;

        const strength = med.strength || med.dose || "";
        const freq = med.frequency || med.instructions || "Once daily";
        const route = med.route || "Oral";
        const durationRaw = med.duration || null;
        const durationDays = parsePrescribedDuration(durationRaw);
        const expectedEndDate = calculateExpectedEndDate(rxDate, durationDays);
        const indication = sr.diagnosis || med.indication || null;

        const recon = reconcileMedication(
          {
            name: medName,
            strength,
            frequency: freq,
            route,
            durationRaw,
            startDate: rxDate,
            prescriptionDate: rxDate,
            doctor: doctorName,
            hospital: hospitalName,
            documentId: doc.id,
            indication,
          },
          existingCourses,
          todayStr
        );

        if (recon.reconciliationCategory === "POTENTIAL_DUPLICATE") {
          continue;
        }

        const inserted = await query(
          `INSERT INTO patient_medications (
            patient_id, user_id, prescription_id, document_id, name, normalized_name,
            strength, status, indication, frequency, route, prescription_date, uploaded_at,
            start_date, duration_raw, duration_days, expected_end_date, actual_end_date,
            discontinued_reason, doctor, reference_id, reconciliation_category, reconciliation_notes,
            is_conflicting, conflict_details, source, reliability, verification_status
          ) VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NULL, NULL, $17, $18, $19, $20, $21, $22, 'Prescription Scan', 'High', 'Prescription Verified')
          RETURNING *;`,
          [
            docPatientId,
            userId,
            doc.id,
            medName,
            normName,
            strength,
            recon.assignedStatus,
            indication,
            freq,
            route,
            rxDate,
            doc.uploadedAt ? new Date(doc.uploadedAt).toISOString().split("T")[0] : todayStr,
            rxDate,
            durationRaw,
            durationDays,
            expectedEndDate,
            doctorName,
            refId,
            recon.reconciliationCategory,
            recon.reconciliationNotes,
            recon.isConflicting,
            recon.conflictDetails,
          ]
        );

        if (inserted.length > 0) {
          existingKeys.add(checkKey);
          existingCourses.push({
            id: inserted[0].id,
            patientId: docPatientId,
            userId,
            documentId: doc.id,
            name: medName,
            normalizedName: normName,
            strength,
            status: recon.assignedStatus,
            indication,
            frequency: freq,
            route,
            prescriptionDate: rxDate,
            uploadedAt: doc.uploadedAt,
            startDate: rxDate,
            durationRaw,
            durationDays,
            expectedEndDate,
            actualEndDate: null,
            discontinuedReason: null,
            doctor: doctorName,
            hospital: hospitalName,
            referenceId: refId,
            reconciliationCategory: recon.reconciliationCategory,
            reconciliationNotes: recon.reconciliationNotes,
            isConflicting: recon.isConflicting,
            conflictDetails: recon.conflictDetails,
            source: "Prescription Scan",
            reliability: "High",
            verificationStatus: "Prescription Verified",
            isExpectedEndDatePassed: isExpectedEndDatePassed(expectedEndDate),
          });

          await query(
            `INSERT INTO patient_medication_audit (
              medication_id, patient_id, user_id, action, previous_status, new_status, reason, actor
            ) VALUES ($1, $2, $3, 'CREATED', NULL, $4, $5, 'Clinical Document Ingestion');`,
            [inserted[0].id, docPatientId, userId, recon.assignedStatus, recon.reconciliationNotes]
          );
        }
      }
    }
  } catch (err) {
    console.warn("[Medications] Warning during prescription sync:", err);
  }
}

/**
 * GET /api/patient/medicines
 * Returns reconciled medication courses organized into Current Medicines, Medical History, and Needs Review.
 */
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
    const patientIds = Array.from(
      new Set(
        [patientId, "CCM12578", "demo-patient-1", "713590440", "545590541", "443213338", "960183477"].filter(
          Boolean
        )
      )
    );

    // Sync any newly confirmed prescriptions into patient_medications
    await syncConfirmedPrescriptionsToMedications(patientIds, payload.userId);

    // Query all patient medications
    const rows = await query(
      `SELECT id, patient_id, user_id, prescription_id, document_id, name, normalized_name,
              strength, status, indication, frequency, route, prescription_date, uploaded_at,
              start_date, duration_raw, duration_days, expected_end_date, actual_end_date,
              discontinued_reason, status_reason, doctor, reference_id, reconciliation_category, reconciliation_notes,
              is_conflicting, conflict_details, source, reliability, verification_status, created_at, updated_at
       FROM patient_medications
       WHERE patient_id = ANY($1::text[]) OR user_id = $2
       ORDER BY 
         CASE 
           WHEN status = 'ACTIVE' THEN 1
           WHEN status = 'NEEDS_REVIEW' THEN 2
           WHEN status = 'ON_HOLD' THEN 3
           ELSE 4 
         END,
         start_date DESC NULLS LAST,
         id DESC;`,
      [patientIds, payload.userId]
    );

    const todayStr = new Date().toISOString().split("T")[0];

    // Build image lookup maps from Document and confirmed_prescriptions
    const docIdToImageMap = new Map<number, string>();
    const extractionToImageMap = new Map<number, string>();
    const cpToImageMap = new Map<number, string>();

    try {
      const allDocs = await query(
        `SELECT d.id, d."originalName", d."storedFilename", d."filePath"
         FROM "Document" d
         WHERE d."userId" = $1 OR d."patientId" = ANY($2::text[]);`,
        [payload.userId, patientIds]
      );

      allDocs.forEach((d: any) => {
        let img = d.storedFilename;
        if (img && (img.startsWith("http://") || img.startsWith("https://") || img.startsWith("/uploads/") || img.startsWith("/"))) {
          docIdToImageMap.set(d.id, img);
        }
        if (d.filePath) {
          const m = d.filePath.match(/\/extractions\/(\d+)/);
          if (m && img) {
            extractionToImageMap.set(parseInt(m[1], 10), img);
          }
        }
      });

      const allCPs = await query(
        `SELECT cp.id, cp.extraction_id, cp.data_json
         FROM confirmed_prescriptions cp
         WHERE cp.patient_id = ANY($1::text[]);`,
        [patientIds]
      );

      allCPs.forEach((cp: any) => {
        let img: string | null = null;
        try {
          const dj = typeof cp.data_json === "string" ? JSON.parse(cp.data_json) : cp.data_json || {};
          if (dj.image_url) img = dj.image_url;
        } catch (_) {}

        if (!img && cp.extraction_id && extractionToImageMap.has(cp.extraction_id)) {
          img = extractionToImageMap.get(cp.extraction_id)!;
        }
        if (img) cpToImageMap.set(cp.id, img);
      });
    } catch (imgErr) {
      console.warn("[Medications] Warning resolving prescription images:", imgErr);
    }

    // Map into rich course entities
    const courses: MedicationCourse[] = rows.map((r: any) => {
      const passed = isExpectedEndDatePassed(r.expected_end_date, todayStr);

      let resolvedImageUrl: string = "/sample_prescription.png";
      if (r.prescription_id && cpToImageMap.has(r.prescription_id)) {
        resolvedImageUrl = cpToImageMap.get(r.prescription_id)!;
      } else if (r.document_id && docIdToImageMap.has(r.document_id)) {
        resolvedImageUrl = docIdToImageMap.get(r.document_id)!;
      } else if (r.reference_id) {
        const m = String(r.reference_id).match(/CP-RX-(\d+)/);
        if (m && cpToImageMap.has(parseInt(m[1], 10))) {
          resolvedImageUrl = cpToImageMap.get(parseInt(m[1], 10))!;
        }
      }

      return {
        id: r.id,
        patientId: r.patient_id,
        userId: r.user_id,
        prescriptionId: r.prescription_id,
        documentId: r.document_id,
        name: r.name,
        normalizedName: r.normalized_name || normalizeMedicineName(r.name),
        strength: r.strength || "",
        status: r.status as MedicationLifecycleStatus,
        indication: r.indication || null,
        frequency: r.frequency || "As prescribed",
        route: r.route || "Oral",
        prescriptionDate: r.prescription_date || null,
        uploadedAt: r.uploaded_at || null,
        startDate: r.start_date || null,
        durationRaw: r.duration_raw || null,
        durationDays: r.duration_days !== null ? Number(r.duration_days) : null,
        expectedEndDate: r.expected_end_date || null,
        actualEndDate: r.actual_end_date || null,
        discontinuedReason: r.discontinued_reason || null,
        statusReason: r.status_reason || null,
        doctor: r.doctor || "Attending Physician",
        referenceId: r.reference_id || `MED-${r.id}`,
        reconciliationCategory: r.reconciliation_category || "NEW_COURSE",
        reconciliationNotes: r.reconciliation_notes || null,
        isConflicting: Boolean(r.is_conflicting),
        conflictDetails: r.conflict_details || null,
        source: r.source || "Prescription Scan",
        reliability: r.reliability || "High",
        verificationStatus: r.verification_status || "Prescription Verified",
        isExpectedEndDatePassed: passed,
        imageUrl: resolvedImageUrl,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
    });

    // Categorize into the 3 core views
    // 1. Current Medicines: Active treatment courses
    const current = courses.filter((c) => c.status === "ACTIVE");

    // 2. Medical History: Completed, Discontinued, and On Hold courses
    const history = courses.filter(
      (c) => c.status === "COMPLETED" || c.status === "DISCONTINUED" || c.status === "ON_HOLD"
    );

    // 3. Needs Review: Courses flagged for clinical ambiguity, missing duration, conflicting instructions,
    //    or active courses where the expected end date has passed without explicit completion.
    const needsReview = courses.filter((c) => {
      if (c.status === "NEEDS_REVIEW") return true;
      if (c.isConflicting) return true;
      if (
        c.reconciliationCategory === "CHANGE_IN_STRENGTH_OR_INSTRUCTIONS" ||
        c.reconciliationCategory === "CONFLICTING_INSTRUCTIONS" ||
        c.reconciliationCategory === "OVERLAPPING_TREATMENT" ||
        c.reconciliationCategory === "INSUFFICIENT_INFORMATION"
      ) {
        return true;
      }
      if (c.status === "ACTIVE" && c.isExpectedEndDatePassed) {
        return true;
      }
      return false;
    });

    // Summary counts
    const counts = {
      total: courses.length,
      active: current.length,
      history: history.length,
      needsReview: needsReview.length,
      conflicts: courses.filter((c) => c.isConflicting).length,
    };

    // Filter metadata
    const availableDoctors = Array.from(
      new Set(courses.map((c) => c.doctor).filter(Boolean))
    );
    const availableIndications = Array.from(
      new Set(courses.map((c) => c.indication).filter(Boolean) as string[])
    );

    return NextResponse.json({
      success: true,
      medications: courses,
      // Provide both modern 3-section views and legacy keys for backward-compatibility
      current,
      history,
      needsReview,
      medicines: courses,
      counts,
      activeCount: counts.active,
      historicalCount: counts.history,
      conflictsCount: counts.conflicts,
      filterOptions: {
        doctors: availableDoctors,
        indications: availableIndications,
        statuses: ["ACTIVE", "COMPLETED", "DISCONTINUED", "ON_HOLD", "NEEDS_REVIEW"],
      },
    });
  } catch (error: any) {
    console.error("Medicines API Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load patient medications" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/patient/medicines
 * Manually logs or reconciles a new medication course for the authenticated patient.
 */
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
      name,
      strength,
      status = "ACTIVE",
      indication,
      frequency = "Once daily",
      route = "Oral",
      startDate = new Date().toISOString().split("T")[0],
      durationRaw,
      doctor,
      referenceId,
      source = "Manual Entry",
      reliability = "Medium",
      verificationStatus = "Patient Confirmed",
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Medication name is required" }, { status: 400 });
    }

    const patientId = payload.patientId || "483027156";
    const patientIds = Array.from(
      new Set(
        [patientId, "CCM12578", "demo-patient-1", "713590440", "545590541", "443213338", "960183477"].filter(
          Boolean
        )
      )
    );

    const normName = normalizeMedicineName(name);
    const durationDays = parsePrescribedDuration(durationRaw);
    const expectedEndDate = calculateExpectedEndDate(startDate, durationDays);
    const docName = doctor || `${payload.name || "Patient"} (Self-Log)`;
    const refId = referenceId || `MED-${Date.now().toString().slice(-6)}`;

    // Fetch existing courses for reconciliation
    const existingRows = await query(
      `SELECT * FROM patient_medications WHERE patient_id = ANY($1::text[]) OR user_id = $2;`,
      [patientIds, payload.userId]
    );

    const existingCourses: MedicationCourse[] = existingRows.map((r: any) => ({
      id: r.id,
      patientId: r.patient_id,
      name: r.name,
      normalizedName: r.normalized_name || normalizeMedicineName(r.name),
      strength: r.strength || "",
      status: r.status as MedicationLifecycleStatus,
      frequency: r.frequency || "",
      route: r.route || "Oral",
      startDate: r.start_date,
      prescriptionDate: r.prescription_date,
      uploadedAt: r.uploaded_at,
      durationRaw: r.duration_raw,
      durationDays: r.duration_days,
      expectedEndDate: r.expected_end_date,
      actualEndDate: r.actual_end_date,
      discontinuedReason: r.discontinued_reason,
      doctor: r.doctor,
      referenceId: r.reference_id,
      indication: r.indication,
      reconciliationCategory: r.reconciliation_category,
      reconciliationNotes: r.reconciliation_notes,
      isConflicting: Boolean(r.is_conflicting),
      conflictDetails: r.conflict_details,
      source: r.source,
      reliability: r.reliability,
      verificationStatus: r.verification_status,
      isExpectedEndDatePassed: isExpectedEndDatePassed(r.expected_end_date),
    }));

    // Run reconciliation
    const recon = reconcileMedication(
      {
        name,
        strength,
        frequency,
        route,
        durationRaw,
        startDate,
        prescriptionDate: startDate,
        doctor: docName,
        referenceId: refId,
        indication,
      },
      existingCourses
    );

    const targetStatus = status !== "ACTIVE" ? status : recon.assignedStatus;

    // Insert into patient_medications
    const inserted = await query(
      `INSERT INTO patient_medications (
        patient_id, user_id, name, normalized_name, strength, status, indication,
        frequency, route, prescription_date, uploaded_at, start_date, duration_raw,
        duration_days, expected_end_date, actual_end_date, discontinued_reason, doctor,
        reference_id, reconciliation_category, reconciliation_notes, is_conflicting,
        conflict_details, source, reliability, verification_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NULL, NULL, $16, $17, $18, $19, $20, $21, $22, $23, $24)
      RETURNING *;`,
      [
        patientId,
        payload.userId,
        name.trim(),
        normName,
        strength || null,
        targetStatus,
        indication || null,
        frequency,
        route,
        startDate,
        new Date().toISOString().split("T")[0],
        startDate,
        durationRaw || null,
        durationDays,
        expectedEndDate,
        docName,
        refId,
        recon.reconciliationCategory,
        recon.reconciliationNotes,
        recon.isConflicting,
        recon.conflictDetails,
        source,
        reliability,
        verificationStatus,
      ]
    );

    const record = inserted[0];

    // Log creation audit
    await query(
      `INSERT INTO patient_medication_audit (
        medication_id, patient_id, user_id, action, previous_status, new_status, reason, actor
      ) VALUES ($1, $2, $3, 'CREATED', NULL, $4, $5, $6);`,
      [record.id, patientId, payload.userId, targetStatus, recon.reconciliationNotes, payload.name || "Patient"]
    );

    return NextResponse.json(
      {
        success: true,
        message: "Medication record saved and reconciled successfully",
        medication: record,
        reconciliation: recon,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Create Medication Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create medication record" },
      { status: 500 }
    );
  }
}
