import { NextRequest, NextResponse } from "next/server";
import { randomBytes, randomUUID } from "crypto";
import { db } from "@/server/db/client";
import { getAdapter } from "@/lib/integrations/base-adapter";
import { encryptToken, verifyOAuthState } from "@/lib/integrations/crypto";
import { watchCalendar } from "@/lib/integrations/google-calendar";
import { getIntegrationServiceSlug, parseIntegrationServiceSlug } from "@/lib/integrations/service-slug";

// Import adapters to trigger registration
import "@/lib/integrations/slack";
import "@/lib/integrations/github";
import "@/lib/integrations/google-calendar";
import "@/lib/integrations/email";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ service: string }> }
) {
  const { service: serviceSlug } = await params;
  const serviceType = parseIntegrationServiceSlug(serviceSlug);
  if (!serviceType) {
    return NextResponse.json({ error: "Unknown service" }, { status: 400 });
  }

  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // workspaceId encoded in state
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/settings?error=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (!code || !state) {
    return NextResponse.json(
      { error: "Missing code or state parameter" },
      { status: 400 }
    );
  }

  // Verify HMAC-signed state and decode workspace ID
  let workspaceId: string;
  try {
    const verified = verifyOAuthState(state);
    workspaceId = verified.workspaceId;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid state parameter";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // Find the pending integration
  const integration = await db.integration.findUnique({
    where: {
      workspaceId_service: { workspaceId, service: serviceType },
    },
  });

  if (!integration) {
    return NextResponse.json({ error: "Integration not found" }, { status: 404 });
  }

  try {
    const adapter = getAdapter(serviceType);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const redirectUri = `${baseUrl}/api/integrations/${getIntegrationServiceSlug(serviceType)}/callback`;

    const tokens = await adapter.exchangeCode(code, redirectUri);
    let webhookSecret: string | null = integration.webhookSecret;
    let nextConfig = (integration.config as Record<string, unknown>) ?? {};

    if (serviceType === "GOOGLE_CALENDAR") {
      webhookSecret ??= randomBytes(32).toString("hex");

      try {
        const channelId = randomUUID();
        const watch = await watchCalendar(
          tokens.accessToken,
          "primary",
          `${baseUrl}/api/integrations/google-calendar/webhook`,
          channelId,
          webhookSecret
        );

        nextConfig = {
          ...nextConfig,
          calendarId: "primary",
          syncCalendarUpdates: true,
          channelId,
          resourceId: watch.resourceId,
          watchExpiration: watch.expiration,
        };
      } catch (watchError) {
        console.error("Failed to register Google Calendar watch:", watchError);
      }
    }

    if (serviceType === "GITHUB") {
      webhookSecret ??= randomBytes(32).toString("hex");
    }

    await db.integration.update({
      where: { id: integration.id },
      data: {
        status: "CONNECTED",
        accessToken: encryptToken(tokens.accessToken),
        refreshToken: tokens.refreshToken ? encryptToken(tokens.refreshToken) : undefined,
        tokenExpiry: tokens.expiresAt,
        externalId: tokens.externalId,
        externalName: tokens.externalName,
        webhookSecret,
        config: nextConfig as import("@prisma/client").Prisma.InputJsonValue,
      },
    });

    // Redirect back to settings page
    return NextResponse.redirect(
      new URL(`/${workspaceId}/settings?tab=integrations&connected=${getIntegrationServiceSlug(serviceType)}`, request.url)
    );
  } catch (err) {
    console.error(`OAuth callback error for ${serviceSlug}:`, err);

    await db.integration.update({
      where: { id: integration.id },
      data: { status: "ERROR" },
    });

    return NextResponse.redirect(
      new URL(
        `/${workspaceId}/settings?tab=integrations&error=${encodeURIComponent("Failed to connect")}`,
        request.url
      )
    );
  }
}
