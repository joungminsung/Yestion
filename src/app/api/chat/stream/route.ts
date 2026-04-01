import { NextRequest } from "next/server";
import { getServerSession } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { chatEmitter } from "@/lib/chat-emitter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const pageId = req.nextUrl.searchParams.get("pageId");
  if (!pageId) {
    return new Response("pageId required", { status: 400 });
  }

  // Verify workspace access
  const page = await db.page.findUnique({ where: { id: pageId }, select: { workspaceId: true } });
  if (!page) return new Response("Page not found", { status: 404 });

  const member = await db.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: session.user.id, workspaceId: page.workspaceId } },
  });
  if (!member) return new Response("Forbidden", { status: 403 });

  // SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Send initial heartbeat
      controller.enqueue(encoder.encode(": connected\n\n"));

      // Subscribe to new messages
      const unsubscribe = chatEmitter.subscribe(pageId, (event) => {
        const data = JSON.stringify(event);
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      });

      // Heartbeat every 15s to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, 15000);

      // Cleanup on close
      req.signal.addEventListener("abort", () => {
        unsubscribe();
        clearInterval(heartbeat);
        try { controller.close(); } catch { /* already closed */ }
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
