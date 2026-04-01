import type { TriggerType, TriggerDefinition } from "../types";

/** Registry of all available triggers */
const TRIGGER_REGISTRY = new Map<TriggerType, TriggerDefinition>();

/** Register a trigger definition */
export function registerTrigger(definition: TriggerDefinition) {
  TRIGGER_REGISTRY.set(definition.type, definition);
}

/** Get all registered trigger definitions (for UI) */
export function getTriggerDefinitions(): TriggerDefinition[] {
  return Array.from(TRIGGER_REGISTRY.values());
}

/** Check if a trigger type exists */
export function hasTrigger(type: string): boolean {
  return TRIGGER_REGISTRY.has(type as TriggerType);
}

// --- Register built-in triggers ---

registerTrigger({
  type: "task.status_changed",
  label: "Task status changed",
  description: "When a task's status changes",
  configSchema: {
    projectId: { type: "string", label: "Project" },
    fromStatus: { type: "string", label: "From status" },
    toStatus: { type: "string", label: "To status" },
  },
});

registerTrigger({
  type: "task.assigned",
  label: "Task assigned",
  description: "When a task is assigned to someone",
  configSchema: {
    projectId: { type: "string", label: "Project" },
  },
});

registerTrigger({
  type: "page.created",
  label: "Page created",
  description: "When a new page is created",
  configSchema: {
    parentId: { type: "string", label: "Parent page (optional)" },
  },
});

registerTrigger({
  type: "page.updated",
  label: "Page updated",
  description: "When a page is modified",
  configSchema: {},
});

registerTrigger({
  type: "comment.created",
  label: "Comment created",
  description: "When a comment is posted",
  configSchema: {
    pageId: { type: "string", label: "On page (optional)" },
  },
});

registerTrigger({
  type: "member.joined",
  label: "Member joined",
  description: "When a new member joins the workspace",
  configSchema: {},
});

registerTrigger({
  type: "database.row_created",
  label: "Database row created",
  description: "When a new row is added to a database",
  configSchema: {
    databaseId: { type: "string", label: "Database", required: true },
  },
});

registerTrigger({
  type: "webhook.received",
  label: "Webhook received",
  description: "When an external webhook is received",
  configSchema: {
    path: { type: "string", label: "Webhook path", required: true },
  },
});
