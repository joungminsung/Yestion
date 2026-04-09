import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { signPayload } from "@/server/routers/webhook";

function safeCompare(expected: string, actual: string): boolean {
  if (!expected || !actual || expected.length !== actual.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string }> }
) {
  const { path } = await params;
  const pathname = `/api/webhooks/${path}`;
  const fullUrl = `${request.nextUrl.origin}${pathname}`;
  const rawBody = await request.text();
  const signature = request.headers.get("x-webhook-signature") ?? "";

  const webhook = await db.webhook.findFirst({
    where: {
      type: "incoming",
      isEnabled: true,
      OR: [
        { url: pathname },
        { url: fullUrl },
      ],
    },
  });

  if (!webhook) {
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
  }

  const expectedSignature = `sha256=${signPayload(rawBody, webhook.secret)}`;
  if (!safeCompare(expectedSignature, signature)) {
    await db.webhookDelivery.create({
      data: {
        webhookId: webhook.id,
        event: "webhook.received",
        payload: {
          path: pathname,
          body: rawBody,
        } as import("@prisma/client").Prisma.InputJsonValue,
        status: "failed",
        error: "Invalid signature",
      },
    });

    await db.webhook.update({
      where: { id: webhook.id },
      data: {
        failureCount: { increment: 1 },
      },
    });

    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let parsedBody: unknown = rawBody;
  try {
    parsedBody = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    // Non-JSON webhooks are stored as raw text.
  }

  const eventPayload = {
    path: pathname,
    url: fullUrl,
    headers: Object.fromEntries(request.headers.entries()),
    body: parsedBody,
  };

  await db.webhookDelivery.create({
    data: {
      webhookId: webhook.id,
      event: "webhook.received",
      payload: eventPayload as import("@prisma/client").Prisma.InputJsonValue,
      status: "success",
    },
  });

  await db.webhook.update({
    where: { id: webhook.id },
    data: {
      lastDelivered: new Date(),
      totalDelivered: { increment: 1 },
    },
  });

  return NextResponse.json({ ok: true });
}
