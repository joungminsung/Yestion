import { db } from "@/server/db/client";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "@/server/auth/session";
import { PageEditor } from "@/components/editor/page-editor";
import { PageHeader } from "@/components/page/page-header";
import { SubPagesList } from "@/components/page/sub-pages-list";

export default async function PageView({ params }: { params: { workspaceId: string; pageId: string } }) {
  const session = await getServerSession();
  if (!session) redirect("/login");

  // Verify workspace membership
  const membership = await db.workspaceMember.findUnique({
    where: {
      userId_workspaceId: {
        userId: session.user.id,
        workspaceId: params.workspaceId,
      },
    },
  });
  if (!membership) notFound();

  const page = await db.page.findUnique({
    where: { id: params.pageId },
    include: {
      blocks: {
        where: { parentId: null },
        orderBy: { position: "asc" },
        include: { children: { orderBy: { position: "asc" } } },
      },
      children: {
        where: { isDeleted: false },
        orderBy: { position: "asc" },
        select: { id: true, title: true, icon: true },
      },
    },
  });

  if (!page || page.isDeleted || page.workspaceId !== params.workspaceId) notFound();

  return (
    <div>
      <PageHeader page={{ id: page.id, title: page.title, icon: page.icon, cover: page.cover }} />
      <div
        className="mx-auto"
        style={{
          maxWidth: page.isFullWidth ? "var(--page-full-width)" : "var(--page-max-width)",
          paddingLeft: "var(--page-padding-x)",
          paddingRight: "var(--page-padding-x)",
          paddingBottom: "32px",
        }}
      >
        <PageEditor
          pageId={page.id}
          initialBlocks={page.blocks.map((b) => ({
            id: b.id,
            type: b.type,
            content: b.content,
            position: b.position,
            parentId: b.parentId,
          }))}
          isLocked={page.isLocked}
        />
        {page.children.length > 0 && (
          <SubPagesList pages={page.children} workspaceId={params.workspaceId} />
        )}
      </div>
    </div>
  );
}
