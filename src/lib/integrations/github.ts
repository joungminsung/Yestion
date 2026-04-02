import { BaseIntegrationAdapter, registerAdapter } from "./base-adapter";
import { signOAuthState, decryptToken } from "./crypto";
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
    const state = signOAuthState(workspaceId);
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
    _config: IntegrationConfig,
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
      const token = decryptToken(accessToken);
      const response = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async disconnect(accessToken: string, _config: IntegrationConfig): Promise<void> {
    const token = decryptToken(accessToken);
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
          body: JSON.stringify({ access_token: token }),
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
