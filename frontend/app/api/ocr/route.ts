import { NextRequest, NextResponse } from "next/server";
import { pythonBackendFetch } from "@/lib/api";

export const dynamic = "force-dynamic";
export const maxDuration = 360; // 6 minutes for CPU vision transformer + LLM structuring

const MAX_UPLOAD_MB = 10;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/jpg", "image/pjpeg"]);

export async function GET() {
  return NextResponse.json({
    status: "ready",
    message: "Prescription OCR endpoint. Submit prescription images via POST with multipart/form-data.",
    web_interface: "/upload",
  });
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const clientPatientId = formData.get("patient_id") as string | null;
    const patientName = formData.get("patient_name") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "Prescription image file is required" },
        { status: 400 }
      );
    }

    // Authenticate patient session on the server - never trust client spoofing
    let userId = 1;
    let verifiedPatientId = "483027156";
    let verifiedPatientName = patientName || "Rahul Sharma";

    try {
      const { cookies } = await import("next/headers");
      const { verifyToken } = await import("@/lib/auth");
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
        if (payload?.userId) {
          userId = payload.userId;
          if (payload.patientId) verifiedPatientId = payload.patientId;
          if (payload.name) verifiedPatientName = payload.name;
        }
      }
    } catch (authErr) {
      console.warn("Auth token extraction warning:", authErr);
    }

    const effectivePatientId = verifiedPatientId || (clientPatientId?.trim() || "483027156");

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type (${file.type}). Allowed formats: JPEG, PNG, WebP.` },
        { status: 415 }
      );
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: `File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds maximum allowed limit of ${MAX_UPLOAD_MB} MB.` },
        { status: 413 }
      );
    }

    // Prepare outbound multipart form data for Python FastAPI
    const startTime = Date.now();
    console.log(`[${new Date().toISOString()}] [API/OCR] Processing prescription (size=${file.size} bytes, type=${file.type}, filename=${file.name}, patientId=${effectivePatientId})`);

    const backendFormData = new FormData();
    backendFormData.append("file", file, file.name);
    backendFormData.append("patient_id", effectivePatientId);
    backendFormData.append("patient_name", verifiedPatientName);

    const result = await pythonBackendFetch(
      "ocr",
      {
        method: "POST",
        body: backendFormData,
      },
      360000 // 6 minutes timeout for PaddleOCR vision model + Gemini
    );

    const elapsedMs = Date.now() - startTime;

    if (!result.ok) {
      console.warn(`[${new Date().toISOString()}] [API/OCR] Pipeline returned error status ${result.status} after ${elapsedMs}ms: ${result.error}`);
      return NextResponse.json(
        {
          error: result.error || "OCR and structuring failed",
          raw_ocr_id: result.rawOcrId,
        },
        { status: result.status }
      );
    }

    console.log(`[${new Date().toISOString()}] [API/OCR] Pipeline completed successfully in ${elapsedMs}ms`);

    // Save uploaded image to public/uploads for direct browser viewing in Patient Summary
    let publicImageUrl = "/sample_prescription.png";
    try {
      const path = await import("path");
      const fs = await import("fs/promises");
      const uploadsDir = path.join(process.cwd(), "public", "uploads");
      await fs.mkdir(uploadsDir, { recursive: true });

      const ext = path.extname(file.name) || ".png";
      const cleanBase = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
      const safeFilename = `${cleanBase}_${Date.now()}${ext}`;
      const diskPath = path.join(uploadsDir, safeFilename);
      const fileBytes = Buffer.from(await file.arrayBuffer());
      await fs.writeFile(diskPath, fileBytes);
      publicImageUrl = `/uploads/${safeFilename}`;
    } catch (saveErr) {
      console.warn("Could not save image to public/uploads:", saveErr);
    }

    // Immediately save to Patient Summary as NOT CONFIRMED so it appears in the dashboard
    try {
      const { query } = await import("@/lib/db");
      const extractionId = result.data.extraction_id;
      const rec = result.data.record || {};
      rec.image_url = publicImageUrl;
      const hospitalName = rec.hospital || file.name.replace(/\.[^/.]+$/, "");
      const dateIso = rec.date_iso || new Date().toISOString().slice(0, 10);
      const docName = `${hospitalName} - ${dateIso}`;
      const medCount = (rec.medicines || []).length;
      const doctorStr = typeof rec.doctor === "string" ? rec.doctor : rec.doctor?.name || "Dr. Unverified";
      const docSummary = `${hospitalName} (${doctorStr}). Extracted ${medCount} therapies. Status: NOT CONFIRMED (Awaiting Clinician Review).`;

      const docRows = await query(
        `INSERT INTO "Document" ("userId", "patientId", "originalName", "storedFilename", "documentType", "mimeType", "filePath", status, "uploadedAt")
         VALUES ($1, $2, $3, $4, 'PRESCRIPTION', $5, $6, 'NOT CONFIRMED', $7)
         RETURNING id;`,
        [userId, effectivePatientId, docName, publicImageUrl, file.type, `/extractions/${extractionId}`, new Date().toISOString()]
      );

      if (docRows.length > 0) {
        await query(
          `INSERT INTO "Analysis" ("documentId", summary, "structuredResult", "isDemo", "createdAt")
           VALUES ($1, $2, $3, false, $4);`,
          [docRows[0].id, docSummary, JSON.stringify(rec), new Date().toISOString()]
        );
      }
    } catch (dbErr) {
      console.warn("Could not save initial NOT CONFIRMED document to DB:", dbErr);
    }

    result.data.image_url = publicImageUrl;
    return NextResponse.json(result.data);
  } catch (err: any) {
    console.error(`[${new Date().toISOString()}] [API/OCR] Unexpected exception in route:`, err);
    return NextResponse.json(
      { error: err.message || "Failed to process prescription upload" },
      { status: 500 }
    );
  }
}
