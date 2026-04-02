// Stub - will be implemented in Task 7
import { registerAdapter, BaseIntegrationAdapter } from "./base-adapter";
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

const githubAdapter = new GitHubAdapter();
registerAdapter(githubAdapter);
export { githubAdapter };
