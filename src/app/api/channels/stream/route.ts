import { NextRequest } from "next/server";
import { workspaceChannelEmitter } from "@/lib/channel-emitter";
import { getServerSession } from "@/server/auth/session";
import { db } from "@/server/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const channelId = req.nextUrl.searchParams.get("channelId");
  if (!channelId) {
    return new Response("channelId required", { status: 400 });
  }

  const channel = await db.workspaceChannel.findUnique({
    where: { id: channelId },
    select: {
      id: true,
      workspaceId: true,
      teamspaceId: true,
    },
  });

  if (!channel) {
    return new Response("Channel not found", { status: 404 });
  }

  const workspaceMembership = await db.workspaceMember.findUnique({
    where: {
      userId_workspaceId: {
        userId: session.user.id,
        workspaceId: channel.workspaceId,
      },
    },
  });

  if (!workspaceMembership) {
    return new Response("Forbidden", { status: 403 });
  }

  if (channel.teamspaceId) {
    const teamspaceMembership = await db.teamspaceMember.findUnique({
      where: {
        teamspaceId_userId: {
          teamspaceId: channel.teamspaceId,
          userId: session.user.id,
        },
      },
    });

    if (!teamspaceMembership) {
      return new Response("Forbidden", { status: 403 });
    }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(": connected\n\n"));

      const unsubscribe = workspaceChannelEmitter.subscribe(channelId, (event) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      });

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, 15_000);

      req.signal.addEventListener("abort", () => {
        unsubscribe();
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
