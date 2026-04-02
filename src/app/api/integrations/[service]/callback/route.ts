import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { getAdapter } from "@/lib/integrations/base-adapter";
import type { IntegrationServiceType } from "@/lib/integrations/types";

// Import adapters to trigger registration
import "@/lib/integrations/slack";
import "@/lib/integrations/github";
import "@/lib/integrations/google-calendar";
import "@/lib/integrations/email";

const SERVICE_MAP: Record<string, IntegrationServiceType> = {
  slack: "SLACK",
  github: "GITHUB",
  "google-calendar": "GOOGLE_CALENDAR",
  email: "EMAIL",
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ service: string }> }
) {
  const { service: serviceSlug } = await params;
  const serviceType = SERVICE_MAP[serviceSlug];
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

  // Decode workspace ID from state
  let workspaceId: string;
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64").toString());
    workspaceId = decoded.workspaceId;
  } catch {
    return NextResponse.json({ error: "Invalid state parameter" }, { status: 400 });
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
    const redirectUri = `${baseUrl}/api/integrations/${serviceSlug}/callback`;

    const tokens = await adapter.exchangeCode(code, redirectUri);

    await db.integration.update({
      where: { id: integration.id },
      data: {
        status: "CONNECTED",
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiry: tokens.expiresAt,
        externalId: tokens.externalId,
        externalName: tokens.externalName,
      },
    });

    // Redirect back to settings page
    return NextResponse.redirect(
      new URL(`/${workspaceId}/settings?tab=integrations&connected=${serviceSlug}`, request.url)
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
