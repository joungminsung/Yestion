import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { db } from "@/server/db/client";
import { slackAdapter } from "@/lib/integrations/slack";
import type { IntegrationEvent, IntegrationConfig } from "@/lib/integrations/types";

const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET ?? "";

function verifySlackSignature(
  body: string,
  timestamp: string,
  signature: string
): boolean {
  if (!SLACK_SIGNING_SECRET) return false;
  const sigBasestring = `v0:${timestamp}:${body}`;
  const mySignature = `v0=${createHmac("sha256", SLACK_SIGNING_SECRET).update(sigBasestring).digest("hex")}`;
  if (mySignature.length !== signature.length) return false;
  return timingSafeEqual(Buffer.from(mySignature), Buffer.from(signature));
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const timestamp = request.headers.get("x-slack-request-timestamp") ?? "";
  const signature = request.headers.get("x-slack-signature") ?? "";

  // Verify request signature
  if (SLACK_SIGNING_SECRET && !verifySlackSignature(rawBody, timestamp, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Reject old timestamps (> 5 min)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) {
    return NextResponse.json({ error: "Request too old" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody);

  // Handle Slack URL verification challenge
  if (payload.type === "url_verification") {
    return NextResponse.json({ challenge: payload.challenge });
  }

  // Handle Events API
  if (payload.type === "event_callback") {
    const teamId = payload.team_id;

    // Find the integration by external ID (Slack team ID)
    const integration = await db.integration.findFirst({
      where: { service: "SLACK", externalId: teamId, status: "CONNECTED" },
    });

    if (!integration) {
      return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    }

    const event: IntegrationEvent = {
      service: "SLACK",
      type: payload.event?.type ?? "unknown",
      data: payload.event ?? {},
      workspaceId: integration.workspaceId,
    };

    // Process asynchronously
    slackAdapter
      .handleEvent(event, integration.config as IntegrationConfig, db)
      .catch((err) => console.error("Slack event handler error:", err));

    return NextResponse.json({ ok: true });
  }

  // Handle slash commands
  if (payload.command) {
    const teamId = payload.team_id;

    const integration = await db.integration.findFirst({
      where: { service: "SLACK", externalId: teamId, status: "CONNECTED" },
    });

    if (!integration) {
      return NextResponse.json({
        response_type: "ephemeral",
        text: "Notion Web integration not found. Please reconnect.",
      });
    }

    const event: IntegrationEvent = {
      service: "SLACK",
      type: "slash_command",
      data: {
        command: payload.command,
        text: payload.text,
        userId: payload.user_id,
        channelId: payload.channel_id,
        responseUrl: payload.response_url,
      },
      workspaceId: integration.workspaceId,
    };

    slackAdapter
      .handleEvent(event, integration.config as IntegrationConfig, db)
      .catch((err) => console.error("Slack command handler error:", err));

    return NextResponse.json({
      response_type: "ephemeral",
      text: "Processing your request...",
    });
  }

  return NextResponse.json({ ok: true });
}
