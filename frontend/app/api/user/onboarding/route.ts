import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
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
    if (!payload?.userId) {
      return NextResponse.json({ error: "Invalid or expired session token." }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON request payload." }, { status: 400 });
    }

    const { basicInfo, conditions, customConditions, history } = body;
    const userId = payload.userId;
    const patientId = payload.patientId || "960183477";

    // 1. Ensure table patient_onboarding exists in Supabase PostgreSQL
    await query(`
      CREATE TABLE IF NOT EXISTS patient_onboarding (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE NOT NULL,
        patient_id VARCHAR(64) NOT NULL,
        basic_info JSONB,
        conditions JSONB,
        custom_conditions JSONB,
        history JSONB,
        is_completed BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // 2. Save or update onboarding profile in PostgreSQL
    await query(
      `INSERT INTO patient_onboarding (user_id, patient_id, basic_info, conditions, custom_conditions, history, is_completed, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW())
       ON CONFLICT (user_id) 
       DO UPDATE SET 
         patient_id = EXCLUDED.patient_id,
         basic_info = EXCLUDED.basic_info,
         conditions = EXCLUDED.conditions,
         custom_conditions = EXCLUDED.custom_conditions,
         history = EXCLUDED.history,
         is_completed = TRUE,
         updated_at = NOW();`,
      [
        userId,
        patientId,
        JSON.stringify(basicInfo || {}),
        JSON.stringify(conditions || {}),
        JSON.stringify(customConditions || []),
        JSON.stringify(history || {}),
      ]
    );

    // 3. Update User table name if provided
    if (basicInfo?.name) {
      await query(`UPDATE "User" SET name = $1 WHERE id = $2;`, [basicInfo.name.trim(), userId]);
    }

    // 4. Optionally insert recorded medicines/conditions into patient_medications if chronic
    if (conditions?.hasDiabetes) {
      try {
        await query(
          `INSERT INTO patient_medications (patient_id, user_id, name, strength, status, indication, frequency, route, start_date, doctor, source, reliability, verification_status)
           VALUES ($1, $2, 'Metformin', '500 mg', 'ACTIVE', 'Type 2 Diabetes Mellitus', '1-0-1', 'Oral', $3, 'Attending Physician', 'Patient Entry', 'Medium', 'Patient Confirmed')
           ON CONFLICT DO NOTHING;`,
          [patientId, userId, `${conditions.diabetesYear || '2021'}-01-01`]
        );
      } catch (e) {
        console.warn("Diabetes med insertion warning:", e);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Patient initial health context saved to database.",
      patientId,
      isOnboarded: true,
    });
  } catch (error: any) {
    console.error("Onboarding API Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save onboarding health context." },
      { status: 500 }
    );
  }
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload?.userId) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const rows = await query(
      `SELECT basic_info, conditions, custom_conditions, history, is_completed 
       FROM patient_onboarding 
       WHERE user_id = $1 
       LIMIT 1;`,
      [payload.userId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ isOnboarded: false, profile: null });
    }

    return NextResponse.json({
      isOnboarded: rows[0].is_completed ?? true,
      profile: {
        basicInfo: rows[0].basic_info,
        conditions: rows[0].conditions,
        customConditions: rows[0].custom_conditions,
        history: rows[0].history,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ isOnboarded: false, error: err.message }, { status: 500 });
  }
}
