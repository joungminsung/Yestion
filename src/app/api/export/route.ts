import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/server/auth/session";
import { db } from "@/server/db/client";

function getTextContent(content: Record<string, unknown>): string {
  if (typeof content.text === "string") return content.text;
  if (typeof content.title === "string") return content.title;
  return "";
}

interface BlockData {
  type: string;
  content: Record<string, unknown>;
  children: BlockData[];
}

function blocksToMarkdown(blocks: BlockData[], depth = 0): string {
  const lines: string[] = [];
  const indent = "  ".repeat(depth);

  for (const block of blocks) {
    const text = getTextContent(block.content);
    switch (block.type) {
      case "heading_1": lines.push(`# ${text}`); break;
      case "heading_2": lines.push(`## ${text}`); break;
      case "heading_3": lines.push(`### ${text}`); break;
      case "paragraph": lines.push(`${indent}${text}`); break;
      case "bulleted_list": lines.push(`${indent}- ${text}`); break;
      case "numbered_list": lines.push(`${indent}1. ${text}`); break;
      case "to_do": {
        const checked = block.content.checked ? "x" : " ";
        lines.push(`${indent}- [${checked}] ${text}`);
        break;
      }
      case "quote": lines.push(`${indent}> ${text}`); break;
      case "code": lines.push(`\`\`\`${block.content.language ?? ""}\n${text}\n\`\`\``); break;
      case "divider": lines.push("---"); break;
      case "image": lines.push(`![${text || "image"}](${block.content.url ?? ""})`); break;
      default: if (text) lines.push(`${indent}${text}`); break;
    }
    if (block.children.length > 0) {
      lines.push(blocksToMarkdown(block.children, depth + 1));
    }
  }
  return lines.join("\n\n");
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function blocksToHtml(blocks: BlockData[]): string {
  const parts: string[] = [];
  for (const block of blocks) {
    const text = escapeHtml(getTextContent(block.content));
    const childrenHtml = block.children.length > 0 ? blocksToHtml(block.children) : "";
    switch (block.type) {
      case "heading_1": parts.push(`<h1>${text}</h1>`); break;
      case "heading_2": parts.push(`<h2>${text}</h2>`); break;
      case "heading_3": parts.push(`<h3>${text}</h3>`); break;
      case "paragraph": parts.push(`<p>${text}</p>`); break;
      case "bulleted_list": parts.push(`<ul><li>${text}${childrenHtml}</li></ul>`); continue;
      case "numbered_list": parts.push(`<ol><li>${text}${childrenHtml}</li></ol>`); continue;
      case "to_do": {
        const checked = block.content.checked ? " checked" : "";
        parts.push(`<div><input type="checkbox"${checked} disabled /> ${text}</div>`);
        break;
      }
      case "quote": parts.push(`<blockquote>${text}</blockquote>`); break;
      case "code": parts.push(`<pre><code>${text}</code></pre>`); break;
      case "divider": parts.push("<hr />"); break;
      case "image": parts.push(`<img src="${escapeHtml(String(block.content.url ?? ""))}" alt="${text}" />`); break;
      default: if (text) parts.push(`<p>${text}</p>`); break;
    }
    if (childrenHtml) parts.push(childrenHtml);
  }
  return parts.join("\n");
}

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

  const blockData: BlockData[] = blocks.map((b) => ({
    type: b.type,
    content: (b.content as Record<string, unknown>) ?? {},
    children: (b.children ?? []).map((c) => ({
      type: c.type,
      content: (c.content as Record<string, unknown>) ?? {},
      children: ((c as unknown as { children?: BlockData[] }).children ?? []).map((gc) => ({
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
