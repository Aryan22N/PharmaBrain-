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

    // Mirror confirmed prescription to Document and Analysis tables in Neon DB for Patient Summary
    try {
      const { query } = await import("@/lib/db");
      const { cookies } = await import("next/headers");
      const { verifyToken } = await import("@/lib/auth");

      let userId = 1;
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
        }
      } catch (authErr) {}

      const rec = body.record || {};
      const docName = `${rec.hospital || "Prescription"} - ${rec.date_iso || new Date().toISOString().slice(0, 10)}`;
      const medSummary = (rec.medicines || [])
        .map((m: any) => `${m.name || "Medicine"} ${m.strength || ""}`.trim())
        .filter(Boolean)
        .join(", ");
      const docSummary = `${rec.hospital || "Medical Facility"} (${typeof rec.doctor === "string" ? rec.doctor : rec.doctor?.name || "Dr. Verified"}). Prescribed: ${medSummary || "Verified therapies"}.`;

      const docRows = await query(
        `INSERT INTO "Document" ("userId", "originalName", "storedFilename", "documentType", "mimeType", "filePath", status, "uploadedAt")
         VALUES ($1, $2, $2, 'PRESCRIPTION', 'image/jpeg', $3, 'CONFIRMED', $4)
         RETURNING id;`,
        [userId, docName, `/extractions/${id}`, new Date().toISOString()]
      );

      if (docRows.length > 0) {
        await query(
          `INSERT INTO "Analysis" ("documentId", summary, "structuredResult", "isDemo", "createdAt")
           VALUES ($1, $2, $3, false, $4);`,
          [docRows[0].id, docSummary, JSON.stringify(rec), new Date().toISOString()]
        );
      }
    } catch (dbErr) {
      console.warn("Could not mirror confirmed prescription to Document table:", dbErr);
    }

    return NextResponse.json(result.data);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to confirm prescription" },
      { status: 500 }
    );
  }
}
