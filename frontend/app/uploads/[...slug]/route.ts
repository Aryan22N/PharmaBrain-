import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  try {
    const { slug } = await params;
    const filename = Array.isArray(slug) ? slug.join("/") : String(slug);

    // 1. Look in public/uploads/
    const uploadFilePath = path.join(process.cwd(), "public", "uploads", filename);
    if (fs.existsSync(uploadFilePath)) {
      const buffer = fs.readFileSync(uploadFilePath);
      const ext = path.extname(filename).toLowerCase();
      const contentType =
        ext === ".png"
          ? "image/png"
          : ext === ".jpg" || ext === ".jpeg"
          ? "image/jpeg"
          : ext === ".webp"
          ? "image/webp"
          : "application/octet-stream";
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=3600",
        },
      });
    }

    // 2. Look in standalone public/
    const samplePath = path.join(process.cwd(), "public", "sample_prescription.png");
    if (fs.existsSync(samplePath)) {
      const buffer = fs.readFileSync(samplePath);
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=86400",
        },
      });
    }

    return new NextResponse("Prescription image not found", { status: 404 });
  } catch (err: any) {
    return new NextResponse(err.message, { status: 500 });
  }
}
