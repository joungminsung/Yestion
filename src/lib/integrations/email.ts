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
    _event: IntegrationEvent,
    _config: IntegrationConfig,
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

  async disconnect(_accessToken: string, _config: IntegrationConfig): Promise<void> {
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

/** Escape HTML special characters to prevent XSS */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Generate an HTML email for task assignment */
export function taskAssignmentTemplate(params: {
  taskTitle: string;
  projectName: string;
  assignerName: string;
  taskUrl: string;
}): string {
  const taskTitle = escapeHtml(params.taskTitle);
  const projectName = escapeHtml(params.projectName);
  const assignerName = escapeHtml(params.assignerName);
  const taskUrl = escapeHtml(params.taskUrl);

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
      <h2 style="font-size: 18px; color: #1a1a1a; margin-bottom: 16px;">
        You've been assigned a task
      </h2>
      <div style="padding: 16px; border: 1px solid #e5e5e5; border-radius: 8px; margin-bottom: 24px;">
        <p style="font-size: 16px; font-weight: 600; color: #1a1a1a; margin: 0 0 4px;">
          ${taskTitle}
        </p>
        <p style="font-size: 13px; color: #666; margin: 0;">
          in ${projectName} &middot; assigned by ${assignerName}
        </p>
      </div>
      <a href="${taskUrl}"
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
  const workspaceName = escapeHtml(params.workspaceName);
  const period = escapeHtml(params.period);

  const itemsHtml = params.items
    .map(
      (item) => `
    <div style="padding: 12px 0; border-bottom: 1px solid #f0f0f0;">
      <a href="${escapeHtml(item.url)}" style="font-size: 14px; font-weight: 500; color: #1a1a1a; text-decoration: none;">
        ${escapeHtml(item.title)}
      </a>
      <p style="font-size: 13px; color: #666; margin: 4px 0 0;">${escapeHtml(item.description)}</p>
    </div>
  `
    )
    .join("");

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
      <h2 style="font-size: 18px; color: #1a1a1a; margin-bottom: 4px;">
        ${workspaceName} — ${period} Digest
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
