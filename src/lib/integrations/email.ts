// Stub - will be implemented in Task 11
import { registerAdapter, BaseIntegrationAdapter } from "./base-adapter";
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

const emailAdapter = new EmailAdapter();
registerAdapter(emailAdapter);
export { emailAdapter };
