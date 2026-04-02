// Stub - will be implemented in Task 9
import { registerAdapter, BaseIntegrationAdapter } from "./base-adapter";
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

  getOAuthUrl(_workspaceId: string, _redirectUri: string): string {
    return "";
  }
  async exchangeCode(_code: string, _redirectUri: string): Promise<OAuthTokens> {
    throw new Error("Not implemented");
  }
  async refreshAccessToken(_refreshToken: string): Promise<OAuthTokens> {
    throw new Error("Not implemented");
  }
  async handleEvent(
    _event: IntegrationEvent,
    _config: IntegrationConfig,
    _db: any
  ): Promise<EventHandlerResult> {
    return { handled: false };
  }
  async verifyConnection(_accessToken: string): Promise<boolean> {
    return false;
  }
  async disconnect(_accessToken: string, _config: IntegrationConfig): Promise<void> {}
}

const googleCalendarAdapter = new GoogleCalendarAdapter();
registerAdapter(googleCalendarAdapter);
export { googleCalendarAdapter };
