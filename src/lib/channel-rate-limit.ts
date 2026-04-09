import { TRPCError } from "@trpc/server";

type RateLimitBucket = {
  count: number;
  expiresAt: number;
};

const buckets = new Map<string, RateLimitBucket>();

function getBucketKey(parts: Array<string | number>) {
  return parts.join(":");
}

export function enforceChannelRateLimit(input: {
  scope: string;
  workspaceId: string;
  userId: string;
  limit: number;
  windowMs: number;
  message: string;
}) {
  const now = Date.now();
  const key = getBucketKey([input.scope, input.workspaceId, input.userId]);
  const existing = buckets.get(key);

  if (!existing || existing.expiresAt <= now) {
    buckets.set(key, {
      count: 1,
      expiresAt: now + input.windowMs,
    });
    return;
  }

  if (existing.count >= input.limit) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: input.message,
    });
  }

  existing.count += 1;
  buckets.set(key, existing);
}
