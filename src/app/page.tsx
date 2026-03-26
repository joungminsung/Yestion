import { redirect } from "next/navigation";
import { getServerSession } from "@/server/auth/session";
import { db } from "@/server/db/client";

export default async function HomePage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const membership = await db.workspaceMember.findFirst({
    where: { userId: session.user.id },
    include: { workspace: true },
    orderBy: { joinedAt: "asc" },
  });

  if (membership) redirect(`/${membership.workspaceId}`);
  redirect("/login");
}
