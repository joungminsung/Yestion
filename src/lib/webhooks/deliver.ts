import { signPayload } from "@/server/routers/webhook";

type WebhookTarget = {
  id: string;
  url: string;
  secret: string;
  headers?: Record<string, string> | null;
};

type DeliveryResult = {
  success: boolean;
  statusCode?: number;
  durationMs: number;
  error?: string;
};

/**
 * Deliver an event payload to a webhook endpoint.
 * Includes HMAC-SHA256 signature and timeout.
 */
export async function deliverWebhook(
  target: WebhookTarget,
  event: string,
  payload: Record<string, unknown>
): Promise<DeliveryResult> {
  const body = JSON.stringify({
    id: `evt_${Date.now()}`,
    type: event,
    timestamp: new Date().toISOString(),
    data: payload,
  });

  const signature = signPayload(body, target.secret);
  const start = Date.now();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(target.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": `sha256=${signature}`,
        "X-Webhook-Event": event,
        ...(target.headers ?? {}),
      },
      body,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    return {
      success: response.ok,
      statusCode: response.status,
      durationMs: Date.now() - start,
      error: response.ok ? undefined : `HTTP ${response.status}`,
    };
  } catch (err) {
    clearTimeout(timeout);
    return {
      success: false,
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : "Request failed",
    };
  }
}

/**
 * Dispatch an event to all matching outgoing webhooks for a workspace.
 */
export async function dispatchWebhookEvent(
  db: any, // PrismaClient
  workspaceId: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  const webhooks = await db.webhook.findMany({
    where: {
      workspaceId,
      type: "outgoing",
      isEnabled: true,
      events: { has: event },
    },
  });

  for (const webhook of webhooks) {
    const result = await deliverWebhook(
      { id: webhook.id, url: webhook.url!, secret: webhook.secret, headers: webhook.headers as Record<string, string> | null },
      event,
      payload
    );

    // Log delivery
    await db.webhookDelivery.create({
      data: {
        webhookId: webhook.id,
        event,
        payload,
        responseStatus: result.statusCode,
        durationMs: result.durationMs,
        status: result.success ? "success" : "failed",
        error: result.error,
      },
    });

    // Update webhook stats
    await db.webhook.update({
      where: { id: webhook.id },
      data: {
        lastDelivered: new Date(),
        totalDelivered: { increment: 1 },
        failureCount: result.success ? 0 : { increment: 1 },
      },
    });
  }
}
