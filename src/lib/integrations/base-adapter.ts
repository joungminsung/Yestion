import type { PrismaClient } from "@prisma/client";
import type {
  IntegrationServiceType,
  IntegrationConfig,
  OAuthTokens,
  IntegrationEvent,
  EventHandlerResult,
  IntegrationInfo,
} from "./types";

/**
 * Abstract base class for all integration adapters.
 * Each service (Slack, GitHub, etc.) extends this class.
 */
export abstract class BaseIntegrationAdapter {
  abstract readonly service: IntegrationServiceType;
  abstract readonly info: IntegrationInfo;

  /**
   * Generate the OAuth authorization URL for this service.
   * @param workspaceId - The workspace initiating the connection
   * @param redirectUri - The callback URL after OAuth
   * @returns The full authorization URL
   */
  abstract getOAuthUrl(workspaceId: string, redirectUri: string): string;

  /**
   * Exchange an OAuth authorization code for access/refresh tokens.
   * @param code - The authorization code from the callback
   * @param redirectUri - The redirect URI used in the initial request
   * @returns Token set with access token, optional refresh token, and external IDs
   */
  abstract exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens>;

  /**
   * Refresh an expired access token using the refresh token.
   * @param refreshToken - The stored refresh token
   * @returns New token set
   */
  abstract refreshAccessToken(refreshToken: string): Promise<OAuthTokens>;

  /**
   * Handle an inbound event/webhook from the external service.
   * @param event - The parsed event data
   * @param config - The integration's stored config
   * @param db - Database client for creating notifications, etc.
   * @returns Result indicating what actions were taken
   */
  abstract handleEvent(
    event: IntegrationEvent,
    config: IntegrationConfig,
    db: PrismaClient
  ): Promise<EventHandlerResult>;

  /**
   * Verify that the connection is still valid.
   * @param accessToken - The stored access token
   * @returns true if the token is still valid
   */
  abstract verifyConnection(accessToken: string): Promise<boolean>;

  /**
   * Disconnect and clean up (revoke tokens, unregister webhooks, etc.).
   * @param accessToken - The stored access token
   * @param config - The integration's stored config
   */
  abstract disconnect(accessToken: string, config: IntegrationConfig): Promise<void>;
}

/** Registry of all adapters by service type */
const adapterRegistry = new Map<IntegrationServiceType, BaseIntegrationAdapter>();

export function registerAdapter(adapter: BaseIntegrationAdapter): void {
  adapterRegistry.set(adapter.service, adapter);
}

export function getAdapter(service: IntegrationServiceType): BaseIntegrationAdapter {
  const adapter = adapterRegistry.get(service);
  if (!adapter) throw new Error(`No adapter registered for service: ${service}`);
  return adapter;
}

export function getAllAdapters(): BaseIntegrationAdapter[] {
  return Array.from(adapterRegistry.values());
}
