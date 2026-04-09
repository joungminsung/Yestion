import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc/init";
import type { Context } from "@/server/trpc/init";
import { type BlockData, blocksToMarkdown, blocksToHtml, escapeHtml } from "@/lib/export-utils";
import { getEffectivePermission } from "@/lib/permissions";

async function verifyPageAccess(
  db: Context["db"],
  userId: string,
  pageId: string,
) {
  const page = await db.page.findUnique({ where: { id: pageId } });
  if (!page) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Page not found" });
  }
  const permission = await getEffectivePermission(db as never, userId, pageId);
  if (permission === "none") {
    throw new TRPCError({ code: "FORBIDDEN", message: "No access to this page" });
  }
  return page;
}

async function getPageBlocks(db: Context["db"], pageId: string): Promise<BlockData[]> {
  const blocks = await db.block.findMany({
    where: { pageId, parentId: null },
    include: {
      children: {
        orderBy: { position: "asc" },
        include: {
          children: { orderBy: { position: "asc" } },
        },
      },
    },
    orderBy: { position: "asc" },
  });

  return blocks.map((b) => ({
    id: b.id,
    type: b.type,
    content: (b.content as Record<string, unknown>) ?? {},
    position: b.position,
    children: (b.children ?? []).map((c) => ({
      id: c.id,
      type: c.type,
      content: (c.content as Record<string, unknown>) ?? {},
      position: c.position,
      children: ((c as unknown as { children?: BlockData[] }).children ?? []).map((gc) => ({
        id: gc.id,
        type: gc.type,
        content: gc.content ?? {},
        position: gc.position,
        children: [],
      })),
    })),
  }));
}

export const exportRouter = router({
  exportMarkdown: protectedProcedure
    .input(z.object({ pageId: z.string() }))
    .query(async ({ ctx, input }) => {
      const page = await verifyPageAccess(ctx.db, ctx.session.user.id, input.pageId);
      const blocks = await getPageBlocks(ctx.db, input.pageId);

      const title = page.title || "제목 없음";
      const markdown = `# ${title}\n\n${blocksToMarkdown(blocks)}`;

      return { content: markdown, filename: `${title}.md` };
    }),

  exportHtml: protectedProcedure
    .input(z.object({ pageId: z.string() }))
    .query(async ({ ctx, input }) => {
      const page = await verifyPageAccess(ctx.db, ctx.session.user.id, input.pageId);
      const blocks = await getPageBlocks(ctx.db, input.pageId);

      const title = page.title || "제목 없음";
      const body = blocksToHtml(blocks);
      const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; color: #37352f; }
    h1, h2, h3 { margin-top: 1.5em; }
    blockquote { border-left: 3px solid #e0e0e0; margin-left: 0; padding-left: 1em; color: #555; }
    pre { background: #f5f5f5; padding: 1em; border-radius: 4px; overflow-x: auto; }
    .callout { background: #f7f6f3; padding: 1em; border-radius: 4px; margin: 0.5em 0; }
    hr { border: none; border-top: 1px solid #e0e0e0; margin: 1.5em 0; }
    img { max-width: 100%; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  ${body}
</body>
</html>`;

      return { content: html, filename: `${title}.html` };
    }),
});
