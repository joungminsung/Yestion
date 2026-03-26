import { db } from "@/server/db/client";
import { notFound } from "next/navigation";
import { PageEditor } from "@/components/editor/page-editor";

export default async function PageView({ params }: { params: { workspaceId: string; pageId: string } }) {
  const page = await db.page.findUnique({
    where: { id: params.pageId },
    include: { blocks: { where: { parentId: null }, orderBy: { position: "asc" }, include: { children: { orderBy: { position: "asc" } } } } },
  });

  if (!page || page.isDeleted) notFound();

  return (
    <div className="mx-auto py-12" style={{
      maxWidth: page.isFullWidth ? "var(--page-full-width)" : "var(--page-max-width)",
      paddingLeft: "var(--page-padding-x)", paddingRight: "var(--page-padding-x)",
    }}>
      {page.icon && <div className="text-6xl mb-4 cursor-pointer hover:opacity-80">{page.icon}</div>}
      <h1 className="text-4xl font-bold outline-none mb-4" style={{ color: "var(--text-primary)", fontWeight: 700, lineHeight: 1.2 }}
        contentEditable suppressContentEditableWarning>
        {page.title || "제목 없음"}
      </h1>
      <PageEditor pageId={page.id} initialBlocks={page.blocks.map((b) => ({ id: b.id, type: b.type, content: b.content, position: b.position, parentId: b.parentId }))} />
    </div>
  );
}
