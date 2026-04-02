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
