import type { ActionConfig, ActionType, AutomationContext, Condition } from "./types";
import { evaluateConditions } from "./conditions";
import { executeAction } from "./actions";

// Import registries to ensure built-in triggers/actions are registered
import "./triggers";
import "./actions";

type AutomationRule = {
  id: string;
  name: string;
  isEnabled: boolean;
  trigger: { type: string; config: Record<string, unknown> };
  conditions: Condition[];
  actions: { type: ActionType; config: ActionConfig }[];
};

/**
 * Process an event against all matching automations.
 * Called from tRPC mutation hooks when events occur.
 *
 * @returns Array of execution results
 */
export async function processAutomationEvent(
  db: any,
  workspaceId: string,
  eventType: string,
  eventData: Record<string, unknown>,
  userId: string
): Promise<{ automationId: string; success: boolean; error?: string }[]> {
  // Find all enabled automations for this workspace matching the trigger type
  const automations = await db.automation.findMany({
    where: {
      workspaceId,
      isEnabled: true,
      trigger: { path: ["type"], equals: eventType },
    },
  });

  const results: { automationId: string; success: boolean; error?: string }[] =
    [];

  for (const automation of automations) {
    const rule: AutomationRule = {
      id: automation.id,
      name: automation.name,
      isEnabled: automation.isEnabled,
      trigger: automation.trigger as AutomationRule["trigger"],
      conditions: (automation.conditions as Condition[]) ?? [],
      actions: (automation.actions as AutomationRule["actions"]) ?? [],
    };

    // Check conditions
    if (!evaluateConditions(rule.conditions, eventData)) {
      continue;
    }

    const context: AutomationContext = {
      workspaceId,
      userId,
      triggerData: eventData,
      db,
    };

    // Execute all actions
    const actionResults = [];
    let allSuccess = true;
    let firstError: string | undefined;

    for (const action of rule.actions) {
      const result = await executeAction(action.type, action.config, context);
      actionResults.push(result);
      if (!result.success) {
        allSuccess = false;
        if (!firstError) firstError = result.error;
      }
    }

    // Log the execution
    await db.automationLog.create({
      data: {
        automationId: automation.id,
        triggeredBy: userId,
        triggerData: eventData,
        actionsExecuted: actionResults,
        status: allSuccess
          ? "success"
          : actionResults.some((r) => r.success)
            ? "partial"
            : "failed",
        error: firstError,
      },
    });

    // Update trigger count and timestamp
    await db.automation.update({
      where: { id: automation.id },
      data: {
        triggerCount: { increment: 1 },
        lastTriggered: new Date(),
      },
    });

    results.push({
      automationId: automation.id,
      success: allSuccess,
      error: firstError,
    });
  }

  return results;
}
