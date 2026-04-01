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

    switch (condition.operator) {
      case "equals":
        return fieldValue === condition.value;
      case "not_equals":
        return fieldValue !== condition.value;
      case "contains":
        return typeof fieldValue === "string" && typeof condition.value === "string"
          ? fieldValue.includes(condition.value)
          : Array.isArray(fieldValue) && condition.value !== undefined
            ? fieldValue.includes(condition.value)
            : false;
      case "not_contains":
        return typeof fieldValue === "string" && typeof condition.value === "string"
          ? !fieldValue.includes(condition.value)
          : Array.isArray(fieldValue) && condition.value !== undefined
            ? !fieldValue.includes(condition.value)
            : true;
      case "gt":
        return typeof fieldValue === "number" && typeof condition.value === "number"
          ? fieldValue > condition.value
          : false;
      case "gte":
        return typeof fieldValue === "number" && typeof condition.value === "number"
          ? fieldValue >= condition.value
          : false;
      case "lt":
        return typeof fieldValue === "number" && typeof condition.value === "number"
          ? fieldValue < condition.value
          : false;
      case "lte":
        return typeof fieldValue === "number" && typeof condition.value === "number"
          ? fieldValue <= condition.value
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
