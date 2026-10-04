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
        const prevResult = existingDocs[0].structuredResult || {};
        if (!rec.image_url && prevResult.image_url) {
          rec.image_url = prevResult.image_url;
        } else if (!rec.image_url && existingDocs[0].storedFilename?.startsWith("/uploads/")) {
          rec.image_url = existingDocs[0].storedFilename;
        }
        await query(
          `UPDATE "Document" 
           SET status = 'CONFIRMED', "originalName" = $1 
           WHERE id = $2;`,
          [docName, docId]
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
