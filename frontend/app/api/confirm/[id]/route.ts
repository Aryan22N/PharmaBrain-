import { NextRequest, NextResponse } from "next/server";
import { pythonBackendFetch } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();

    const result = await pythonBackendFetch(
      `confirm/${encodeURIComponent(id)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || "Confirmation failed" },
        { status: result.status }
      );
    }

    // Mirror confirmed prescription to Document and Analysis tables in Supabase DB for Patient Summary
    try {
      const { query } = await import("@/lib/db");
      const { cookies } = await import("next/headers");
      const { verifyToken } = await import("@/lib/auth");

      let userId = 1;
      let patientId: string | null = null;
      try {
        const cookieStore = await cookies();
        let token = cookieStore.get("auth_token")?.value;
        if (!token) {
          const authHeader = req.headers.get("authorization");
          if (authHeader && authHeader.startsWith("Bearer ")) {
            token = authHeader.substring(7);
          }
        }
        if (token) {
          const payload = verifyToken(token);
          if (payload?.userId) userId = payload.userId;
          if (payload?.patientId) patientId = payload.patientId;
        }
      } catch (authErr) {}

      const rec = body.record || {};
      const docName = `${rec.hospital || "Prescription"} - ${rec.date_iso || new Date().toISOString().slice(0, 10)}`;
      const medSummary = (rec.medicines || [])
        .map((m: any) => `${m.name || "Medicine"} ${m.strength || ""}`.trim())
        .filter(Boolean)
        .join(", ");
      const docSummary = `${rec.hospital || "Medical Facility"} (${typeof rec.doctor === "string" ? rec.doctor : rec.doctor?.name || "Dr. Verified"}). Prescribed: ${medSummary || "Verified therapies"}.`;

      // Check if an unconfirmed document entry exists for this extraction
      const existingDocs = await query(
        `SELECT d.id, d."storedFilename", a."structuredResult" 
         FROM "Document" d
         LEFT JOIN "Analysis" a ON d.id = a."documentId"
         WHERE d."filePath" = $1 ORDER BY d.id DESC LIMIT 1;`,
        [`/extractions/${id}`]
      );

      if (existingDocs.length > 0) {
        const docId = existingDocs[0].id;
        let prevResult = existingDocs[0].structuredResult || {};
        if (typeof prevResult === "string") {
          try { prevResult = JSON.parse(prevResult); } catch (_) { prevResult = {}; }
        }
        if (!rec.image_url && prevResult.image_url && prevResult.image_url !== "/sample_prescription.png") {
          rec.image_url = prevResult.image_url;
        } else if (!rec.image_url && existingDocs[0].storedFilename && existingDocs[0].storedFilename !== "/sample_prescription.png" && (existingDocs[0].storedFilename.startsWith("/uploads/") || existingDocs[0].storedFilename.startsWith("http://") || existingDocs[0].storedFilename.startsWith("https://"))) {
          rec.image_url = existingDocs[0].storedFilename;
        }
        await query(
          `UPDATE "Document" 
           SET status = 'CONFIRMED', "originalName" = $1, "storedFilename" = COALESCE($2, "storedFilename")
           WHERE id = $3;`,
          [docName, rec.image_url || existingDocs[0].storedFilename, docId]
        );
        await query(
          `UPDATE "Analysis" 
           SET summary = $1, "structuredResult" = $2 
           WHERE "documentId" = $3;`,
          [docSummary, JSON.stringify(rec), docId]
        );
      } else {
        const docRows = await query(
          `INSERT INTO "Document" ("userId", "patientId", "originalName", "storedFilename", "documentType", "mimeType", "filePath", status, "uploadedAt")
           VALUES ($1, $2, $3, $4, 'PRESCRIPTION', 'image/jpeg', $5, 'CONFIRMED', $6)
           RETURNING id;`,
          [userId, patientId, docName, rec.image_url || `/extractions/${id}`, `/extractions/${id}`, new Date().toISOString()]
        );

        if (docRows.length > 0) {
          await query(
            `INSERT INTO "Analysis" ("documentId", summary, "structuredResult", "isDemo", "createdAt")
             VALUES ($1, $2, $3, false, $4);`,
            [docRows[0].id, docSummary, JSON.stringify(rec), new Date().toISOString()]
          );
        }
      }

      // Automatically track to Medical Timeline
      const eventDate = rec.date_iso || new Date().toISOString().slice(0, 10);
      const docNameStr = typeof rec.doctor === "string" ? rec.doctor : rec.doctor?.name || "Attending Physician";
      const hospNameStr = rec.hospital || "Medical Centre";
      const refId = `HMS-RX-${id}`;

      try {
        await query(
          `INSERT INTO patient_timeline_events (
            patient_id, user_id, event_date, category, title, description,
            source, reliability, verification_status, facility, doctor, reference_id,
            is_conflicting, conflict_details
          ) VALUES ($1, $2, $3, 'Medication', $4, $5, 'Hospital HMS', 'High', 'Hospital Verified', $6, $7, $8, false, null);`,
          [
            patientId || "483027156",
            userId,
            eventDate,
            `Prescription Verified: ${medSummary || "Clinical Rx"}`,
            docSummary,
            hospNameStr,
            docNameStr,
            refId,
          ]
        );
      } catch (tlErr) {
        console.warn("Could not auto-add to timeline_events:", tlErr);
      }

      // Automatically track each medicine to Recorded Medicines with Generalized Reconciliation
      if (Array.isArray(rec.medicines)) {
        const {
          normalizeMedicineName,
          parsePrescribedDuration,
          calculateExpectedEndDate,
          reconcileMedication,
        } = await import("@/lib/medicationLifecycle");

        // Fetch existing courses for this patient to run generalized reconciliation
        const effPatientId = patientId || "483027156";
        let existingCourses: any[] = [];
        try {
          const rawExisting = await query(
            `SELECT * FROM patient_medications WHERE patient_id = $1 OR user_id = $2;`,
            [effPatientId, userId]
          );
          existingCourses = rawExisting.map((r: any) => ({
            id: r.id,
            patientId: r.patient_id,
            prescriptionId: r.prescription_id,
            documentId: r.document_id,
            name: r.name,
            normalizedName: r.normalized_name || normalizeMedicineName(r.name),
            strength: r.strength || "",
            status: r.status,
            frequency: r.frequency || "",
            route: r.route || "Oral",
            startDate: r.start_date,
            prescriptionDate: r.prescription_date,
            durationRaw: r.duration_raw,
            durationDays: r.duration_days,
            expectedEndDate: r.expected_end_date,
            actualEndDate: r.actual_end_date,
            doctor: r.doctor,
            referenceId: r.reference_id,
            isConflicting: Boolean(r.is_conflicting),
            conflictDetails: r.conflict_details,
          }));
        } catch (fetchErr) {
          console.warn("Could not query existing medications for reconciliation:", fetchErr);
        }

        for (const med of rec.medicines) {
          if (!med || !med.name) continue;
          const medName = String(med.name).trim();
          const normName = normalizeMedicineName(medName);
          const medStrength = med.strength || med.dose || "";
          const medFreq = med.frequency || med.instructions || "Once daily";
          const medRoute = med.route || "Oral";
          const durationRaw = med.duration || null;
          const durationDays = parsePrescribedDuration(durationRaw);
          const expectedEndDate = calculateExpectedEndDate(eventDate, durationDays);
          const indication = rec.diagnosis || med.indication || null;

          // Check if already confirmed (idempotency check by reference_id & med name)
          const alreadyExists = existingCourses.some(
            (c: any) =>
              c.referenceId === refId &&
              (c.normalizedName === normName || normalizeMedicineName(c.name) === normName)
          );
          if (alreadyExists) continue;

          // Generalized reconciliation against patient's existing courses
          const recon = reconcileMedication(
            {
              name: medName,
              strength: medStrength,
              frequency: medFreq,
              route: medRoute,
              durationRaw,
              startDate: eventDate,
              prescriptionDate: eventDate,
              doctor: docNameStr,
              hospital: hospNameStr,
              referenceId: refId,
              indication,
            },
            existingCourses
          );

          if (recon.reconciliationCategory === "POTENTIAL_DUPLICATE") {
            continue;
          }

          try {
            const insRes = await query(
              `INSERT INTO patient_medications (
                patient_id, user_id, name, normalized_name, strength, status, indication,
                frequency, route, prescription_date, uploaded_at, start_date, duration_raw,
                duration_days, expected_end_date, actual_end_date, discontinued_reason, doctor,
                reference_id, reconciliation_category, reconciliation_notes, is_conflicting,
                conflict_details, source, reliability, verification_status
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NULL, NULL, $16, $17, $18, $19, $20, $21, 'Prescription Scan', 'High', 'Prescription Verified')
              RETURNING id;`,
              [
                effPatientId,
                userId,
                medName,
                normName,
                medStrength,
                recon.assignedStatus,
                indication,
                medFreq,
                medRoute,
                eventDate,
                new Date().toISOString().split("T")[0],
                eventDate,
                durationRaw,
                durationDays,
                expectedEndDate,
                docNameStr,
                refId,
                recon.reconciliationCategory,
                recon.reconciliationNotes,
                recon.isConflicting,
                recon.conflictDetails,
              ]
            );

            if (insRes.length > 0) {
              const newMedId = insRes[0].id;
              // Log audit trail
              await query(
                `INSERT INTO patient_medication_audit (
                  medication_id, patient_id, user_id, action, previous_status, new_status, reason, actor
                ) VALUES ($1, $2, $3, 'CREATED', NULL, $4, $5, 'Prescription Confirmation Pipeline');`,
                [newMedId, effPatientId, userId, recon.assignedStatus, recon.reconciliationNotes]
              );
            }
          } catch (medErr) {
            console.warn("Could not auto-add to patient_medications:", medErr);
          }
        }
      }

      // Automatically mirror confirmed vitals to PostgreSQL observations table
      if (Array.isArray(rec.vitals)) {
        for (const v of rec.vitals) {
          if (!v || typeof v !== 'object') continue;
          const parsed = v.parsed || {};
          let kind = v.kind;
          const vName = (v.name || '').toLowerCase();
          if (!kind) {
            if (vName.includes('bp') || vName.includes('blood pressure')) kind = 'bp';
            else if (vName.includes('pulse') || vName.includes('pr') || vName.includes('hr')) kind = 'pulse';
            else if (vName.includes('spo2') || vName.includes('o2')) kind = 'spo2';
            else if (vName.includes('temp')) kind = 'temp';
            else if (vName.includes('hba1c') || vName.includes('a1c')) kind = 'hba1c';
            else if (vName.includes('fbs') || vName.includes('fasting')) kind = 'sugar_fasting';
            else if (vName.includes('sugar') || vName.includes('rbs') || vName.includes('glucose')) kind = 'sugar_random';
            else if (vName.includes('weight') || vName.includes('wt')) kind = 'weight';
            else continue;
          }

          let sys = parsed.systolic ?? null;
          let dia = parsed.diastolic ?? null;
          let val = parsed.value ?? null;
          const uStr = parsed.unit ?? (kind === 'bp' ? 'mmHg' : '');

          if (kind === 'bp' && (sys === null || dia === null)) {
            const m = String(v.value || '').match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
            if (m) {
              sys = Number(m[1]);
              dia = Number(m[2]);
            }
          } else if (val === null && v.value) {
            const mVal = String(v.value).match(/(\d+(?:\.\d+)?)/);
            if (mVal) val = Number(mVal[1]);
          }

          try {
            await query(
              `INSERT INTO observations (patient_id, prescription_id, obs_date, kind, systolic, diastolic, value, unit, raw_text, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);`,
              [
                patientId || "483027156",
                Number(id) || null,
                eventDate,
                kind,
                sys,
                dia,
                val,
                uStr,
                `${v.name || ''} ${v.value || ''}`.slice(0, 120),
                new Date().toISOString()
              ]
            );
          } catch (obsErr) {
            console.warn("Could not mirror vital to observations table:", obsErr);
          }
        }
      }
    } catch (dbErr) {
      console.warn("Could not update/mirror confirmed prescription to Document table:", dbErr);
    }

    return NextResponse.json(result.data);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to confirm prescription" },
      { status: 500 }
    );
  }
}
