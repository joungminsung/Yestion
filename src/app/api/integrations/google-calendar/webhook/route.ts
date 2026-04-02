import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { googleCalendarAdapter } from "@/lib/integrations/google-calendar";
import type { IntegrationEvent, IntegrationConfig } from "@/lib/integrations/types";

export async function POST(request: NextRequest) {
  // Google Calendar push notifications send headers, not body
  const channelId = request.headers.get("x-goog-channel-id") ?? "";
  const resourceId = request.headers.get("x-goog-resource-id") ?? "";
  const resourceState = request.headers.get("x-goog-resource-state") ?? "";

  // Ignore sync messages (initial subscription confirmation)
  if (resourceState === "sync") {
    return NextResponse.json({ ok: true });
  }

  // Find integration by channel ID stored in config
  const integrations = await db.integration.findMany({
    where: { service: "GOOGLE_CALENDAR", status: "CONNECTED" },
  });

  const matchedIntegration = integrations.find((i: { config: unknown }) => {
    const config = i.config as Record<string, unknown>;
    return config.channelId === channelId || config.resourceId === resourceId;
  });

  if (!matchedIntegration) {
    // Stale watch — accept but don't process
    return NextResponse.json({ ok: true, processed: false });
  }

  const event: IntegrationEvent = {
    service: "GOOGLE_CALENDAR",
    type: "calendar.push",
    data: {
      channelId,
      resourceId,
      resourceState,
    },
    workspaceId: matchedIntegration.workspaceId,
  };

  // Process asynchronously
  googleCalendarAdapter
    .handleEvent(event, matchedIntegration.config as IntegrationConfig, db)
    .catch((err) => console.error("Google Calendar webhook error:", err));

  return NextResponse.json({ ok: true });
}
