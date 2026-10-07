import { NextRequest, NextResponse } from "next/server";
import { pythonBackendFetch } from "@/lib/api";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  // 1. Tell Python OCR engine to delete the draft extraction
  const result = await pythonBackendFetch(`discard/${encodeURIComponent(id)}`, {
    method: "POST",
  });

  // 2. Delete matching Document & Analysis records from Supabase PostgreSQL so it is not stored in DB or shown on dashboard
  try {
    const numericId = Number(id);
    await query(
      `DELETE FROM "Analysis" WHERE "documentId" IN (
         SELECT id FROM "Document" WHERE "filePath" LIKE $1 OR id = $2
       );`,
      [`%${id}%`, isNaN(numericId) ? -1 : numericId]
    );
    await query(
      `DELETE FROM "Document" WHERE "filePath" LIKE $1 OR id = $2;`,
      [`%${id}%`, isNaN(numericId) ? -1 : numericId]
    );
  } catch (dbErr) {
    console.warn("Error deleting discarded document from PostgreSQL:", dbErr);
  }

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || "Discard failed" },
      { status: result.status }
    );
  }

  return NextResponse.json(result.data || { ok: true });
}
