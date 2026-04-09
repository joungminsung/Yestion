import type { IntegrationServiceType } from "./types";

const SERVICE_TO_SLUG: Record<IntegrationServiceType, string> = {
  SLACK: "slack",
  GITHUB: "github",
  GOOGLE_CALENDAR: "google-calendar",
  EMAIL: "email",
};

const SLUG_TO_SERVICE: Record<string, IntegrationServiceType> = {
  slack: "SLACK",
  github: "GITHUB",
  "google-calendar": "GOOGLE_CALENDAR",
  "google_calendar": "GOOGLE_CALENDAR",
  email: "EMAIL",
};

export function getIntegrationServiceSlug(service: IntegrationServiceType): string {
  return SERVICE_TO_SLUG[service];
}

export function parseIntegrationServiceSlug(slug: string): IntegrationServiceType | undefined {
  return SLUG_TO_SERVICE[slug];
}
