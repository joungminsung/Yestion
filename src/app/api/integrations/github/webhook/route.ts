import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { db } from "@/server/db/client";
import { githubAdapter } from "@/lib/integrations/github";
import type { IntegrationEvent, IntegrationConfig } from "@/lib/integrations/types";

function verifyGitHubSignature(body: string, signature: string, secret: string): boolean {
  const expected = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  if (expected.length !== signature.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256") ?? "";
  const eventType = request.headers.get("x-github-event") ?? "";
  const deliveryId = request.headers.get("x-github-delivery") ?? "";

  // Parse the payload
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!signature) {
    return NextResponse.json({ error: "Missing webhook signature" }, { status: 401 });
  }

  // Look up connected GitHub integrations
  const integrations = await db.integration.findMany({
    where: { service: "GITHUB", status: "CONNECTED" },
  });

  // Match strictly by webhook secret
  let matchedIntegration = null;
  for (const integration of integrations) {
    if (integration.webhookSecret) {
      if (verifyGitHubSignature(rawBody, signature, integration.webhookSecret)) {
        matchedIntegration = integration;
        break;
      }
    }
  }

  if (!matchedIntegration) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  // Build the event
  const action = payload.action ? `${eventType}.${payload.action}` : eventType;
  const event: IntegrationEvent = {
    service: "GITHUB",
    type: action,
    data: payload,
    workspaceId: matchedIntegration.workspaceId,
  };

  // Process asynchronously
  githubAdapter
    .handleEvent(event, matchedIntegration.config as IntegrationConfig, db)
    .catch((err) => console.error("GitHub webhook handler error:", err));

  return NextResponse.json({ ok: true, delivery: deliveryId });
}
