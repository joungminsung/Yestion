import { BaseIntegrationAdapter, registerAdapter } from "./base-adapter";
import { signOAuthState, decryptToken } from "./crypto";
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
    const state = signOAuthState(workspaceId);
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
    _config: IntegrationConfig,
    _db: any
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
      const token = decryptToken(accessToken);
      const response = await fetch("https://slack.com/api/auth.test", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      return data.ok === true;
    } catch {
      return false;
    }
  }

  async disconnect(accessToken: string, _config: IntegrationConfig): Promise<void> {
    const token = decryptToken(accessToken);
    // Revoke the token
    await fetch("https://slack.com/api/auth.revoke", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
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
