/** Trigger definition — what event starts the automation */
export type TriggerType =
  | "page.created"
  | "page.updated"
  | "database.row_created"
  | "database.row_updated"
  | "database.property_changed"
  | "task.status_changed"
  | "task.assigned"
  | "task.overdue"
  | "comment.created"
  | "member.joined"
  | "schedule.cron"
  | "webhook.received";

export type TriggerConfig = Record<string, unknown>;

export type TriggerDefinition = {
  type: TriggerType;
  label: string;
  description: string;
  configSchema: Record<string, { type: string; label: string; required?: boolean }>;
};

/** Condition — filter when trigger fires */
export type ConditionOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "is_empty"
  | "is_not_empty"
  | "in"
  | "not_in";

export type Condition = {
  field: string;
  operator: ConditionOperator;
  value?: unknown;
};

/** Action — what to do when triggered */
export type ActionType =
  | "send_notification"
  | "update_property"
  | "assign_user"
  | "add_label"
  | "create_task"
  | "create_page"
  | "call_webhook"
  | "send_email"
  | "post_comment";

export type ActionConfig = Record<string, unknown>;

export type ActionDefinition = {
  type: ActionType;
  label: string;
  description: string;
  configSchema: Record<string, { type: string; label: string; required?: boolean }>;
};

/** Runtime context passed to triggers/actions */
export type AutomationContext = {
  workspaceId: string;
  userId: string;
  triggerData: Record<string, unknown>;
  // Using 'any' because this accepts both PrismaClient and transaction clients
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
};

/** Result of executing an action */
export type ActionResult = {
  type: ActionType;
  success: boolean;
  error?: string;
  data?: unknown;
};
