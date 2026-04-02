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

function validateWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "0.0.0.0" ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      /^10\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^169\.254\./.test(hostname)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Deliver an event payload to a webhook endpoint.
 * Includes HMAC-SHA256 signature and timeout.
 */
export async function deliverWebhook(
  target: WebhookTarget,
  event: string,
  payload: Record<string, unknown>
): Promise<DeliveryResult> {
  if (!validateWebhookUrl(target.url)) {
    return { success: false, durationMs: 0, error: "Blocked: URL targets private/internal network" };
  }

  const body = JSON.stringify({
    id: `evt_${crypto.randomUUID()}`,
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
        ...(target.headers ?? {}),  // Custom headers first
        "Content-Type": "application/json",
        "X-Webhook-Signature": `sha256=${signature}`,
        "X-Webhook-Event": event,
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
  db: import("@prisma/client").PrismaClient,
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
        payload: payload as unknown as import("@prisma/client").Prisma.InputJsonValue,
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
