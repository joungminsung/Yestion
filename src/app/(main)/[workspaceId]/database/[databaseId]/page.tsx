import { db } from "@/server/db/client";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "@/server/auth/session";
import { DatabaseView } from "@/components/database/database-view";

export default async function DatabasePage({
  params,
}: {
  params: { workspaceId: string; databaseId: string };
}) {
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

  const database = await db.database.findUnique({
    where: { id: params.databaseId },
    include: {
      page: { select: { title: true, icon: true, workspaceId: true } },
    },
  });

  if (!database || database.page.workspaceId !== params.workspaceId) notFound();

  return (
    <div className="h-full flex flex-col">
      <div className="px-12 pt-12 pb-4">
        <div className="flex items-center gap-3 mb-4">
          {database.page.icon && (
            <span className="text-4xl">{database.page.icon}</span>
          )}
          <h1
            className="text-3xl font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            {database.page.title || "제목 없음"}
          </h1>
        </div>
      </div>
      <div className="flex-1 overflow-hidden px-4">
        <DatabaseView databaseId={database.id} />
      </div>
    </div>
  );
}
