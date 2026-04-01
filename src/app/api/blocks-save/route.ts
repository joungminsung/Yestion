import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { getEffectivePermission } from "@/lib/permissions";
import type { Prisma } from "@prisma/client";

/**
 * Lightweight endpoint for sendBeacon block saves (beforeunload/visibilitychange).
 * Accepts the same payload as block.bulkSave but via a simple POST.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { pageId: string; blocks: { id: string; type: string; content: Record<string, unknown>; position: number; parentId?: string | null }[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.pageId || !Array.isArray(body.blocks)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Verify access
  const page = await db.page.findUnique({ where: { id: body.pageId }, select: { workspaceId: true } });
  if (!page) return NextResponse.json({ error: "Page not found" }, { status: 404 });

  const member = await db.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: session.user.id, workspaceId: page.workspaceId } },
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const perm = await getEffectivePermission(db, session.user.id, body.pageId);
  if (perm !== "edit") return NextResponse.json({ error: "No edit permission" }, { status: 403 });

  // Save blocks
  await db.$transaction(async (tx) => {
    const existingIds = (await tx.block.findMany({
      where: { pageId: body.pageId },
      select: { id: true },
    })).map((b: { id: string }) => b.id);

    const inputIds = new Set(body.blocks.map((b) => b.id));
    const toDelete = existingIds.filter((id: string) => !inputIds.has(id));

    if (toDelete.length > 0) {
      await tx.block.deleteMany({ where: { id: { in: toDelete } } });
    }

    const existingIdSet = new Set(existingIds);
    const toCreate = body.blocks.filter((b) => !existingIdSet.has(b.id));
    const toUpdate = body.blocks.filter((b) => existingIdSet.has(b.id));

    if (toCreate.length > 0) {
      await tx.block.createMany({
        data: toCreate.map((b) => ({
          id: b.id,
          pageId: body.pageId,
          type: b.type,
          content: b.content as Prisma.InputJsonValue,
          position: b.position,
          parentId: b.parentId ?? null,
        })),
        skipDuplicates: true,
      });
    }

    if (toUpdate.length > 0) {
      await Promise.all(
        toUpdate.map((b) =>
          tx.block.update({
            where: { id: b.id },
            data: { type: b.type, content: b.content as Prisma.InputJsonValue, position: b.position, parentId: b.parentId ?? null },
          })
        )
      );
    }
  });

  await db.page.update({ where: { id: body.pageId }, data: { lastEditedBy: session.user.id } });

  return NextResponse.json({ success: true });
}
