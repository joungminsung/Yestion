import { notFound, redirect } from "next/navigation";
import { getServerSession } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { WorkspaceChannelView } from "@/components/channels/workspace-channel-view";

export default async function WorkspaceChannelPage({
  params,
}: {
  params: { workspaceId: string; channelId: string };
}) {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }

  const membership = await db.workspaceMember.findUnique({
    where: {
      userId_workspaceId: {
        userId: session.user.id,
        workspaceId: params.workspaceId,
      },
    },
  });

  if (!membership) {
    notFound();
  }

  return (
    <WorkspaceChannelView
      workspaceId={params.workspaceId}
      channelId={params.channelId}
    />
  );
}
