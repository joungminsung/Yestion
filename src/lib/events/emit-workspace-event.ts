import { dispatchWebhookEvent } from "@/lib/webhooks/deliver";

export async function emitWorkspaceEvent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- accepts both PrismaClient and transaction clients
  db: any,
  workspaceId: string,
  eventType: string,
  eventData: Record<string, unknown>,
  userId: string
): Promise<void> {
  void userId;

  const webhookResult = await Promise.allSettled([
    dispatchWebhookEvent(db, workspaceId, eventType, eventData),
  ]);

  if (webhookResult[0]?.status === "rejected") {
    console.error(`Webhook dispatch failed for ${eventType}:`, webhookResult[0].reason);
  }
}
