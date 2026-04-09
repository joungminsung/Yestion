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

class GitHubAdapter extends BaseIntegrationAdapter {
  readonly service = "GITHUB" as const;
  readonly info: IntegrationInfo = {
    service: "GITHUB",
    name: "GitHub",
    description: "Receive GitHub activity inside the workspace",
    icon: "Github",
    features: [
      "Sync GitHub issue activity into workspace notifications",
      "PR status notifications",
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

  async exchangeCode(code: string): Promise<OAuthTokens> {
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

  async refreshAccessToken(): Promise<OAuthTokens> {
    // GitHub personal tokens don't expire; GitHub Apps use installation tokens
    throw new Error("GitHub tokens do not support refresh");
  }

  async handleEvent(
    event: IntegrationEvent,
    config: IntegrationConfig,
    db: PrismaClient
  ): Promise<EventHandlerResult> {
    void config;
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
              message: `${issue.html_url}`,
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
              message: `${pr.html_url}`,
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

  async disconnect(accessToken: string, config: IntegrationConfig): Promise<void> {
    const token = decryptToken(accessToken);
    const repository = typeof config.repository === "string" ? config.repository : "";
    const webhookId = typeof config.webhookId === "number"
      ? config.webhookId
      : typeof config.webhookId === "string"
        ? Number(config.webhookId)
        : null;

    if (repository && webhookId) {
      try {
        await deleteRepositoryWebhook(token, repository, webhookId);
      } catch {
        // Best effort cleanup for repo webhook registration
      }
    }

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

function parseRepository(repository: string): { owner: string; repo: string } {
  const [owner, repo] = repository.trim().split("/");
  if (!owner || !repo) {
    throw new Error("Repository must use the owner/repo format");
  }
  return { owner, repo };
}

type GitHubWebhook = {
  id: number;
  config?: {
    url?: string;
  };
};

export async function ensureRepositoryWebhook(
  accessToken: string,
  repository: string,
  webhookUrl: string,
  secret: string
): Promise<number> {
  const { owner, repo } = parseRepository(repository);
  const base = `https://api.github.com/repos/${owner}/${repo}/hooks`;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };

  const existingResponse = await fetch(base, { headers });
  if (!existingResponse.ok) {
    throw new Error(`Failed to list GitHub webhooks (${existingResponse.status})`);
  }

  const existingHooks = await existingResponse.json() as GitHubWebhook[];
  const existing = existingHooks.find((hook) => hook.config?.url === webhookUrl);

  const body = JSON.stringify({
    active: true,
    events: ["issues", "pull_request"],
    config: {
      url: webhookUrl,
      content_type: "json",
      secret,
      insecure_ssl: "0",
    },
  });

  if (existing) {
    const updateResponse = await fetch(`${base}/${existing.id}`, {
      method: "PATCH",
      headers,
      body,
    });
    if (!updateResponse.ok) {
      throw new Error(`Failed to update GitHub webhook (${updateResponse.status})`);
    }
    return existing.id;
  }

  const createResponse = await fetch(base, {
    method: "POST",
    headers,
    body,
  });
  if (!createResponse.ok) {
    throw new Error(`Failed to create GitHub webhook (${createResponse.status})`);
  }

  const created = await createResponse.json() as GitHubWebhook;
  return created.id;
}

export async function deleteRepositoryWebhook(
  accessToken: string,
  repository: string,
  webhookId: number
): Promise<void> {
  const { owner, repo } = parseRepository(repository);
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/hooks/${webhookId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
      },
    }
  );

  if (!response.ok && response.status !== 404) {
    throw new Error(`Failed to delete GitHub webhook (${response.status})`);
  }
}

const githubAdapter = new GitHubAdapter();
registerAdapter(githubAdapter);
export { githubAdapter };
