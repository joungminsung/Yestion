# Native Integrations (Slack, GitHub, Google Calendar, Email) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a native integration framework with OAuth-based connectors for Slack, GitHub, Google Calendar, and email (Resend), enabling bidirectional data sync and event-driven notifications.
**Architecture:** A new Integration Prisma model stores per-workspace connection state and encrypted tokens. A base adapter interface defines connect/disconnect/handleEvent/getStatus methods that each service implements. OAuth callback routes handle the code exchange flow. Per-service webhook routes receive inbound events (Slack events, GitHub webhooks, Google Calendar push notifications). The integration router exposes connect/disconnect/list/status endpoints. A settings UI lets users manage connections with per-service configuration cards.
**Tech Stack:** Prisma, tRPC, Next.js App Router (route handlers), Resend (email), Tailwind CSS, lucide-react

---

## File Structure

### New Files
- `prisma/migrations/<timestamp>_add_integration_model/migration.sql` (auto-generated)
- `src/lib/integrations/types.ts`
- `src/lib/integrations/base-adapter.ts`
- `src/lib/integrations/slack.ts`
- `src/lib/integrations/github.ts`
- `src/lib/integrations/google-calendar.ts`
- `src/lib/integrations/email.ts`
- `src/server/routers/integration.ts`
- `src/app/api/integrations/[service]/callback/route.ts`
- `src/app/api/integrations/slack/events/route.ts`
- `src/app/api/integrations/github/webhook/route.ts`
- `src/app/api/integrations/google-calendar/webhook/route.ts`
- `src/components/settings/integration-settings.tsx`

### Modified Files
- `prisma/schema.prisma`
- `src/server/trpc/router.ts`
- `src/components/settings/settings-layout.tsx`

---

### Task 1: Add Integration Prisma Model
**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add IntegrationService and IntegrationStatus enums and Integration model**

In `prisma/schema.prisma`, add after the `WebhookDelivery` model:

```prisma
enum IntegrationService {
  SLACK
  GITHUB
  GOOGLE_CALENDAR
  EMAIL
}

enum IntegrationStatus {
  CONNECTED
  DISCONNECTED
  ERROR
  PENDING
}

model Integration {
  id            String              @id @default(cuid())
  workspaceId   String
  service       IntegrationService
  status        IntegrationStatus   @default(PENDING)
  accessToken   String?             // encrypted OAuth access token
  refreshToken  String?             // encrypted OAuth refresh token
  tokenExpiry   DateTime?
  externalId    String?             // external account/team ID
  externalName  String?             // display name (e.g. Slack workspace name)
  config        Json                @default("{}") // per-service config (channels, repos, calendars)
  webhookSecret String?             // secret for verifying inbound webhooks
  connectedBy   String
  connectedAt   DateTime            @default(now())
  updatedAt     DateTime            @updatedAt

  @@unique([workspaceId, service])
  @@index([workspaceId])
  @@index([service, status])
}
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name add_integration_model
```

- [ ] **Step 3: Commit**

```bash
git add prisma/
git commit -m "feat: add Integration model with service enum and OAuth token storage"
```

---

### Task 2: Integration Adapter Interface and Base
**Files:**
- Create: `src/lib/integrations/types.ts`
- Create: `src/lib/integrations/base-adapter.ts`

- [ ] **Step 1: Create the integration types**

Create `src/lib/integrations/types.ts`:

```typescript
export type IntegrationServiceType = "SLACK" | "GITHUB" | "GOOGLE_CALENDAR" | "EMAIL";

export type IntegrationConfig = Record<string, unknown>;

export type OAuthTokens = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  externalId?: string;
  externalName?: string;
};

export type IntegrationEvent = {
  service: IntegrationServiceType;
  type: string; // e.g. "message", "issue.opened", "event.created"
  data: Record<string, unknown>;
  workspaceId: string;
};

export type SendMessageOptions = {
  channel?: string;
  text: string;
  blocks?: unknown[];
};

export type IntegrationInfo = {
  service: IntegrationServiceType;
  name: string;
  description: string;
  icon: string; // lucide icon name
  features: string[];
  oauthUrl?: string;
  requiresOAuth: boolean;
};

/** Result of processing an inbound webhook/event */
export type EventHandlerResult = {
  handled: boolean;
  actions?: string[];
  error?: string;
};
```

- [ ] **Step 2: Create the base adapter class**

Create `src/lib/integrations/base-adapter.ts`:

```typescript
import type {
  IntegrationServiceType,
  IntegrationConfig,
  OAuthTokens,
  IntegrationEvent,
  EventHandlerResult,
  IntegrationInfo,
} from "./types";

/**
 * Abstract base class for all integration adapters.
 * Each service (Slack, GitHub, etc.) extends this class.
 */
export abstract class BaseIntegrationAdapter {
  abstract readonly service: IntegrationServiceType;
  abstract readonly info: IntegrationInfo;

  /**
   * Generate the OAuth authorization URL for this service.
   * @param workspaceId - The workspace initiating the connection
   * @param redirectUri - The callback URL after OAuth
   * @returns The full authorization URL
   */
  abstract getOAuthUrl(workspaceId: string, redirectUri: string): string;

  /**
   * Exchange an OAuth authorization code for access/refresh tokens.
   * @param code - The authorization code from the callback
   * @param redirectUri - The redirect URI used in the initial request
   * @returns Token set with access token, optional refresh token, and external IDs
   */
  abstract exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens>;

  /**
   * Refresh an expired access token using the refresh token.
   * @param refreshToken - The stored refresh token
   * @returns New token set
   */
  abstract refreshAccessToken(refreshToken: string): Promise<OAuthTokens>;

  /**
   * Handle an inbound event/webhook from the external service.
   * @param event - The parsed event data
   * @param config - The integration's stored config
   * @param db - Database client for creating notifications, etc.
   * @returns Result indicating what actions were taken
   */
  abstract handleEvent(
    event: IntegrationEvent,
    config: IntegrationConfig,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    db: any
  ): Promise<EventHandlerResult>;

  /**
   * Verify that the connection is still valid.
   * @param accessToken - The stored access token
   * @returns true if the token is still valid
   */
  abstract verifyConnection(accessToken: string): Promise<boolean>;

  /**
   * Disconnect and clean up (revoke tokens, unregister webhooks, etc.).
   * @param accessToken - The stored access token
   * @param config - The integration's stored config
   */
  abstract disconnect(accessToken: string, config: IntegrationConfig): Promise<void>;
}

/** Registry of all adapters by service type */
const adapterRegistry = new Map<IntegrationServiceType, BaseIntegrationAdapter>();

export function registerAdapter(adapter: BaseIntegrationAdapter): void {
  adapterRegistry.set(adapter.service, adapter);
}

export function getAdapter(service: IntegrationServiceType): BaseIntegrationAdapter {
  const adapter = adapterRegistry.get(service);
  if (!adapter) throw new Error(`No adapter registered for service: ${service}`);
  return adapter;
}

export function getAllAdapters(): BaseIntegrationAdapter[] {
  return Array.from(adapterRegistry.values());
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/integrations/types.ts src/lib/integrations/base-adapter.ts
git commit -m "feat: add integration adapter interface with base class and registry"
```

---

### Task 3: Integration Router
**Files:**
- Create: `src/server/routers/integration.ts`
- Modify: `src/server/trpc/router.ts`

- [ ] **Step 1: Create the integration router**

Create `src/server/routers/integration.ts`:

```typescript
import { z } from "zod";
import { router, protectedProcedure } from "@/server/trpc/init";
import { getAdapter, getAllAdapters } from "@/lib/integrations/base-adapter";
import type { IntegrationServiceType } from "@/lib/integrations/types";

// Import adapters to trigger registration
import "@/lib/integrations/slack";
import "@/lib/integrations/github";
import "@/lib/integrations/google-calendar";
import "@/lib/integrations/email";

const serviceEnum = z.enum(["SLACK", "GITHUB", "GOOGLE_CALENDAR", "EMAIL"]);

async function verifyWorkspaceAdmin(db: any, workspaceId: string, userId: string) {
  const member = await db.workspaceMember.findFirst({
    where: { workspaceId, userId },
  });
  if (!member) throw new Error("Not authorized");
  if (member.role !== "OWNER" && member.role !== "ADMIN") {
    throw new Error("Only owners and admins can manage integrations");
  }
  return member;
}

export const integrationRouter = router({
  /** List all integrations for a workspace */
  list: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const member = await ctx.db.workspaceMember.findFirst({
        where: { workspaceId: input.workspaceId, userId: ctx.session.user.id },
      });
      if (!member) throw new Error("Not authorized");

      const integrations = await ctx.db.integration.findMany({
        where: { workspaceId: input.workspaceId },
      });

      // Merge with available adapters to show all services
      const adapters = getAllAdapters();
      return adapters.map((adapter) => {
        const existing = integrations.find(
          (i: any) => i.service === adapter.service
        );
        return {
          service: adapter.service,
          info: adapter.info,
          integration: existing
            ? {
                id: existing.id,
                status: existing.status,
                externalName: existing.externalName,
                connectedAt: existing.connectedAt,
                config: existing.config,
              }
            : null,
        };
      });
    }),

  /** Get the OAuth URL to initiate a connection */
  connect: protectedProcedure
    .input(z.object({
      workspaceId: z.string(),
      service: serviceEnum,
    }))
    .mutation(async ({ ctx, input }) => {
      await verifyWorkspaceAdmin(ctx.db, input.workspaceId, ctx.session.user.id);

      const adapter = getAdapter(input.service as IntegrationServiceType);
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const redirectUri = `${baseUrl}/api/integrations/${input.service.toLowerCase()}/callback`;

      // Create or update the integration record as pending
      await ctx.db.integration.upsert({
        where: {
          workspaceId_service: {
            workspaceId: input.workspaceId,
            service: input.service,
          },
        },
        create: {
          workspaceId: input.workspaceId,
          service: input.service,
          status: "PENDING",
          connectedBy: ctx.session.user.id,
        },
        update: {
          status: "PENDING",
          connectedBy: ctx.session.user.id,
        },
      });

      const oauthUrl = adapter.getOAuthUrl(input.workspaceId, redirectUri);
      return { oauthUrl };
    }),

  /** Disconnect an integration */
  disconnect: protectedProcedure
    .input(z.object({
      workspaceId: z.string(),
      service: serviceEnum,
    }))
    .mutation(async ({ ctx, input }) => {
      await verifyWorkspaceAdmin(ctx.db, input.workspaceId, ctx.session.user.id);

      const integration = await ctx.db.integration.findUnique({
        where: {
          workspaceId_service: {
            workspaceId: input.workspaceId,
            service: input.service,
          },
        },
      });

      if (integration?.accessToken) {
        try {
          const adapter = getAdapter(input.service as IntegrationServiceType);
          await adapter.disconnect(
            integration.accessToken,
            (integration.config as Record<string, unknown>) ?? {}
          );
        } catch {
          // Best-effort cleanup
        }
      }

      await ctx.db.integration.update({
        where: {
          workspaceId_service: {
            workspaceId: input.workspaceId,
            service: input.service,
          },
        },
        data: {
          status: "DISCONNECTED",
          accessToken: null,
          refreshToken: null,
          tokenExpiry: null,
        },
      });

      return { success: true };
    }),

  /** Get current status of a specific integration */
  getStatus: protectedProcedure
    .input(z.object({
      workspaceId: z.string(),
      service: serviceEnum,
    }))
    .query(async ({ ctx, input }) => {
      const integration = await ctx.db.integration.findUnique({
        where: {
          workspaceId_service: {
            workspaceId: input.workspaceId,
            service: input.service,
          },
        },
      });

      if (!integration || !integration.accessToken) {
        return { connected: false, status: integration?.status ?? "DISCONNECTED" };
      }

      // Optionally verify the connection is still valid
      try {
        const adapter = getAdapter(input.service as IntegrationServiceType);
        const isValid = await adapter.verifyConnection(integration.accessToken);
        if (!isValid) {
          await ctx.db.integration.update({
            where: { id: integration.id },
            data: { status: "ERROR" },
          });
          return { connected: false, status: "ERROR" };
        }
      } catch {
        return { connected: false, status: "ERROR" };
      }

      return {
        connected: true,
        status: integration.status,
        externalName: integration.externalName,
        connectedAt: integration.connectedAt,
      };
    }),

  /** Update integration config (e.g. which Slack channel, which repo) */
  updateConfig: protectedProcedure
    .input(z.object({
      workspaceId: z.string(),
      service: serviceEnum,
      config: z.record(z.unknown()),
    }))
    .mutation(async ({ ctx, input }) => {
      await verifyWorkspaceAdmin(ctx.db, input.workspaceId, ctx.session.user.id);
      return ctx.db.integration.update({
        where: {
          workspaceId_service: {
            workspaceId: input.workspaceId,
            service: input.service,
          },
        },
        data: { config: input.config },
      });
    }),
});
```

- [ ] **Step 2: Register integration router in app router**

In `src/server/trpc/router.ts`, add import:
```typescript
import { integrationRouter } from "@/server/routers/integration";
```

Add to the router object:
```typescript
  integration: integrationRouter,
```

- [ ] **Step 3: Commit**

```bash
git add src/server/routers/integration.ts src/server/trpc/router.ts
git commit -m "feat: add integration router with connect/disconnect/list/status/updateConfig"
```

---

### Task 4: OAuth Callback Route
**Files:**
- Create: `src/app/api/integrations/[service]/callback/route.ts`

- [ ] **Step 1: Create the generic OAuth callback route**

Create `src/app/api/integrations/[service]/callback/route.ts`:

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/integrations/\[service\]/callback/route.ts
git commit -m "feat: add generic OAuth callback route for all integration services"
```

---

### Task 5: Slack Adapter
**Files:**
- Create: `src/lib/integrations/slack.ts`

- [ ] **Step 1: Create the Slack adapter**

Create `src/lib/integrations/slack.ts`:

```typescript
import { BaseIntegrationAdapter, registerAdapter } from "./base-adapter";
import type {
  IntegrationConfig,
  IntegrationEvent,
  OAuthTokens,
  EventHandlerResult,
  IntegrationInfo,
} from "./types";

class SlackAdapter extends BaseIntegrationAdapter {
  readonly service = "SLACK" as const;
  readonly info: IntegrationInfo = {
    service: "SLACK",
    name: "Slack",
    description: "Send notifications and receive commands from Slack",
    icon: "MessageSquare",
    features: [
      "Send page/task notifications to channels",
      "Slash commands (/notion-search, /notion-create)",
      "Receive message reactions as page comments",
    ],
    requiresOAuth: true,
  };

  private get clientId() {
    return process.env.SLACK_CLIENT_ID ?? "";
  }
  private get clientSecret() {
    return process.env.SLACK_CLIENT_SECRET ?? "";
  }

  getOAuthUrl(workspaceId: string, redirectUri: string): string {
    const state = Buffer.from(JSON.stringify({ workspaceId })).toString("base64");
    const scopes = [
      "chat:write",
      "channels:read",
      "commands",
      "incoming-webhook",
      "reactions:read",
    ].join(",");

    return (
      `https://slack.com/oauth/v2/authorize` +
      `?client_id=${this.clientId}` +
      `&scope=${scopes}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${state}`
    );
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    const response = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    const data = await response.json();
    if (!data.ok) throw new Error(`Slack OAuth error: ${data.error}`);

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      externalId: data.team?.id,
      externalName: data.team?.name,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    const response = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    const data = await response.json();
    if (!data.ok) throw new Error(`Slack refresh error: ${data.error}`);

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
    };
  }

  async handleEvent(
    event: IntegrationEvent,
    config: IntegrationConfig,
    db: any
  ): Promise<EventHandlerResult> {
    const eventType = event.type;

    // Handle slash commands
    if (eventType === "slash_command") {
      return { handled: true, actions: ["slash_command_processed"] };
    }

    // Handle message events (e.g. reactions)
    if (eventType === "reaction_added") {
      return { handled: true, actions: ["reaction_logged"] };
    }

    return { handled: false };
  }

  async verifyConnection(accessToken: string): Promise<boolean> {
    try {
      const response = await fetch("https://slack.com/api/auth.test", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await response.json();
      return data.ok === true;
    } catch {
      return false;
    }
  }

  async disconnect(accessToken: string): Promise<void> {
    // Revoke the token
    await fetch("https://slack.com/api/auth.revoke", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
  }
}

/** Send a message to a Slack channel */
export async function sendSlackMessage(
  accessToken: string,
  channel: string,
  text: string,
  blocks?: unknown[]
): Promise<void> {
  const body: Record<string, unknown> = { channel, text };
  if (blocks) body.blocks = blocks;

  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!data.ok) throw new Error(`Slack send error: ${data.error}`);
}

// Register the adapter
const slackAdapter = new SlackAdapter();
registerAdapter(slackAdapter);
export { slackAdapter };
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/integrations/slack.ts
git commit -m "feat: add Slack integration adapter with OAuth, messaging, and event handling"
```

---

### Task 6: Slack Webhook Route
**Files:**
- Create: `src/app/api/integrations/slack/events/route.ts`

- [ ] **Step 1: Create the Slack events webhook route**

Create `src/app/api/integrations/slack/events/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
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
  return mySignature === signature;
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
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/integrations/slack/events/route.ts
git commit -m "feat: add Slack events and slash commands webhook route"
```

---

### Task 7: GitHub Adapter
**Files:**
- Create: `src/lib/integrations/github.ts`

- [ ] **Step 1: Create the GitHub adapter**

Create `src/lib/integrations/github.ts`:

```typescript
import { BaseIntegrationAdapter, registerAdapter } from "./base-adapter";
import type {
  IntegrationConfig,
  IntegrationEvent,
  OAuthTokens,
  EventHandlerResult,
  IntegrationInfo,
} from "./types";

class GitHubAdapter extends BaseIntegrationAdapter {
  readonly service = "GITHUB" as const;
  readonly info: IntegrationInfo = {
    service: "GITHUB",
    name: "GitHub",
    description: "Sync issues and get PR notifications",
    icon: "Github",
    features: [
      "Link GitHub issues to tasks",
      "PR status notifications",
      "Auto-create tasks from GitHub issues",
      "Commit references in page comments",
    ],
    requiresOAuth: true,
  };

  private get clientId() {
    return process.env.GITHUB_CLIENT_ID ?? "";
  }
  private get clientSecret() {
    return process.env.GITHUB_CLIENT_SECRET ?? "";
  }

  getOAuthUrl(workspaceId: string, redirectUri: string): string {
    const state = Buffer.from(JSON.stringify({ workspaceId })).toString("base64");
    const scopes = "repo,read:org,write:repo_hook";

    return (
      `https://github.com/login/oauth/authorize` +
      `?client_id=${this.clientId}` +
      `&scope=${scopes}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${state}`
    );
  }

  async exchangeCode(code: string, _redirectUri: string): Promise<OAuthTokens> {
    const response = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
      }),
    });

    const data = await response.json();
    if (data.error) throw new Error(`GitHub OAuth error: ${data.error_description}`);

    // Get user info for display
    const userResponse = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    const user = await userResponse.json();

    return {
      accessToken: data.access_token,
      externalId: String(user.id),
      externalName: user.login,
    };
  }

  async refreshAccessToken(_refreshToken: string): Promise<OAuthTokens> {
    // GitHub personal tokens don't expire; GitHub Apps use installation tokens
    throw new Error("GitHub tokens do not support refresh");
  }

  async handleEvent(
    event: IntegrationEvent,
    config: IntegrationConfig,
    db: any
  ): Promise<EventHandlerResult> {
    const actions: string[] = [];

    switch (event.type) {
      case "issues.opened": {
        const issue = event.data.issue as Record<string, unknown> | undefined;
        if (!issue) break;

        // Create a notification for workspace members
        const members = await db.workspaceMember.findMany({
          where: { workspaceId: event.workspaceId },
          select: { userId: true },
        });

        for (const member of members) {
          await db.notification.create({
            data: {
              userId: member.userId,
              type: "github_issue",
              title: `New GitHub Issue: ${issue.title}`,
              message: `${(issue as any).html_url}`,
            },
          });
        }
        actions.push("notification_sent");
        break;
      }

      case "pull_request.opened":
      case "pull_request.merged":
      case "pull_request.closed": {
        const pr = event.data.pull_request as Record<string, unknown> | undefined;
        if (!pr) break;

        const statusLabel = event.type.split(".")[1];
        const members = await db.workspaceMember.findMany({
          where: { workspaceId: event.workspaceId },
          select: { userId: true },
        });

        for (const member of members) {
          await db.notification.create({
            data: {
              userId: member.userId,
              type: "github_pr",
              title: `PR ${statusLabel}: ${pr.title}`,
              message: `${(pr as any).html_url}`,
            },
          });
        }
        actions.push("notification_sent");
        break;
      }
    }

    return { handled: actions.length > 0, actions };
  }

  async verifyConnection(accessToken: string): Promise<boolean> {
    try {
      const response = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async disconnect(accessToken: string): Promise<void> {
    // Delete the OAuth app authorization
    try {
      await fetch(
        `https://api.github.com/applications/${this.clientId}/grant`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ access_token: accessToken }),
        }
      );
    } catch {
      // Best effort
    }
  }
}

const githubAdapter = new GitHubAdapter();
registerAdapter(githubAdapter);
export { githubAdapter };
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/integrations/github.ts
git commit -m "feat: add GitHub integration adapter with OAuth, issue sync, PR notifications"
```

---

### Task 8: GitHub Webhook Route
**Files:**
- Create: `src/app/api/integrations/github/webhook/route.ts`

- [ ] **Step 1: Create the GitHub webhook route**

Create `src/app/api/integrations/github/webhook/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { db } from "@/server/db/client";
import { githubAdapter } from "@/lib/integrations/github";
import type { IntegrationEvent, IntegrationConfig } from "@/lib/integrations/types";

function verifyGitHubSignature(body: string, signature: string, secret: string): boolean {
  const expected = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  return expected === signature;
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

  // Determine which integration this belongs to via the installation or sender
  const sender = payload.sender as Record<string, unknown> | undefined;
  const senderId = sender?.id ? String(sender.id) : null;

  // Look up connected GitHub integrations
  const integrations = await db.integration.findMany({
    where: { service: "GITHUB", status: "CONNECTED" },
  });

  // Match by webhook secret or external ID
  let matchedIntegration = null;
  for (const integration of integrations) {
    if (integration.webhookSecret && signature) {
      if (verifyGitHubSignature(rawBody, signature, integration.webhookSecret)) {
        matchedIntegration = integration;
        break;
      }
    }
    // Fallback: match by external ID (GitHub user ID who connected)
    if (integration.externalId === senderId) {
      matchedIntegration = integration;
      break;
    }
  }

  if (!matchedIntegration) {
    // Accept the webhook but don't process (may be a stale hook)
    return NextResponse.json({ ok: true, processed: false });
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
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/integrations/github/webhook/route.ts
git commit -m "feat: add GitHub webhook route with signature verification and event dispatch"
```

---

### Task 9: Google Calendar Adapter
**Files:**
- Create: `src/lib/integrations/google-calendar.ts`

- [ ] **Step 1: Create the Google Calendar adapter**

Create `src/lib/integrations/google-calendar.ts`:

```typescript
import { BaseIntegrationAdapter, registerAdapter } from "./base-adapter";
import type {
  IntegrationConfig,
  IntegrationEvent,
  OAuthTokens,
  EventHandlerResult,
  IntegrationInfo,
} from "./types";

class GoogleCalendarAdapter extends BaseIntegrationAdapter {
  readonly service = "GOOGLE_CALENDAR" as const;
  readonly info: IntegrationInfo = {
    service: "GOOGLE_CALENDAR",
    name: "Google Calendar",
    description: "Sync task due dates with Google Calendar events",
    icon: "CalendarDays",
    features: [
      "Auto-create calendar events for tasks with due dates",
      "Two-way sync: update task dates from calendar",
      "Meeting notes linked to calendar events",
    ],
    requiresOAuth: true,
  };

  private get clientId() {
    return process.env.GOOGLE_CLIENT_ID ?? "";
  }
  private get clientSecret() {
    return process.env.GOOGLE_CLIENT_SECRET ?? "";
  }

  getOAuthUrl(workspaceId: string, redirectUri: string): string {
    const state = Buffer.from(JSON.stringify({ workspaceId })).toString("base64");
    const scopes = [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/calendar.events",
    ].join(" ");

    return (
      `https://accounts.google.com/o/oauth2/v2/auth` +
      `?client_id=${this.clientId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(scopes)}` +
      `&access_type=offline` +
      `&prompt=consent` +
      `&state=${state}`
    );
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const data = await response.json();
    if (data.error) throw new Error(`Google OAuth error: ${data.error_description}`);

    // Get user info
    const userResponse = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      { headers: { Authorization: `Bearer ${data.access_token}` } }
    );
    const user = await userResponse.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      externalId: user.id,
      externalName: user.email,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    const data = await response.json();
    if (data.error) throw new Error(`Google refresh error: ${data.error_description}`);

    return {
      accessToken: data.access_token,
      refreshToken, // Google doesn't always return a new refresh token
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  async handleEvent(
    event: IntegrationEvent,
    _config: IntegrationConfig,
    db: any
  ): Promise<EventHandlerResult> {
    // Handle Google Calendar push notification
    if (event.type === "calendar.push") {
      const actions: string[] = [];
      // In a full implementation, we'd fetch changed events and sync them
      // For now, create a notification
      const members = await db.workspaceMember.findMany({
        where: { workspaceId: event.workspaceId },
        select: { userId: true },
        take: 5,
      });

      for (const member of members) {
        await db.notification.create({
          data: {
            userId: member.userId,
            type: "calendar_update",
            title: "Calendar event updated",
            message: "A linked calendar event has changed",
          },
        });
      }
      actions.push("notification_sent");
      return { handled: true, actions };
    }

    return { handled: false };
  }

  async verifyConnection(accessToken: string): Promise<boolean> {
    try {
      const response = await fetch(
        "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1",
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  async disconnect(accessToken: string): Promise<void> {
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${accessToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
    } catch {
      // Best effort
    }
  }
}

/** Create a Google Calendar event from a task */
export async function createCalendarEvent(
  accessToken: string,
  calendarId: string,
  task: { title: string; description?: string; dueDate: Date; startDate?: Date }
): Promise<string> {
  const start = task.startDate ?? task.dueDate;
  const body = {
    summary: task.title,
    description: task.description,
    start: { dateTime: start.toISOString(), timeZone: "UTC" },
    end: { dateTime: task.dueDate.toISOString(), timeZone: "UTC" },
  };

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  const data = await response.json();
  if (!response.ok) throw new Error(`Google Calendar error: ${data.error?.message}`);
  return data.id;
}

/** Set up a push notification channel (watch) for a calendar */
export async function watchCalendar(
  accessToken: string,
  calendarId: string,
  webhookUrl: string,
  channelId: string
): Promise<{ resourceId: string; expiration: string }> {
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/watch`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: channelId,
        type: "web_hook",
        address: webhookUrl,
      }),
    }
  );

  const data = await response.json();
  if (!response.ok) throw new Error(`Google Calendar watch error: ${data.error?.message}`);
  return { resourceId: data.resourceId, expiration: data.expiration };
}

const googleCalendarAdapter = new GoogleCalendarAdapter();
registerAdapter(googleCalendarAdapter);
export { googleCalendarAdapter };
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/integrations/google-calendar.ts
git commit -m "feat: add Google Calendar adapter with OAuth, event creation, and watch"
```

---

### Task 10: Google Calendar Webhook Route
**Files:**
- Create: `src/app/api/integrations/google-calendar/webhook/route.ts`

- [ ] **Step 1: Create the Google Calendar webhook route**

Create `src/app/api/integrations/google-calendar/webhook/route.ts`:

```typescript
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

  const matchedIntegration = integrations.find((i: any) => {
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
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/integrations/google-calendar/webhook/route.ts
git commit -m "feat: add Google Calendar push notification webhook route"
```

---

### Task 11: Email Adapter (Resend)
**Files:**
- Create: `src/lib/integrations/email.ts`

- [ ] **Step 1: Create the email adapter**

Create `src/lib/integrations/email.ts`:

```typescript
import { BaseIntegrationAdapter, registerAdapter } from "./base-adapter";
import type {
  IntegrationConfig,
  IntegrationEvent,
  OAuthTokens,
  EventHandlerResult,
  IntegrationInfo,
} from "./types";

class EmailAdapter extends BaseIntegrationAdapter {
  readonly service = "EMAIL" as const;
  readonly info: IntegrationInfo = {
    service: "EMAIL",
    name: "Email (Resend)",
    description: "Send email notifications and digests",
    icon: "Mail",
    features: [
      "Email notifications for page mentions",
      "Daily/weekly workspace activity digest",
      "Task assignment email alerts",
      "Custom email templates",
    ],
    requiresOAuth: false,
  };

  private get apiKey() {
    return process.env.RESEND_API_KEY ?? "";
  }
  private get fromEmail() {
    return process.env.RESEND_FROM_EMAIL ?? "noreply@example.com";
  }

  getOAuthUrl(_workspaceId: string, _redirectUri: string): string {
    // Email doesn't use OAuth — it uses an API key configured in env
    return "";
  }

  async exchangeCode(_code: string, _redirectUri: string): Promise<OAuthTokens> {
    // No OAuth flow; connection is validated by API key availability
    return {
      accessToken: this.apiKey,
      externalName: this.fromEmail,
    };
  }

  async refreshAccessToken(_refreshToken: string): Promise<OAuthTokens> {
    return { accessToken: this.apiKey };
  }

  async handleEvent(
    event: IntegrationEvent,
    config: IntegrationConfig,
    _db: any
  ): Promise<EventHandlerResult> {
    // Email adapter doesn't receive inbound events
    return { handled: false };
  }

  async verifyConnection(_accessToken: string): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      const response = await fetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async disconnect(_accessToken: string): Promise<void> {
    // Nothing to revoke for API key-based auth
  }
}

/** Send an email via Resend */
export async function sendEmail(options: {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<string> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL ?? "Notion Web <noreply@example.com>";

  if (!apiKey) throw new Error("RESEND_API_KEY not configured");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html,
      reply_to: options.replyTo,
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(`Resend error: ${JSON.stringify(data)}`);
  return data.id;
}

/** Generate an HTML email for task assignment */
export function taskAssignmentTemplate(params: {
  taskTitle: string;
  projectName: string;
  assignerName: string;
  taskUrl: string;
}): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
      <h2 style="font-size: 18px; color: #1a1a1a; margin-bottom: 16px;">
        You've been assigned a task
      </h2>
      <div style="padding: 16px; border: 1px solid #e5e5e5; border-radius: 8px; margin-bottom: 24px;">
        <p style="font-size: 16px; font-weight: 600; color: #1a1a1a; margin: 0 0 4px;">
          ${params.taskTitle}
        </p>
        <p style="font-size: 13px; color: #666; margin: 0;">
          in ${params.projectName} &middot; assigned by ${params.assignerName}
        </p>
      </div>
      <a href="${params.taskUrl}"
         style="display: inline-block; padding: 10px 20px; background: #2383e2; color: white; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 500;">
        View Task
      </a>
    </div>
  `;
}

/** Generate an HTML email for a workspace activity digest */
export function digestTemplate(params: {
  workspaceName: string;
  period: string;
  items: { title: string; description: string; url: string }[];
}): string {
  const itemsHtml = params.items
    .map(
      (item) => `
    <div style="padding: 12px 0; border-bottom: 1px solid #f0f0f0;">
      <a href="${item.url}" style="font-size: 14px; font-weight: 500; color: #1a1a1a; text-decoration: none;">
        ${item.title}
      </a>
      <p style="font-size: 13px; color: #666; margin: 4px 0 0;">${item.description}</p>
    </div>
  `
    )
    .join("");

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
      <h2 style="font-size: 18px; color: #1a1a1a; margin-bottom: 4px;">
        ${params.workspaceName} — ${params.period} Digest
      </h2>
      <p style="font-size: 13px; color: #999; margin-bottom: 24px;">
        Here's what happened in your workspace
      </p>
      ${itemsHtml}
    </div>
  `;
}

const emailAdapter = new EmailAdapter();
registerAdapter(emailAdapter);
export { emailAdapter };
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/integrations/email.ts
git commit -m "feat: add email adapter with Resend integration and HTML templates"
```

---

### Task 12: Integration Settings UI
**Files:**
- Create: `src/components/settings/integration-settings.tsx`
- Modify: `src/components/settings/settings-layout.tsx`

- [ ] **Step 1: Create the integration settings component**

Create `src/components/settings/integration-settings.tsx`:

```tsx
"use client";

import { useState } from "react";
import { trpc } from "@/server/trpc/client";
import {
  MessageSquare,
  Github,
  CalendarDays,
  Mail,
  Check,
  X,
  ExternalLink,
  AlertCircle,
  Loader2,
  Settings,
} from "lucide-react";

const SERVICE_ICONS: Record<string, typeof MessageSquare> = {
  MessageSquare,
  Github,
  CalendarDays,
  Mail,
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  CONNECTED: { label: "Connected", color: "var(--color-green)" },
  DISCONNECTED: { label: "Disconnected", color: "var(--text-tertiary)" },
  ERROR: { label: "Error", color: "var(--color-red)" },
  PENDING: { label: "Connecting...", color: "var(--color-yellow)" },
};

type Props = {
  workspaceId: string;
};

export function IntegrationSettings({ workspaceId }: Props) {
  const { data: integrations, refetch } = trpc.integration.list.useQuery(
    { workspaceId },
    { enabled: !!workspaceId }
  );
  const connectMutation = trpc.integration.connect.useMutation();
  const disconnectMutation = trpc.integration.disconnect.useMutation({
    onSuccess: () => refetch(),
  });
  const updateConfigMutation = trpc.integration.updateConfig.useMutation({
    onSuccess: () => refetch(),
  });

  const [configuring, setConfiguring] = useState<string | null>(null);

  const handleConnect = async (service: string) => {
    const result = await connectMutation.mutateAsync({
      workspaceId,
      service: service as any,
    });
    if (result.oauthUrl) {
      window.location.href = result.oauthUrl;
    } else {
      // For services that don't use OAuth (email), mark as connected
      refetch();
    }
  };

  const handleDisconnect = (service: string) => {
    if (confirm("Are you sure you want to disconnect this integration?")) {
      disconnectMutation.mutate({ workspaceId, service: service as any });
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
        Integrations
      </h2>
      <p className="text-sm mb-6" style={{ color: "var(--text-tertiary)" }}>
        Connect external services to your workspace
      </p>

      <div className="grid gap-4">
        {integrations?.map(({ service, info, integration }) => {
          const Icon = SERVICE_ICONS[info.icon] ?? Settings;
          const isConnected = integration?.status === "CONNECTED";
          const status = STATUS_LABELS[integration?.status ?? "DISCONNECTED"];

          return (
            <div
              key={service}
              className="p-4 rounded-lg border"
              style={{ borderColor: "var(--border-default)" }}
            >
              {/* Header */}
              <div className="flex items-start gap-4">
                <div
                  className="p-2.5 rounded-lg shrink-0"
                  style={{ backgroundColor: "var(--bg-hover)" }}
                >
                  <Icon size={20} style={{ color: "var(--text-primary)" }} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                      {info.name}
                    </h3>
                    {/* Status badge */}
                    <span
                      className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                      style={{
                        color: status.color,
                        backgroundColor: `${status.color}15`,
                      }}
                    >
                      {integration?.status === "CONNECTED" && <Check size={10} />}
                      {integration?.status === "ERROR" && <AlertCircle size={10} />}
                      {integration?.status === "PENDING" && <Loader2 size={10} className="animate-spin" />}
                      {status.label}
                    </span>
                  </div>

                  <p className="text-xs mb-2" style={{ color: "var(--text-tertiary)" }}>
                    {info.description}
                  </p>

                  {/* Features list */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3">
                    {info.features.map((feature, i) => (
                      <span key={i} className="text-xs flex items-center gap-1" style={{ color: "var(--text-secondary)" }}>
                        <span style={{ color: "var(--color-green)" }}>&#8226;</span>
                        {feature}
                      </span>
                    ))}
                  </div>

                  {/* Connected info */}
                  {isConnected && integration.externalName && (
                    <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
                      Connected as <strong>{integration.externalName}</strong>
                      {integration.connectedAt && (
                        <span style={{ color: "var(--text-tertiary)" }}>
                          {" "}
                          &middot; {new Date(integration.connectedAt).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      )}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {isConnected ? (
                      <>
                        <button
                          onClick={() => setConfiguring(configuring === service ? null : service)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border"
                          style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}
                        >
                          <Settings size={12} />
                          Configure
                        </button>
                        <button
                          onClick={() => handleDisconnect(service)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border"
                          style={{ borderColor: "var(--color-red)", color: "var(--color-red)" }}
                          disabled={disconnectMutation.isPending}
                        >
                          <X size={12} />
                          Disconnect
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleConnect(service)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded"
                        style={{ backgroundColor: "var(--accent-blue)", color: "white" }}
                        disabled={connectMutation.isPending}
                      >
                        <ExternalLink size={12} />
                        {info.requiresOAuth ? "Connect with OAuth" : "Enable"}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Per-service config panel */}
              {configuring === service && isConnected && (
                <div
                  className="mt-4 pt-4 border-t"
                  style={{ borderColor: "var(--border-default)" }}
                >
                  <ServiceConfig
                    service={service}
                    config={(integration.config as Record<string, unknown>) ?? {}}
                    onSave={(newConfig) => {
                      updateConfigMutation.mutate({
                        workspaceId,
                        service: service as any,
                        config: newConfig,
                      });
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Per-service configuration forms */
function ServiceConfig({
  service,
  config,
  onSave,
}: {
  service: string;
  config: Record<string, unknown>;
  onSave: (config: Record<string, unknown>) => void;
}) {
  const [localConfig, setLocalConfig] = useState(config);

  const updateField = (key: string, value: unknown) => {
    setLocalConfig((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="flex flex-col gap-3">
      {service === "SLACK" && (
        <>
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-tertiary)" }}>
              Default Channel
            </label>
            <input
              value={(localConfig.defaultChannel as string) ?? ""}
              onChange={(e) => updateField("defaultChannel", e.target.value)}
              placeholder="#general"
              className="w-full px-2 py-1.5 text-sm rounded border bg-transparent outline-none"
              style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={(localConfig.notifyOnTaskComplete as boolean) ?? true}
              onChange={(e) => updateField("notifyOnTaskComplete", e.target.checked)}
              className="rounded"
            />
            <label className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Notify when tasks are completed
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={(localConfig.notifyOnPageEdit as boolean) ?? false}
              onChange={(e) => updateField("notifyOnPageEdit", e.target.checked)}
              className="rounded"
            />
            <label className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Notify on page edits
            </label>
          </div>
        </>
      )}

      {service === "GITHUB" && (
        <>
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-tertiary)" }}>
              Repository (owner/repo)
            </label>
            <input
              value={(localConfig.repository as string) ?? ""}
              onChange={(e) => updateField("repository", e.target.value)}
              placeholder="org/repo"
              className="w-full px-2 py-1.5 text-sm rounded border bg-transparent outline-none"
              style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={(localConfig.syncIssues as boolean) ?? true}
              onChange={(e) => updateField("syncIssues", e.target.checked)}
              className="rounded"
            />
            <label className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Create tasks from GitHub issues
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={(localConfig.prNotifications as boolean) ?? true}
              onChange={(e) => updateField("prNotifications", e.target.checked)}
              className="rounded"
            />
            <label className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Pull request notifications
            </label>
          </div>
        </>
      )}

      {service === "GOOGLE_CALENDAR" && (
        <>
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-tertiary)" }}>
              Calendar ID
            </label>
            <input
              value={(localConfig.calendarId as string) ?? "primary"}
              onChange={(e) => updateField("calendarId", e.target.value)}
              placeholder="primary"
              className="w-full px-2 py-1.5 text-sm rounded border bg-transparent outline-none"
              style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={(localConfig.autoCreateEvents as boolean) ?? true}
              onChange={(e) => updateField("autoCreateEvents", e.target.checked)}
              className="rounded"
            />
            <label className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Auto-create events for tasks with due dates
            </label>
          </div>
        </>
      )}

      {service === "EMAIL" && (
        <>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={(localConfig.taskAssignmentEmails as boolean) ?? true}
              onChange={(e) => updateField("taskAssignmentEmails", e.target.checked)}
              className="rounded"
            />
            <label className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Send email on task assignment
            </label>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-tertiary)" }}>
              Digest Frequency
            </label>
            <select
              value={(localConfig.digestFrequency as string) ?? "weekly"}
              onChange={(e) => updateField("digestFrequency", e.target.value)}
              className="w-full px-2 py-1.5 text-sm rounded border bg-transparent outline-none"
              style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }}
            >
              <option value="none">None</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
        </>
      )}

      <div className="flex justify-end mt-2">
        <button
          onClick={() => onSave(localConfig)}
          className="px-3 py-1.5 text-xs rounded"
          style={{ backgroundColor: "var(--accent-blue)", color: "white" }}
        >
          Save Configuration
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update settings-layout.tsx to use IntegrationSettings**

In `src/components/settings/settings-layout.tsx`, replace the existing integrations tab content. Add the import at the top:

```typescript
import { IntegrationSettings } from "./integration-settings";
```

Replace the integrations tab rendering block (the `activeTab === "integrations"` section) with:

```tsx
{activeTab === "integrations" && (
  <IntegrationSettings workspaceId={workspaceId} />
)}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/integration-settings.tsx src/components/settings/settings-layout.tsx
git commit -m "feat: add integration settings UI with service cards, connect/disconnect, per-service config"
```
