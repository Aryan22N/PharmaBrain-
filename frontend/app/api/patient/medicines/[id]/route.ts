import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import {
  MedicationLifecycleStatus,
  validateStatusTransition,
} from "@/lib/medicationLifecycle";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/patient/medicines/[id]
 * Updates medication lifecycle status, duration, or instructions with clinical audit trail.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const medId = parseInt(id, 10);
    if (isNaN(medId)) {
      return NextResponse.json({ error: "Invalid medication ID" }, { status: 400 });
    }

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
      new Set([patientId, "CCM12578", "demo-patient-1", "713590440", "545590541", "443213338", "960183477"].filter(Boolean))
    );

    // Fetch existing medication record
    const existingRows = await query(
      `SELECT * FROM patient_medications WHERE id = $1;`,
      [medId]
    );

    if (existingRows.length === 0) {
      return NextResponse.json({ error: "Medication record not found" }, { status: 404 });
    }

    const existing = existingRows[0];

    // Security Check: Verify patient ownership
    const isOwner =
      existing.user_id === payload.userId ||
      patientIds.includes(existing.patient_id);

    if (!isOwner) {
      return NextResponse.json(
        { error: "Forbidden: You do not have permission to modify this medication record" },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const {
      status: targetStatus,
      discontinuedReason,
      reason,
      statusReason,
      frequency,
      strength,
      isConflicting,
      conflictDetails,
      reconciliationNotes,
    } = body;

    const todayStr = new Date().toISOString().split("T")[0];
    let newStatus: MedicationLifecycleStatus = existing.status;
    let actualEndDate = existing.actual_end_date;
    let discReason = existing.discontinued_reason;
    const effectiveReason = (reason || statusReason || discontinuedReason || "").trim();
    let statusReasonVal = existing.status_reason;
    let auditAction = "UPDATED";

    // Validate lifecycle status transition if status is being updated
    if (targetStatus && targetStatus !== existing.status) {
      const transition = validateStatusTransition(
        existing.status as MedicationLifecycleStatus,
        targetStatus as MedicationLifecycleStatus,
        effectiveReason || discontinuedReason
      );

      if (!transition.allowed) {
        return NextResponse.json(
          { error: transition.error || "Disallowed lifecycle transition" },
          { status: 422 }
        );
      }

      newStatus = targetStatus;
      auditAction = "STATUS_CHANGE";

      if (targetStatus === "COMPLETED") {
        actualEndDate = todayStr;
        statusReasonVal = effectiveReason || "Course completed by patient";
        auditAction = "COMPLETED";
      } else if (targetStatus === "DISCONTINUED") {
        actualEndDate = todayStr;
        discReason = effectiveReason || "Discontinued by clinician/patient";
        statusReasonVal = effectiveReason || "Discontinued by clinician/patient";
        auditAction = "DISCONTINUED";
      } else if (targetStatus === "ON_HOLD") {
        statusReasonVal = effectiveReason || "Treatment put on hold";
        auditAction = "ON_HOLD";
      } else if (targetStatus === "ACTIVE") {
        statusReasonVal = effectiveReason || "Treatment resumed";
        auditAction = "RESUMED";
      }
    }

    // Resolve conflict or review flag if explicitly requested
    const updatedIsConflicting =
      isConflicting !== undefined ? Boolean(isConflicting) : existing.is_conflicting;
    const updatedConflictDetails =
      conflictDetails !== undefined ? conflictDetails : existing.conflict_details;
    const updatedReconNotes =
      reconciliationNotes !== undefined ? reconciliationNotes : existing.reconciliation_notes;
    const updatedFreq = frequency || existing.frequency;
    const updatedStrength = strength || existing.strength;

    // Update medication record
    const updatedRows = await query(
      `UPDATE patient_medications
       SET status = $1,
           actual_end_date = $2,
           discontinued_reason = $3,
           status_reason = $4,
           frequency = $5,
           strength = $6,
           is_conflicting = $7,
           conflict_details = $8,
           reconciliation_notes = $9,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $10
       RETURNING *;`,
      [
        newStatus,
        actualEndDate,
        discReason,
        statusReasonVal,
        updatedFreq,
        updatedStrength,
        updatedIsConflicting,
        updatedConflictDetails,
        updatedReconNotes,
        medId,
      ]
    );

    const updated = updatedRows[0];

    // Record audit trail
    await query(
      `INSERT INTO patient_medication_audit (
        medication_id, patient_id, user_id, action, previous_status, new_status, reason, actor
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
      [
        medId,
        existing.patient_id,
        payload.userId,
        auditAction,
        existing.status,
        newStatus,
        effectiveReason || discReason || statusReasonVal || "Record updated",
        payload.name || "Patient/Clinician",
      ]
    );

    return NextResponse.json({
      success: true,
      message: `Medication status updated to ${newStatus}`,
      medication: updated,
    });
  } catch (error: any) {
    console.error("Update Medication Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update medication record" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/patient/medicines/[id]
 * Soft-discontinues or deletes a patient medication entry.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const medId = parseInt(id, 10);
    if (isNaN(medId)) {
      return NextResponse.json({ error: "Invalid medication ID" }, { status: 400 });
    }

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
      new Set([patientId, "CCM12578", "demo-patient-1", "713590440", "545590541", "443213338", "960183477"].filter(Boolean))
    );

    const existingRows = await query(
      `SELECT * FROM patient_medications WHERE id = $1;`,
      [medId]
    );

    if (existingRows.length === 0) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    const existing = existingRows[0];
    const isOwner =
      existing.user_id === payload.userId ||
      patientIds.includes(existing.patient_id);

    if (!isOwner) {
      return NextResponse.json(
        { error: "Forbidden: You do not have permission to delete this record" },
        { status: 403 }
      );
    }

    // Set to DISCONTINUED with audit log instead of destroying clinical history
    const todayStr = new Date().toISOString().split("T")[0];
    await query(
      `UPDATE patient_medications
       SET status = 'DISCONTINUED',
           actual_end_date = $1,
           discontinued_reason = 'Discontinued by patient request',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2;`,
      [todayStr, medId]
    );

    await query(
      `INSERT INTO patient_medication_audit (
        medication_id, patient_id, user_id, action, previous_status, new_status, reason, actor
      ) VALUES ($1, $2, $3, 'DISCONTINUED', $4, 'DISCONTINUED', 'Discontinued by user action', $5);`,
      [medId, existing.patient_id, payload.userId, existing.status, payload.name || "Patient"]
    );

    return NextResponse.json({
      success: true,
      message: "Medication successfully moved to Discontinued history",
    });
  } catch (error: any) {
    console.error("Delete Medication Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to remove medication" },
      { status: 500 }
    );
  }
}
