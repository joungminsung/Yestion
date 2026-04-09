import type { PrismaClient } from "@prisma/client";
import { BaseIntegrationAdapter, registerAdapter } from "./base-adapter";
import { signOAuthState, decryptToken } from "./crypto";
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
    description: "Connect meeting and schedule data with Google Calendar",
    icon: "CalendarDays",
    features: [
      "Subscribe to calendar updates in the workspace",
      "Prepare meeting pages around calendar context",
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
    const state = signOAuthState(workspaceId);
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
    config: IntegrationConfig,
    db: PrismaClient
  ): Promise<EventHandlerResult> {
    void config;
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
      const token = decryptToken(accessToken);
      const response = await fetch(
        "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1",
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  async disconnect(accessToken: string): Promise<void> {
    const token = decryptToken(accessToken);
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
    } catch {
      // Best effort
    }
  }
}

/** Set up a push notification channel (watch) for a calendar */
export async function watchCalendar(
  accessToken: string,
  calendarId: string,
  webhookUrl: string,
  channelId: string,
  channelToken?: string
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
        ...(channelToken ? { token: channelToken } : {}),
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
