# Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add CI/CD pipeline, observability stack (Prometheus/Grafana/Loki), application metrics, and Swagger API documentation.
**Architecture:** GitHub Actions handles lint/test/build/deploy in a multi-job workflow. Docker Compose is extended with Prometheus, Grafana, Loki, and Promtail sidecars for monitoring. The app exposes a `/api/metrics` endpoint via prom-client. Swagger UI serves interactive API docs at `/api/docs`.
**Tech Stack:** GitHub Actions, Docker Compose, Prometheus, Grafana, Loki, Promtail, prom-client, swagger-ui-react, next-swagger-doc

---

### Task 1: GitHub Actions CI
**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create .github/workflows directory**
```bash
mkdir -p .github/workflows
```

- [ ] **Step 2: Create CI workflow**
Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [master]
  pull_request:
    branches: [master]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

env:
  NODE_VERSION: "20"

jobs:
  lint:
    name: Lint & Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: "npm"

      - run: npm ci

      - name: ESLint
        run: npm run lint

      - name: Type Check
        run: npx tsc --noEmit

  test:
    name: Tests
    runs-on: ubuntu-latest
    needs: lint
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: notion_clone_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U postgres"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    env:
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/notion_clone_test
      NEXTAUTH_SECRET: test-secret
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: "npm"

      - run: npm ci

      - name: Generate Prisma Client
        run: npx prisma generate

      - name: Push Schema
        run: npx prisma db push --skip-generate

      - name: Run Tests
        run: npm test

  build:
    name: Build
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: "npm"

      - run: npm ci

      - name: Generate Prisma Client
        run: npx prisma generate

      - name: Build
        run: npm run build
        env:
          DATABASE_URL: postgresql://placeholder:placeholder@localhost:5432/placeholder
          NEXTAUTH_SECRET: build-secret

      - name: Upload Build Artifact
        uses: actions/upload-artifact@v4
        with:
          name: build-output
          path: .next/
          retention-days: 3

  docker:
    name: Docker Build
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/master'
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build Docker Image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: false
          tags: notion-web:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

- [ ] **Step 3: Commit**
```
feat: add GitHub Actions CI with lint, test, build, and docker jobs
```

---

### Task 2: Docker Compose Monitoring Stack
**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Extend docker-compose.yml with monitoring services**
Add the following services to `docker-compose.yml`:

```yaml
  prometheus:
    image: prom/prometheus:v2.51.0
    ports:
      - "9090:9090"
    volumes:
      - ./infra/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - "--config.file=/etc/prometheus/prometheus.yml"
      - "--storage.tsdb.retention.time=30d"
    depends_on:
      - app

  grafana:
    image: grafana/grafana:10.4.0
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_USER=admin
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_USERS_ALLOW_SIGN_UP=false
    volumes:
      - ./infra/grafana/datasources:/etc/grafana/provisioning/datasources
      - ./infra/grafana/dashboards:/etc/grafana/provisioning/dashboards
      - grafana_data:/var/lib/grafana
    depends_on:
      - prometheus
      - loki

  loki:
    image: grafana/loki:2.9.6
    ports:
      - "3100:3100"
    volumes:
      - loki_data:/loki

  promtail:
    image: grafana/promtail:2.9.6
    volumes:
      - ./infra/promtail.yml:/etc/promtail/config.yml
      - /var/log:/var/log:ro
    command: -config.file=/etc/promtail/config.yml
    depends_on:
      - loki
```

Also add to the `volumes:` section:

```yaml
  prometheus_data:
  grafana_data:
  loki_data:
```

- [ ] **Step 2: Commit**
```
feat: add Prometheus, Grafana, Loki, and Promtail to docker-compose
```

---

### Task 3: Prometheus Configuration
**Files:**
- Create: `infra/prometheus.yml`

- [ ] **Step 1: Create infra directory and Prometheus config**
```bash
mkdir -p infra/grafana/datasources infra/grafana/dashboards
```

- [ ] **Step 2: Create Prometheus config**
Create `infra/prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  scrape_timeout: 10s

scrape_configs:
  - job_name: "notion-web"
    metrics_path: "/api/metrics"
    static_configs:
      - targets: ["app:3000"]
        labels:
          app: "notion-web"
          environment: "production"

  - job_name: "prometheus"
    static_configs:
      - targets: ["localhost:9090"]

  - job_name: "node-exporter"
    static_configs:
      - targets: ["node-exporter:9100"]
```

- [ ] **Step 3: Commit**
```
feat: add Prometheus scrape configuration
```

---

### Task 4: Grafana Dashboards
**Files:**
- Create: `infra/grafana/dashboards/dashboards.yml`
- Create: `infra/grafana/dashboards/app-performance.json`
- Create: `infra/grafana/dashboards/database.json`
- Create: `infra/grafana/dashboards/collaboration.json`

- [ ] **Step 1: Create dashboard provisioning config**
Create `infra/grafana/dashboards/dashboards.yml`:

```yaml
apiVersion: 1

providers:
  - name: "default"
    orgId: 1
    folder: "Notion Web"
    type: file
    disableDeletion: false
    editable: true
    options:
      path: /etc/grafana/provisioning/dashboards
      foldersFromFilesStructure: false
```

- [ ] **Step 2: Create app performance dashboard**
Create `infra/grafana/dashboards/app-performance.json`:

```json
{
  "dashboard": {
    "title": "App Performance",
    "uid": "notion-web-performance",
    "tags": ["notion-web"],
    "timezone": "browser",
    "refresh": "30s",
    "panels": [
      {
        "title": "HTTP Request Rate",
        "type": "timeseries",
        "gridPos": { "h": 8, "w": 12, "x": 0, "y": 0 },
        "targets": [
          {
            "expr": "rate(http_requests_total{app=\"notion-web\"}[5m])",
            "legendFormat": "{{method}} {{route}} {{status}}"
          }
        ]
      },
      {
        "title": "HTTP Request Duration (p95)",
        "type": "timeseries",
        "gridPos": { "h": 8, "w": 12, "x": 12, "y": 0 },
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{app=\"notion-web\"}[5m]))",
            "legendFormat": "{{route}}"
          }
        ]
      },
      {
        "title": "Active Connections",
        "type": "stat",
        "gridPos": { "h": 4, "w": 6, "x": 0, "y": 8 },
        "targets": [
          {
            "expr": "websocket_connections_active{app=\"notion-web\"}",
            "legendFormat": "Active"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "timeseries",
        "gridPos": { "h": 8, "w": 12, "x": 0, "y": 12 },
        "targets": [
          {
            "expr": "rate(http_requests_total{app=\"notion-web\", status=~\"5..\"}[5m])",
            "legendFormat": "{{method}} {{route}}"
          }
        ]
      },
      {
        "title": "Memory Usage",
        "type": "timeseries",
        "gridPos": { "h": 8, "w": 12, "x": 12, "y": 12 },
        "targets": [
          {
            "expr": "process_resident_memory_bytes{app=\"notion-web\"}",
            "legendFormat": "RSS"
          },
          {
            "expr": "process_heap_bytes{app=\"notion-web\"}",
            "legendFormat": "Heap"
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 3: Create database dashboard**
Create `infra/grafana/dashboards/database.json`:

```json
{
  "dashboard": {
    "title": "Database",
    "uid": "notion-web-database",
    "tags": ["notion-web", "database"],
    "timezone": "browser",
    "refresh": "30s",
    "panels": [
      {
        "title": "Prisma Query Duration (p95)",
        "type": "timeseries",
        "gridPos": { "h": 8, "w": 12, "x": 0, "y": 0 },
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(prisma_query_duration_seconds_bucket[5m]))",
            "legendFormat": "{{model}} {{operation}}"
          }
        ]
      },
      {
        "title": "Prisma Query Rate",
        "type": "timeseries",
        "gridPos": { "h": 8, "w": 12, "x": 12, "y": 0 },
        "targets": [
          {
            "expr": "rate(prisma_queries_total[5m])",
            "legendFormat": "{{model}} {{operation}}"
          }
        ]
      },
      {
        "title": "Slow Queries (>1s)",
        "type": "stat",
        "gridPos": { "h": 4, "w": 6, "x": 0, "y": 8 },
        "targets": [
          {
            "expr": "increase(prisma_query_duration_seconds_bucket{le=\"1.0\"}[1h])",
            "legendFormat": "Count"
          }
        ]
      },
      {
        "title": "Database Connection Pool",
        "type": "gauge",
        "gridPos": { "h": 8, "w": 12, "x": 0, "y": 12 },
        "targets": [
          {
            "expr": "prisma_pool_connections_open",
            "legendFormat": "Open"
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 4: Create collaboration dashboard**
Create `infra/grafana/dashboards/collaboration.json`:

```json
{
  "dashboard": {
    "title": "Collaboration",
    "uid": "notion-web-collaboration",
    "tags": ["notion-web", "collaboration"],
    "timezone": "browser",
    "refresh": "30s",
    "panels": [
      {
        "title": "Active WebSocket Connections",
        "type": "timeseries",
        "gridPos": { "h": 8, "w": 12, "x": 0, "y": 0 },
        "targets": [
          {
            "expr": "websocket_connections_active{app=\"notion-web\"}",
            "legendFormat": "Active Connections"
          }
        ]
      },
      {
        "title": "Active Collaboration Documents",
        "type": "stat",
        "gridPos": { "h": 4, "w": 6, "x": 12, "y": 0 },
        "targets": [
          {
            "expr": "collab_documents_active{app=\"notion-web\"}",
            "legendFormat": "Documents"
          }
        ]
      },
      {
        "title": "Yjs Sync Messages / sec",
        "type": "timeseries",
        "gridPos": { "h": 8, "w": 12, "x": 0, "y": 8 },
        "targets": [
          {
            "expr": "rate(collab_sync_messages_total{app=\"notion-web\"}[5m])",
            "legendFormat": "{{type}}"
          }
        ]
      },
      {
        "title": "Collaboration Users Online",
        "type": "timeseries",
        "gridPos": { "h": 8, "w": 12, "x": 12, "y": 8 },
        "targets": [
          {
            "expr": "collab_users_online{app=\"notion-web\"}",
            "legendFormat": "Users"
          }
        ]
      },
      {
        "title": "Awareness Updates / sec",
        "type": "timeseries",
        "gridPos": { "h": 8, "w": 12, "x": 0, "y": 16 },
        "targets": [
          {
            "expr": "rate(collab_awareness_updates_total{app=\"notion-web\"}[5m])",
            "legendFormat": "Updates"
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 5: Commit**
```
feat: add Grafana dashboards for app performance, database, and collaboration
```

---

### Task 5: Grafana Datasources
**Files:**
- Create: `infra/grafana/datasources/datasource.yml`

- [ ] **Step 1: Create Grafana datasource provisioning config**
Create `infra/grafana/datasources/datasource.yml`:

```yaml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true
    jsonData:
      timeInterval: "15s"

  - name: Loki
    type: loki
    access: proxy
    url: http://loki:3100
    editable: true
    jsonData:
      maxLines: 1000
```

- [ ] **Step 2: Commit**
```
feat: add Grafana datasource provisioning for Prometheus and Loki
```

---

### Task 6: Promtail Configuration
**Files:**
- Create: `infra/promtail.yml`

- [ ] **Step 1: Create Promtail config**
Create `infra/promtail.yml`:

```yaml
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  - job_name: docker
    docker_sd_configs:
      - host: unix:///var/run/docker.sock
        refresh_interval: 5s
    relabel_configs:
      - source_labels: ["__meta_docker_container_name"]
        target_label: "container"
      - source_labels: ["__meta_docker_container_log_stream"]
        target_label: "stream"

  - job_name: app-logs
    static_configs:
      - targets:
          - localhost
        labels:
          job: notion-web
          __path__: /var/log/notion-web/*.log
    pipeline_stages:
      - json:
          expressions:
            level: level
            message: msg
            timestamp: time
      - labels:
          level:
      - timestamp:
          source: timestamp
          format: RFC3339
```

- [ ] **Step 2: Commit**
```
feat: add Promtail log shipping configuration
```

---

### Task 7: Application Metrics
**Files:**
- Create: `src/lib/metrics.ts`
- Create: `src/app/api/metrics/route.ts`

- [ ] **Step 1: Install prom-client**
```bash
npm install prom-client
```

- [ ] **Step 2: Create metrics registry and collectors**
Create `src/lib/metrics.ts`:

```typescript
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
```

- [ ] **Step 3: Create metrics API route**
Create `src/app/api/metrics/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { register } from "@/lib/metrics";

export async function GET() {
  try {
    const metrics = await register.metrics();
    return new NextResponse(metrics, {
      headers: {
        "Content-Type": register.contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to collect metrics" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Commit**
```
feat: add application metrics with prom-client and /api/metrics endpoint
```

---

### Task 8: Swagger API Documentation
**Files:**
- Create: `src/app/api/docs/page.tsx`
- Create: `src/lib/swagger.ts`

- [ ] **Step 1: Install Swagger dependencies**
```bash
npm install swagger-ui-react next-swagger-doc
npm install -D @types/swagger-ui-react
```

- [ ] **Step 2: Create Swagger spec definition**
Create `src/lib/swagger.ts`:

```typescript
import { createSwaggerSpec } from "next-swagger-doc";

export function getApiDocs() {
  return createSwaggerSpec({
    apiFolder: "src/app/api/v1",
    definition: {
      openapi: "3.0.0",
      info: {
        title: "Notion Web API",
        version: "1.0.0",
        description: "REST API for the Notion Web collaborative workspace application.",
        contact: {
          name: "API Support",
        },
      },
      servers: [
        {
          url: "/api/v1",
          description: "API v1",
        },
      ],
      components: {
        securitySchemes: {
          ApiKeyAuth: {
            type: "apiKey",
            in: "header",
            name: "x-api-key",
            description: "API key for authentication",
          },
        },
        schemas: {
          Page: {
            type: "object",
            properties: {
              id: { type: "string" },
              title: { type: "string" },
              icon: { type: "string", nullable: true },
              coverImage: { type: "string", nullable: true },
              workspaceId: { type: "string" },
              parentId: { type: "string", nullable: true },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
            },
          },
          Block: {
            type: "object",
            properties: {
              id: { type: "string" },
              type: { type: "string" },
              content: { type: "object" },
              pageId: { type: "string" },
              parentId: { type: "string", nullable: true },
              position: { type: "number" },
            },
          },
          Project: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              description: { type: "string", nullable: true },
              status: { type: "string" },
              workspaceId: { type: "string" },
            },
          },
          Task: {
            type: "object",
            properties: {
              id: { type: "string" },
              title: { type: "string" },
              status: { type: "string" },
              priority: { type: "string" },
              projectId: { type: "string" },
              assigneeId: { type: "string", nullable: true },
            },
          },
          Error: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
          },
        },
      },
      security: [{ ApiKeyAuth: [] }],
      paths: {
        "/pages": {
          get: {
            summary: "List pages",
            tags: ["Pages"],
            parameters: [
              { name: "workspaceId", in: "query", required: true, schema: { type: "string" } },
              { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
              { name: "cursor", in: "query", schema: { type: "string" } },
            ],
            responses: {
              "200": { description: "List of pages" },
              "401": { description: "Unauthorized" },
            },
          },
        },
        "/blocks": {
          get: {
            summary: "List blocks for a page",
            tags: ["Blocks"],
            parameters: [
              { name: "pageId", in: "query", required: true, schema: { type: "string" } },
            ],
            responses: {
              "200": { description: "List of blocks" },
              "401": { description: "Unauthorized" },
            },
          },
        },
        "/projects": {
          get: {
            summary: "List projects",
            tags: ["Projects"],
            parameters: [
              { name: "workspaceId", in: "query", required: true, schema: { type: "string" } },
            ],
            responses: {
              "200": { description: "List of projects" },
              "401": { description: "Unauthorized" },
            },
          },
          post: {
            summary: "Create a project",
            tags: ["Projects"],
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: { "$ref": "#/components/schemas/Project" },
                },
              },
            },
            responses: {
              "201": { description: "Project created" },
              "401": { description: "Unauthorized" },
            },
          },
        },
        "/tasks": {
          get: {
            summary: "List tasks",
            tags: ["Tasks"],
            parameters: [
              { name: "projectId", in: "query", required: true, schema: { type: "string" } },
            ],
            responses: {
              "200": { description: "List of tasks" },
              "401": { description: "Unauthorized" },
            },
          },
          post: {
            summary: "Create a task",
            tags: ["Tasks"],
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: { "$ref": "#/components/schemas/Task" },
                },
              },
            },
            responses: {
              "201": { description: "Task created" },
              "401": { description: "Unauthorized" },
            },
          },
        },
        "/search": {
          get: {
            summary: "Search across workspace",
            tags: ["Search"],
            parameters: [
              { name: "q", in: "query", required: true, schema: { type: "string" } },
              { name: "workspaceId", in: "query", required: true, schema: { type: "string" } },
            ],
            responses: {
              "200": { description: "Search results" },
              "401": { description: "Unauthorized" },
            },
          },
        },
        "/users": {
          get: {
            summary: "List workspace users",
            tags: ["Users"],
            parameters: [
              { name: "workspaceId", in: "query", required: true, schema: { type: "string" } },
            ],
            responses: {
              "200": { description: "List of users" },
              "401": { description: "Unauthorized" },
            },
          },
        },
        "/databases": {
          get: {
            summary: "List databases",
            tags: ["Databases"],
            parameters: [
              { name: "workspaceId", in: "query", required: true, schema: { type: "string" } },
            ],
            responses: {
              "200": { description: "List of databases" },
              "401": { description: "Unauthorized" },
            },
          },
        },
      },
    },
  });
}
```

- [ ] **Step 3: Create Swagger UI page**
Create `src/app/api/docs/page.tsx`:

```tsx
"use client";

import dynamic from "next/dynamic";
import "swagger-ui-react/swagger-ui.css";
import { useEffect, useState } from "react";

const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false });

export default function ApiDocsPage() {
  const [spec, setSpec] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    fetch("/api/docs/spec")
      .then((res) => res.json())
      .then(setSpec);
  }, []);

  if (!spec) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ color: "var(--text-secondary)" }}>
        API 문서를 로딩 중...
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#ffffff" }}>
      <SwaggerUI spec={spec} />
    </div>
  );
}
```

- [ ] **Step 4: Create spec API route**
Create `src/app/api/docs/spec/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getApiDocs } from "@/lib/swagger";

export async function GET() {
  const spec = getApiDocs();
  return NextResponse.json(spec);
}
```

- [ ] **Step 5: Commit**
```
feat: add Swagger API documentation with interactive UI at /api/docs
```
