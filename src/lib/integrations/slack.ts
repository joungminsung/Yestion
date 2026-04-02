// Stub - will be implemented in Task 5
import { registerAdapter, BaseIntegrationAdapter } from "./base-adapter";
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

const slackAdapter = new SlackAdapter();
registerAdapter(slackAdapter);
export { slackAdapter };
