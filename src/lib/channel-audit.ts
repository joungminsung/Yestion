import type { Prisma, PrismaClient } from "@prisma/client";

export async function recordChannelAuditEvent(
  db: PrismaClient | Prisma.TransactionClient,
  input: {
    workspaceId: string;
    channelId: string;
    userId?: string | null;
    action: string;
    metadata?: Prisma.JsonObject;
  },
) {
  return db.workspaceChannelAuditLog.create({
    data: {
      workspaceId: input.workspaceId,
      channelId: input.channelId,
      userId: input.userId ?? null,
      action: input.action,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });
}
