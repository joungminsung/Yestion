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
          BearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "API Key",
            description: "Send your API key as `Authorization: Bearer <api_key>`",
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
          Error: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
          },
        },
      },
      security: [{ BearerAuth: [] }],
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
