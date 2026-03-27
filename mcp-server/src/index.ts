import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// ── Config ──────────────────────────────────────────────────────

const API_URL = process.env.NOTION_CLONE_API_URL || "http://localhost:3000";
const API_KEY = process.env.NOTION_CLONE_API_KEY || "";

async function api(path: string, options: RequestInit = {}) {
  const url = `${API_URL}/api/v1${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

// ── Server ──────────────────────────────────────────────────────

const server = new Server(
  {
    name: "notion-clone-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// ── Tools ───────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "search_pages",
    description: "Search pages by query string",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query" },
      },
    },
  },
  {
    name: "get_page",
    description: "Get a page by ID, including its blocks",
    inputSchema: {
      type: "object" as const,
      properties: {
        pageId: { type: "string", description: "Page ID" },
      },
      required: ["pageId"],
    },
  },
  {
    name: "create_page",
    description: "Create a new page",
    inputSchema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Page title" },
        parentId: { type: "string", description: "Parent page ID (optional)" },
        icon: { type: "string", description: "Page icon emoji (optional)" },
      },
    },
  },
  {
    name: "update_page",
    description: "Update a page's title, icon, or cover",
    inputSchema: {
      type: "object" as const,
      properties: {
        pageId: { type: "string", description: "Page ID" },
        title: { type: "string", description: "New title" },
        icon: { type: "string", description: "New icon" },
        cover: { type: "string", description: "New cover URL" },
      },
      required: ["pageId"],
    },
  },
  {
    name: "delete_page",
    description: "Move a page to trash",
    inputSchema: {
      type: "object" as const,
      properties: {
        pageId: { type: "string", description: "Page ID" },
      },
      required: ["pageId"],
    },
  },
  {
    name: "get_database",
    description: "Get database schema and properties",
    inputSchema: {
      type: "object" as const,
      properties: {
        databaseId: { type: "string", description: "Database ID" },
      },
      required: ["databaseId"],
    },
  },
  {
    name: "query_database",
    description: "Query database rows",
    inputSchema: {
      type: "object" as const,
      properties: {
        databaseId: { type: "string", description: "Database ID" },
      },
      required: ["databaseId"],
    },
  },
  {
    name: "create_database_row",
    description: "Create a new row in a database",
    inputSchema: {
      type: "object" as const,
      properties: {
        databaseId: { type: "string", description: "Database ID" },
        title: { type: "string", description: "Row page title" },
        values: {
          type: "object",
          description: "Property values as key-value pairs",
        },
      },
      required: ["databaseId"],
    },
  },
  {
    name: "update_database_row",
    description: "Update a database row's values",
    inputSchema: {
      type: "object" as const,
      properties: {
        databaseId: { type: "string", description: "Database ID" },
        rowId: { type: "string", description: "Row ID" },
        title: { type: "string", description: "New page title" },
        values: {
          type: "object",
          description: "Property values to update",
        },
      },
      required: ["databaseId", "rowId"],
    },
  },
  {
    name: "get_block_children",
    description: "Get child blocks of a page or block",
    inputSchema: {
      type: "object" as const,
      properties: {
        blockId: { type: "string", description: "Page or block ID" },
      },
      required: ["blockId"],
    },
  },
  {
    name: "append_blocks",
    description: "Append child blocks to a page or block",
    inputSchema: {
      type: "object" as const,
      properties: {
        blockId: { type: "string", description: "Parent page or block ID" },
        children: {
          type: "array",
          description: "Array of block objects with type and content",
          items: {
            type: "object",
            properties: {
              type: { type: "string" },
              content: { type: "object" },
            },
            required: ["type"],
          },
        },
      },
      required: ["blockId", "children"],
    },
  },
  {
    name: "update_block",
    description: "Update a block's type or content",
    inputSchema: {
      type: "object" as const,
      properties: {
        blockId: { type: "string", description: "Block ID" },
        type: { type: "string", description: "New block type" },
        content: { type: "object", description: "New block content" },
      },
      required: ["blockId"],
    },
  },
  {
    name: "delete_block",
    description: "Delete a block",
    inputSchema: {
      type: "object" as const,
      properties: {
        blockId: { type: "string", description: "Block ID" },
      },
      required: ["blockId"],
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: unknown;

    switch (name) {
      case "search_pages":
        result = await api("/search", {
          method: "POST",
          body: JSON.stringify({ query: args?.query ?? "" }),
        });
        break;

      case "get_page":
        result = await api(`/pages/${args?.pageId}`);
        break;

      case "create_page":
        result = await api("/pages", {
          method: "POST",
          body: JSON.stringify({
            title: args?.title,
            parentId: args?.parentId,
            icon: args?.icon,
          }),
        });
        break;

      case "update_page":
        result = await api(`/pages/${args?.pageId}`, {
          method: "PATCH",
          body: JSON.stringify({
            title: args?.title,
            icon: args?.icon,
            cover: args?.cover,
          }),
        });
        break;

      case "delete_page":
        result = await api(`/pages/${args?.pageId}`, { method: "DELETE" });
        break;

      case "get_database":
        result = await api(`/databases/${args?.databaseId}`);
        break;

      case "query_database":
        result = await api(`/databases/${args?.databaseId}/query`, {
          method: "POST",
          body: JSON.stringify({}),
        });
        break;

      case "create_database_row":
        result = await api(`/databases/${args?.databaseId}/rows`, {
          method: "POST",
          body: JSON.stringify({
            title: args?.title ?? "",
            values: args?.values ?? {},
          }),
        });
        break;

      case "update_database_row":
        result = await api(
          `/databases/${args?.databaseId}/rows/${args?.rowId}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              title: args?.title,
              values: args?.values ?? {},
            }),
          }
        );
        break;

      case "get_block_children":
        result = await api(`/blocks/${args?.blockId}/children`);
        break;

      case "append_blocks":
        result = await api(`/blocks/${args?.blockId}/children`, {
          method: "POST",
          body: JSON.stringify({ children: args?.children ?? [] }),
        });
        break;

      case "update_block":
        result = await api(`/blocks/${args?.blockId}`, {
          method: "PATCH",
          body: JSON.stringify({
            type: args?.type,
            content: args?.content,
          }),
        });
        break;

      case "delete_block":
        result = await api(`/blocks/${args?.blockId}`, { method: "DELETE" });
        break;

      default:
        return {
          content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }

    return {
      content: [
        { type: "text" as const, text: JSON.stringify(result, null, 2) },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text" as const, text: `Error: ${message}` }],
      isError: true,
    };
  }
});

// ── Resources ───────────────────────────────────────────────────

const RESOURCES = [
  {
    uri: "workspace://pages",
    name: "All Pages",
    description: "List all pages in the workspace",
    mimeType: "application/json",
  },
  {
    uri: "workspace://databases",
    name: "All Databases",
    description: "List all databases in the workspace",
    mimeType: "application/json",
  },
];

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return { resources: RESOURCES };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  if (uri === "workspace://pages") {
    const data = await api("/pages");
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }

  if (uri === "workspace://databases") {
    const data = await api("/databases");
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }

  // page://{id}
  const pageMatch = uri.match(/^page:\/\/(.+)$/);
  if (pageMatch) {
    const pageId = pageMatch[1];
    const data = await api(`/pages/${pageId}`);
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }

  throw new Error(`Unknown resource: ${uri}`);
});

// ── Start ───────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Notion Clone MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Failed to start MCP server:", error);
  process.exit(1);
});
