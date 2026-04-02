import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from "prom-client";

export const register = new Registry();

// Collect default Node.js metrics (memory, CPU, event loop, etc.)
collectDefaultMetrics({ register, prefix: "notion_" });

// HTTP metrics
export const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status"] as const,
  registers: [register],
});

export const httpRequestDuration = new Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status"] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

// WebSocket / Collaboration metrics
export const websocketConnections = new Gauge({
  name: "websocket_connections_active",
  help: "Number of active WebSocket connections",
  registers: [register],
});

export const collabDocumentsActive = new Gauge({
  name: "collab_documents_active",
  help: "Number of active collaboration documents",
  registers: [register],
});

export const collabSyncMessages = new Counter({
  name: "collab_sync_messages_total",
  help: "Total number of collaboration sync messages",
  labelNames: ["type"] as const,
  registers: [register],
});

export const collabUsersOnline = new Gauge({
  name: "collab_users_online",
  help: "Number of users currently collaborating",
  registers: [register],
});

export const collabAwarenessUpdates = new Counter({
  name: "collab_awareness_updates_total",
  help: "Total number of awareness updates",
  registers: [register],
});

// Prisma / Database metrics
export const prismaQueriesTotal = new Counter({
  name: "prisma_queries_total",
  help: "Total number of Prisma queries",
  labelNames: ["model", "operation"] as const,
  registers: [register],
});

export const prismaQueryDuration = new Histogram({
  name: "prisma_query_duration_seconds",
  help: "Prisma query duration in seconds",
  labelNames: ["model", "operation"] as const,
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [register],
});

// tRPC metrics
export const trpcRequestsTotal = new Counter({
  name: "trpc_requests_total",
  help: "Total number of tRPC requests",
  labelNames: ["procedure", "type", "status"] as const,
  registers: [register],
});

export const trpcRequestDuration = new Histogram({
  name: "trpc_request_duration_seconds",
  help: "tRPC request duration in seconds",
  labelNames: ["procedure", "type"] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});
