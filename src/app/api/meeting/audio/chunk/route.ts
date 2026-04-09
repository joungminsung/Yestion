import { readdir, readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { getServerSession } from "@/server/auth/session";
import { getEffectivePermission } from "@/lib/permissions";

function normalizeSourceKey(mode: string, sourceKey: string | null) {
  if (mode !== "multi_participant") {
    return "single_recorder";
  }

  if (!sourceKey || !/^[a-zA-Z0-9_]+$/.test(sourceKey)) {
    return null;
  }

  return sourceKey;
}

export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId");
  const chunkIndexRaw = url.searchParams.get("chunkIndex");
  const sourceKeyRaw = url.searchParams.get("sourceKey");

  if (!sessionId || !chunkIndexRaw) {
    return NextResponse.json({ error: "Missing query params" }, { status: 400 });
  }

  const chunkIndex = Number.parseInt(chunkIndexRaw, 10);
  if (!Number.isFinite(chunkIndex) || chunkIndex < 0) {
    return NextResponse.json({ error: "Invalid chunk index" }, { status: 400 });
  }

  const meetingSession = await db.meetingSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      pageId: true,
      mode: true,
      storeAudio: true,
      audioStoragePath: true,
    },
  });

  if (!meetingSession) {
    return NextResponse.json({ error: "Meeting session not found" }, { status: 404 });
  }

  const permission = await getEffectivePermission(db, session.user.id, meetingSession.pageId);
  if (permission === "none") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!meetingSession.storeAudio || !meetingSession.audioStoragePath) {
    return NextResponse.json({ error: "Audio is not stored for this session" }, { status: 404 });
  }

  const sourceKey = normalizeSourceKey(meetingSession.mode, sourceKeyRaw);
  if (!sourceKey) {
    return NextResponse.json({ error: "Invalid source key" }, { status: 400 });
  }

  const chunkDir = path.join(meetingSession.audioStoragePath, sourceKey);
  const chunkPrefix = String(chunkIndex).padStart(5, "0");

  try {
    const files = await readdir(chunkDir);
    const fileName = files.find((candidate) => candidate.startsWith(chunkPrefix));

    if (!fileName) {
      return NextResponse.json({ error: "Chunk not found" }, { status: 404 });
    }

    const buffer = await readFile(path.join(chunkDir, fileName));

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "audio/webm",
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch {
    return NextResponse.json({ error: "Chunk not found" }, { status: 404 });
  }
}
