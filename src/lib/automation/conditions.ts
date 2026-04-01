import type { Condition } from "./types";

/**
 * Evaluate a list of conditions against a data object.
 * All conditions must pass (AND logic).
 */
export function evaluateConditions(
  conditions: Condition[],
  data: Record<string, unknown>
): boolean {
  if (conditions.length === 0) return true;

  return conditions.every((condition) => {
    const fieldValue = data[condition.field];

    // Coerce string values for numeric operators
    let conditionValue = condition.value;
    if (
      ["gt", "gte", "lt", "lte"].includes(condition.operator) &&
      typeof conditionValue === "string"
    ) {
      const parsed = Number(conditionValue);
      if (!isNaN(parsed)) conditionValue = parsed;
    }
    if (
      condition.operator === "equals" ||
      condition.operator === "not_equals"
    ) {
      // Loose comparison for equals to handle string/number mismatch
      if (typeof fieldValue === "number" && typeof conditionValue === "string") {
        const parsed = Number(conditionValue);
        if (!isNaN(parsed)) conditionValue = parsed;
      }
    }

    switch (condition.operator) {
      case "equals":
        return fieldValue === conditionValue;
      case "not_equals":
        return fieldValue !== conditionValue;
      case "contains":
        return typeof fieldValue === "string" && typeof conditionValue === "string"
          ? fieldValue.includes(conditionValue)
          : Array.isArray(fieldValue) && conditionValue !== undefined
            ? fieldValue.includes(conditionValue)
            : false;
      case "not_contains":
        return typeof fieldValue === "string" && typeof conditionValue === "string"
          ? !fieldValue.includes(conditionValue)
          : Array.isArray(fieldValue) && conditionValue !== undefined
            ? !fieldValue.includes(conditionValue)
            : true;
      case "gt":
        return typeof fieldValue === "number" && typeof conditionValue === "number"
          ? fieldValue > conditionValue
          : false;
      case "gte":
        return typeof fieldValue === "number" && typeof conditionValue === "number"
          ? fieldValue >= conditionValue
          : false;
      case "lt":
        return typeof fieldValue === "number" && typeof conditionValue === "number"
          ? fieldValue < conditionValue
          : false;
      case "lte":
        return typeof fieldValue === "number" && typeof conditionValue === "number"
          ? fieldValue <= conditionValue
          : false;
      case "is_empty":
        return (
          fieldValue === null ||
          fieldValue === undefined ||
          fieldValue === "" ||
          (Array.isArray(fieldValue) && fieldValue.length === 0)
        );
      case "is_not_empty":
        return (
          fieldValue !== null &&
          fieldValue !== undefined &&
          fieldValue !== "" &&
          !(Array.isArray(fieldValue) && fieldValue.length === 0)
        );
      case "in":
        return Array.isArray(condition.value) && condition.value.includes(fieldValue);
      case "not_in":
        return Array.isArray(condition.value) && !condition.value.includes(fieldValue);
      default:
        return false;
    }
  });
}
