import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/server/db/client";
import { authenticateApiKey, unauthorized, notFound, forbidden, badRequest } from "@/lib/api-auth";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/v1/blocks/:id/children — List child blocks
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await authenticateApiKey(request);
  if (!auth) return unauthorized();

  const { id } = await params;

  // id can be a page ID or block ID
  // Try page first
  const page = await db.page.findUnique({ where: { id }, select: { workspaceId: true } });
  if (page) {
    if (page.workspaceId !== auth.workspaceId) return forbidden();
    const blocks = await db.block.findMany({
      where: { pageId: id, parentId: null },
      orderBy: { position: "asc" },
      include: { children: { orderBy: { position: "asc" } } },
    });

    return Response.json({
      object: "list",
      results: blocks.map(formatBlock),
      has_more: false,
    });
  }

  // Try as block ID
  const block = await db.block.findUnique({
    where: { id },
    include: { page: { select: { workspaceId: true } } },
  });
  if (!block) return notFound("Block or page not found");
  if (block.page.workspaceId !== auth.workspaceId) return forbidden();

  const children = await db.block.findMany({
    where: { parentId: id },
    orderBy: { position: "asc" },
    include: { children: { orderBy: { position: "asc" } } },
  });

  return Response.json({
    object: "list",
    results: children.map(formatBlock),
    has_more: false,
  });
}

// POST /api/v1/blocks/:id/children — Append blocks
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await authenticateApiKey(request);
  if (!auth) return unauthorized();

  const { id } = await params;

  try {
    const body = await request.json();
    const { children } = body as { children: { type: string; content?: Record<string, unknown> }[] };

    if (!Array.isArray(children)) return badRequest("children must be an array");

    // Determine pageId and parentId
    let pageId: string;
    let parentId: string | null = null;

    const page = await db.page.findUnique({ where: { id }, select: { id: true, workspaceId: true } });
    if (page) {
      if (page.workspaceId !== auth.workspaceId) return forbidden();
      pageId = page.id;
    } else {
      const block = await db.block.findUnique({
        where: { id },
        include: { page: { select: { id: true, workspaceId: true } } },
      });
      if (!block) return notFound("Block or page not found");
      if (block.page.workspaceId !== auth.workspaceId) return forbidden();
      pageId = block.pageId;
      parentId = id;
    }

    // Get max position
    const last = await db.block.findFirst({
      where: { pageId, parentId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    let pos = (last?.position ?? -1) + 1;

    const created = [];
    for (const child of children) {
      const block = await db.block.create({
        data: {
          pageId,
          parentId,
          type: child.type,
          content: (child.content ?? child[child.type as keyof typeof child] ?? {}) as Prisma.InputJsonValue,
          position: pos++,
        },
      });
      created.push(block);
    }

    await db.page.update({ where: { id: pageId }, data: { lastEditedBy: "api" } });

    return Response.json({
      object: "list",
      results: created.map((b) => ({
        object: "block",
        id: b.id,
        type: b.type,
        [b.type]: b.content,
        has_children: false,
      })),
    });
  } catch {
    return badRequest("Invalid request body");
  }
}

function formatBlock(block: { id: string; type: string; content: unknown; children?: { id: string; type: string; content: unknown }[] }) {
  return {
    object: "block",
    id: block.id,
    type: block.type,
    [block.type]: block.content,
    has_children: (block.children?.length ?? 0) > 0,
  };
}
