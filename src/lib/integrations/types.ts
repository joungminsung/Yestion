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
