import { cookies } from "next/headers";
import { db } from "@/server/db/client";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "@/server/auth/session";
import { PageEditor } from "@/components/editor/page-editor";
import { PageHeader } from "@/components/page/page-header";
import { SubPagesList } from "@/components/page/sub-pages-list";
import { OfflinePageCache } from "@/components/editor/offline-page-cache";
import { getEffectivePermission } from "@/lib/permissions";

export default async function PageView({ params }: { params: { workspaceId: string; pageId: string } }) {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session-token")?.value ?? "";

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

  const effectivePermission = await getEffectivePermission(db, session.user.id, page.id);
  if (effectivePermission === "none") notFound();

  const isReadOnly = effectivePermission === "view" || effectivePermission === "comment";

  const serializedBlocks = page.blocks.map((b) => ({
    id: b.id,
    type: b.type,
    content: b.content,
    position: b.position,
    parentId: b.parentId,
  }));

  return (
    <div className="page-transition-enter">
      <OfflinePageCache
        pageId={page.id}
        workspaceId={params.workspaceId}
        title={page.title}
        blocks={serializedBlocks}
      />
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
          initialBlocks={serializedBlocks}
          isLocked={page.isLocked || isReadOnly}
          sessionToken={sessionToken}
          user={{ id: session.user.id, name: session.user.name }}
        />
        {page.children.length > 0 && (
          <SubPagesList pages={page.children} workspaceId={params.workspaceId} />
        )}
      </div>
    </div>
  );
}
