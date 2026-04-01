import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { type BlockData, blocksToHtml, escapeHtml } from "@/lib/export-utils";

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const pageId = searchParams.get("pageId");

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
  const body = blocksToHtml(blockData);

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans KR', sans-serif;
      max-width: 720px;
      margin: 0 auto;
      padding: 2rem 1rem;
      line-height: 1.7;
      color: #37352f;
      font-size: 15px;
    }
    h1 { font-size: 2em; font-weight: 700; margin-bottom: 0.5em; margin-top: 1em; }
    h2 { font-size: 1.5em; font-weight: 600; margin-bottom: 0.4em; margin-top: 0.8em; }
    h3 { font-size: 1.25em; font-weight: 600; margin-bottom: 0.3em; margin-top: 0.6em; }
    p { margin-bottom: 0.5em; }
    blockquote {
      border-left: 3px solid #e0e0e0;
      margin-left: 0;
      padding-left: 1em;
      color: #555;
      margin-bottom: 0.5em;
    }
    pre {
      background: #f5f5f5;
      padding: 1em;
      border-radius: 4px;
      overflow-x: auto;
      margin-bottom: 0.5em;
      font-size: 0.9em;
    }
    code { font-family: 'SFMono-Regular', Menlo, monospace; font-size: 0.9em; }
    hr { border: none; border-top: 1px solid #e0e0e0; margin: 1.5em 0; }
    img { max-width: 100%; height: auto; margin: 0.5em 0; }
    ul, ol { margin-left: 1.5em; margin-bottom: 0.5em; }
    li { margin-bottom: 0.25em; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 1em; }
    th, td { border: 1px solid #e0e0e0; padding: 8px 12px; text-align: left; }
    th { background: #f7f6f3; font-weight: 600; }
    .callout {
      background: #f7f6f3;
      padding: 1em;
      border-radius: 4px;
      margin-bottom: 0.5em;
    }

    @media print {
      body { padding: 0; margin: 0 auto; }
      @page { margin: 2cm; size: A4; }
      h1, h2, h3 { page-break-after: avoid; }
      pre, blockquote, table { page-break-inside: avoid; }
      img { page-break-inside: avoid; max-height: 400px; }
    }

    .print-header {
      text-align: center;
      padding: 1em 0 2em 0;
      border-bottom: 1px solid #e0e0e0;
      margin-bottom: 2em;
    }
    .print-header h1 { margin: 0; font-size: 2em; }
    .print-header .date { color: #999; font-size: 0.85em; margin-top: 0.5em; }

    @media screen {
      .print-toolbar {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: #2383e2;
        color: white;
        padding: 12px 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        z-index: 1000;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      }
      .print-toolbar button {
        background: white;
        color: #2383e2;
        border: none;
        padding: 8px 20px;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
      }
      .print-toolbar button:hover { opacity: 0.9; }
      body { padding-top: 60px; }
    }
    @media print {
      .print-toolbar { display: none !important; }
      body { padding-top: 0; }
    }
  </style>
</head>
<body>
  <div class="print-toolbar">
    <span style="font-weight:600;">PDF 내보내기 미리보기</span>
    <div style="display:flex;gap:8px;">
      <button onclick="window.print()">🖨 인쇄 / PDF 저장</button>
      <button onclick="window.close()" style="background:transparent;color:white;border:1px solid rgba(255,255,255,0.3);">닫기</button>
    </div>
  </div>
  <div class="print-header">
    <h1>${escapeHtml(title)}</h1>
    <div class="date">${new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}</div>
  </div>
  ${body}
  <script>
    // Auto-trigger print dialog after a brief delay for rendering
    if (window.opener || window.history.length <= 1) {
      setTimeout(function() { window.print(); }, 500);
    }
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
