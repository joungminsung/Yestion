import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/server/auth/session";
import { db } from "@/server/db/client";

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspaceId");

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  }

  const member = await db.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: session.user.id, workspaceId } },
  });
  if (!member || !["OWNER", "ADMIN"].includes(member.role)) {
    return NextResponse.json({ error: "Forbidden: Owner or Admin required" }, { status: 403 });
  }

  const workspace = await db.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  // Fetch all workspace data
  const pages = await db.page.findMany({
    where: { workspaceId },
    select: {
      id: true,
      parentId: true,
      title: true,
      icon: true,
      cover: true,
      isTemplate: true,
      isDeleted: true,
      isLocked: true,
      isFullWidth: true,
      position: true,
      createdBy: true,
      lastEditedBy: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const pageIds = pages.map((p: { id: string }) => p.id);

  const blocks = await db.block.findMany({
    where: { pageId: { in: pageIds } },
    select: {
      id: true,
      pageId: true,
      parentId: true,
      type: true,
      content: true,
      position: true,
    },
  });

  const databases = await db.database.findMany({
    where: { pageId: { in: pageIds } },
    select: {
      id: true,
      pageId: true,
      isInline: true,
    },
  });

  const databaseIds = databases.map((d: { id: string }) => d.id);

  const properties = await db.property.findMany({
    where: { databaseId: { in: databaseIds } },
    select: {
      id: true,
      databaseId: true,
      name: true,
      type: true,
      config: true,
      position: true,
      isVisible: true,
    },
  });

  const rows = await db.row.findMany({
    where: { databaseId: { in: databaseIds } },
    select: {
      id: true,
      databaseId: true,
      pageId: true,
      values: true,
    },
  });

  const views = await db.databaseView.findMany({
    where: { databaseId: { in: databaseIds } },
    select: {
      id: true,
      databaseId: true,
      name: true,
      type: true,
      config: true,
      position: true,
    },
  });

  const backupData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    workspace: {
      name: workspace.name,
      icon: workspace.icon,
    },
    pages,
    blocks,
    databases,
    properties,
    views,
    rows,
  };

  const fileName = `${workspace.name.replace(/[^a-zA-Z0-9가-힣]/g, "_")}_backup_${new Date().toISOString().slice(0, 10)}.json`;

  return new NextResponse(JSON.stringify(backupData, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
    },
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const workspaceId = body.workspaceId as string;
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  }

  const member = await db.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: session.user.id, workspaceId } },
  });
  if (!member || !["OWNER", "ADMIN"].includes(member.role)) {
    return NextResponse.json({ error: "Forbidden: Owner or Admin required" }, { status: 403 });
  }

  const backupData = body.data as {
    version?: number;
    pages?: Array<Record<string, unknown>>;
    blocks?: Array<Record<string, unknown>>;
    databases?: Array<Record<string, unknown>>;
    properties?: Array<Record<string, unknown>>;
    views?: Array<Record<string, unknown>>;
    rows?: Array<Record<string, unknown>>;
  };

  if (!backupData || !backupData.pages) {
    return NextResponse.json({ error: "Invalid backup data" }, { status: 400 });
  }

  try {
    await db.$transaction(async (tx) => {
      // Delete existing data in reverse dependency order
      const existingPages = await tx.page.findMany({
        where: { workspaceId },
        select: { id: true },
      });
      const existingPageIds = existingPages.map((p: { id: string }) => p.id);

      if (existingPageIds.length > 0) {
        // Delete in proper order to respect foreign keys
        await tx.block.deleteMany({ where: { pageId: { in: existingPageIds } } });
        const existingDbs = await tx.database.findMany({
          where: { pageId: { in: existingPageIds } },
          select: { id: true },
        });
        const existingDbIds = existingDbs.map((d: { id: string }) => d.id);

        if (existingDbIds.length > 0) {
          await tx.row.deleteMany({ where: { databaseId: { in: existingDbIds } } });
          await tx.property.deleteMany({ where: { databaseId: { in: existingDbIds } } });
          await tx.databaseView.deleteMany({ where: { databaseId: { in: existingDbIds } } });
          await tx.database.deleteMany({ where: { id: { in: existingDbIds } } });
        }

        await tx.pageSnapshot.deleteMany({ where: { pageId: { in: existingPageIds } } });
        await tx.favorite.deleteMany({ where: { pageId: { in: existingPageIds } } });
        await tx.pagePermission.deleteMany({ where: { pageId: { in: existingPageIds } } });
        await tx.comment.deleteMany({ where: { pageId: { in: existingPageIds } } });
        await tx.activityLog.deleteMany({ where: { pageId: { in: existingPageIds } } });

        // Delete pages in order (children first)
        await tx.page.updateMany({ where: { id: { in: existingPageIds } }, data: { parentId: null } });
        await tx.page.deleteMany({ where: { id: { in: existingPageIds } } });
      }

      // Restore pages (without parentId first to avoid FK issues)
      for (const page of backupData.pages || []) {
        await tx.page.create({
          data: {
            id: page.id as string,
            workspaceId,
            parentId: null,
            title: (page.title as string) || "",
            icon: (page.icon as string) || null,
            cover: (page.cover as string) || null,
            isTemplate: (page.isTemplate as boolean) || false,
            isDeleted: (page.isDeleted as boolean) || false,
            isLocked: (page.isLocked as boolean) || false,
            isFullWidth: (page.isFullWidth as boolean) || false,
            position: (page.position as number) || 0,
            createdBy: (page.createdBy as string) || session.user.id,
            lastEditedBy: (page.lastEditedBy as string) || session.user.id,
          },
        });
      }

      // Set parent relationships
      for (const page of backupData.pages || []) {
        if (page.parentId) {
          await tx.page.update({
            where: { id: page.id as string },
            data: { parentId: page.parentId as string },
          }).catch(() => {
            // Ignore if parent doesn't exist
          });
        }
      }

      // Restore blocks (without parentId first)
      for (const block of backupData.blocks || []) {
        await tx.block.create({
          data: {
            id: block.id as string,
            pageId: block.pageId as string,
            parentId: null,
            type: block.type as string,
            content: (block.content as object) || {},
            position: (block.position as number) || 0,
          },
        });
      }

      // Set block parent relationships
      for (const block of backupData.blocks || []) {
        if (block.parentId) {
          await tx.block.update({
            where: { id: block.id as string },
            data: { parentId: block.parentId as string },
          }).catch(() => {});
        }
      }

      // Restore databases
      for (const database of backupData.databases || []) {
        await tx.database.create({
          data: {
            id: database.id as string,
            pageId: database.pageId as string,
            isInline: (database.isInline as boolean) || false,
          },
        });
      }

      // Restore properties
      for (const prop of backupData.properties || []) {
        await tx.property.create({
          data: {
            id: prop.id as string,
            databaseId: prop.databaseId as string,
            name: prop.name as string,
            type: prop.type as string,
            config: (prop.config as object) || {},
            position: (prop.position as number) || 0,
            isVisible: prop.isVisible !== false,
          },
        });
      }

      // Restore views
      for (const view of backupData.views || []) {
        await tx.databaseView.create({
          data: {
            id: view.id as string,
            databaseId: view.databaseId as string,
            name: view.name as string,
            type: view.type as string,
            config: (view.config as object) || {},
            position: (view.position as number) || 0,
          },
        });
      }

      // Restore rows
      for (const row of backupData.rows || []) {
        await tx.row.create({
          data: {
            id: row.id as string,
            databaseId: row.databaseId as string,
            pageId: row.pageId as string,
            values: (row.values as object) || {},
          },
        });
      }
    });

    return NextResponse.json({ success: true, message: "Backup restored successfully" });
  } catch (err) {
    console.error("Backup restore failed:", err);
    return NextResponse.json(
      { error: "Failed to restore backup", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
