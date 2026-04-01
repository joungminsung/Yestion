import type {
  ActionType,
  ActionDefinition,
  ActionConfig,
  AutomationContext,
  ActionResult,
} from "../types";

/** Validate webhook URL to prevent SSRF attacks */
function validateWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Require HTTPS
    if (parsed.protocol !== "https:") return false;
    // Block private/internal hostnames
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "0.0.0.0" ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      /^10\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^169\.254\./.test(hostname)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Allowlist of task fields that automation is permitted to update */
const ALLOWED_TASK_FIELDS = new Set([
  "status",
  "priority",
  "assigneeId",
  "dueDate",
  "labels",
  "title",
]);

/** Action handler function type */
type ActionHandler = (
  config: ActionConfig,
  context: AutomationContext
) => Promise<ActionResult>;

/** Registry of all available actions */
const ACTION_REGISTRY = new Map<
  ActionType,
  { definition: ActionDefinition; handler: ActionHandler }
>();

/** Register an action — called by each action module */
export function registerAction(
  definition: ActionDefinition,
  handler: ActionHandler
) {
  ACTION_REGISTRY.set(definition.type, { definition, handler });
}

/** Get all registered action definitions (for UI) */
export function getActionDefinitions(): ActionDefinition[] {
  return Array.from(ACTION_REGISTRY.values()).map((a) => a.definition);
}

/** Execute an action by type */
export async function executeAction(
  type: ActionType,
  config: ActionConfig,
  context: AutomationContext
): Promise<ActionResult> {
  const entry = ACTION_REGISTRY.get(type);
  if (!entry) {
    return { type, success: false, error: `Unknown action type: ${type}` };
  }
  try {
    return await entry.handler(config, context);
  } catch (error) {
    return {
      type,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// --- Register built-in actions ---

registerAction(
  {
    type: "send_notification",
    label: "Send notification",
    description: "Send an in-app notification to a user",
    configSchema: {
      userId: { type: "string", label: "User ID", required: true },
      message: { type: "string", label: "Message", required: true },
    },
  },
  async (config, context) => {
    await context.db.notification.create({
      data: {
        userId: String(config.userId),
        type: "automation",
        title: "Automation",
        message: String(config.message),
        pageId: config.pageId ? String(config.pageId) : null,
      },
    });
    return { type: "send_notification", success: true };
  }
);

registerAction(
  {
    type: "update_property",
    label: "Update property",
    description: "Update a field on the triggered item",
    configSchema: {
      field: { type: "string", label: "Field name", required: true },
      value: { type: "string", label: "New value", required: true },
    },
  },
  async (config, context) => {
    if (!ALLOWED_TASK_FIELDS.has(String(config.field))) {
      return {
        type: "update_property" as const,
        success: false,
        error: `Field '${config.field}' is not allowed for automation updates`,
      };
    }
    // Generic property update — caller provides entity type in triggerData
    const entityType = context.triggerData.entityType as string;
    const entityId = context.triggerData.entityId as string;
    if (entityType === "task" && entityId) {
      await context.db.task.update({
        where: { id: entityId },
        data: { [String(config.field)]: config.value },
      });
    }
    return { type: "update_property", success: true };
  }
);

registerAction(
  {
    type: "create_task",
    label: "Create task",
    description: "Create a new task in a project",
    configSchema: {
      projectId: { type: "string", label: "Project ID", required: true },
      title: { type: "string", label: "Task title", required: true },
      status: { type: "string", label: "Status" },
      priority: { type: "string", label: "Priority" },
    },
  },
  async (config, context) => {
    const task = await context.db.task.create({
      data: {
        projectId: String(config.projectId),
        title: String(config.title),
        status: String(config.status || "todo"),
        priority: String(config.priority || "medium"),
        reporterId: context.userId,
      },
    });
    return { type: "create_task", success: true, data: { taskId: task.id } };
  }
);

registerAction(
  {
    type: "call_webhook",
    label: "Call webhook",
    description: "Send an HTTP request to an external URL",
    configSchema: {
      url: { type: "string", label: "Webhook URL", required: true },
      method: { type: "string", label: "HTTP method" },
    },
  },
  async (config, context) => {
    const url = String(config.url);
    if (!validateWebhookUrl(url)) {
      return {
        type: "call_webhook" as const,
        success: false,
        error: "Invalid or blocked URL. Only HTTPS URLs to public hosts are allowed.",
      };
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(url, {
        method: String(config.method || "POST"),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          automation: "notion-web",
          timestamp: new Date().toISOString(),
          data: context.triggerData,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!response.ok) {
        return {
          type: "call_webhook" as const,
          success: false,
          error: `HTTP ${response.status}`,
        };
      }
      return { type: "call_webhook", success: true };
    } catch (err) {
      clearTimeout(timeout);
      return {
        type: "call_webhook" as const,
        success: false,
        error: err instanceof Error ? err.message : "Request failed",
      };
    }
  }
);
