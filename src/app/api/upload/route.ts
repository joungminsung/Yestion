import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { getServerSession } from "@/server/auth/session";

const MAX_SIZE = 50 * 1024 * 1024; // 50MB
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

const ALLOWED_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg",
  ".mp4", ".webm", ".mp3", ".wav", ".ogg",
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".txt", ".csv", ".zip",
]);

export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 },
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File too large (max 50MB)" },
        { status: 400 },
      );
    }

    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json({ error: "File type not allowed" }, { status: 400 });
    }

    await mkdir(UPLOAD_DIR, { recursive: true });

    const uniqueName = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`;
    const filePath = path.join(UPLOAD_DIR, uniqueName);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    return NextResponse.json({
      url: `/uploads/${uniqueName}`,
      name: file.name,
      size: file.size,
      type: file.type,
    });
  } catch {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
