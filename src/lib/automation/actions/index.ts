import type {
  ActionType,
  ActionDefinition,
  ActionConfig,
  AutomationContext,
  ActionResult,
} from "../types";

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
    const response = await fetch(String(config.url), {
      method: String(config.method || "POST"),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        automation: "notion-web",
        timestamp: new Date().toISOString(),
        data: context.triggerData,
      }),
    });
    if (!response.ok) {
      return {
        type: "call_webhook",
        success: false,
        error: `HTTP ${response.status}`,
      };
    }
    return { type: "call_webhook", success: true };
  }
);
