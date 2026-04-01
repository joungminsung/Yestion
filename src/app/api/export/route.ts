import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { type BlockData, blocksToMarkdown, blocksToHtml, escapeHtml } from "@/lib/export-utils";

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const pageId = searchParams.get("pageId");
  const format = searchParams.get("format") ?? "md";

  if (!pageId) {
    return NextResponse.json({ error: "pageId is required" }, { status: 400 });
  }

  const page = await db.page.findUnique({ where: { id: pageId } });
  if (!page) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }

  const member = await db.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: session.user.id, workspaceId: page.workspaceId } },
  });
  if (!member) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const blocks = await db.block.findMany({
    where: { pageId, parentId: null },
    include: {
      children: {
        orderBy: { position: "asc" },
        include: { children: { orderBy: { position: "asc" } } },
      },
    },
    orderBy: { position: "asc" },
  });

  type PrismaBlock = { type: string; content: unknown; children?: PrismaBlock[] };
  const blockData: BlockData[] = blocks.map((b: PrismaBlock) => ({
    type: b.type,
    content: (b.content as Record<string, unknown>) ?? {},
    children: (b.children ?? []).map((c: PrismaBlock) => ({
      type: c.type,
      content: (c.content as Record<string, unknown>) ?? {},
      children: ((c as unknown as { children?: BlockData[] }).children ?? []).map((gc: BlockData) => ({
        type: gc.type,
        content: gc.content ?? {},
        children: [],
      })),
    })),
  }));

  const title = page.title || "제목 없음";

  if (format === "html") {
    const body = blocksToHtml(blockData);
    const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>${escapeHtml(title)}</title><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:720px;margin:2rem auto;padding:0 1rem;line-height:1.6;color:#37352f;}blockquote{border-left:3px solid #e0e0e0;margin-left:0;padding-left:1em;color:#555;}pre{background:#f5f5f5;padding:1em;border-radius:4px;overflow-x:auto;}hr{border:none;border-top:1px solid #e0e0e0;margin:1.5em 0;}img{max-width:100%;}</style></head><body><h1>${escapeHtml(title)}</h1>${body}</body></html>`;

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(title)}.html"`,
      },
    });
  }

  const markdown = `# ${title}\n\n${blocksToMarkdown(blockData)}`;
  return new NextResponse(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(title)}.md"`,
    },
  });
}
