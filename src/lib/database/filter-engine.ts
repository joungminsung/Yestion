import type { FilterGroup, FilterCondition, RowData } from "@/types/database";

/**
 * Client-side filter: takes rows + FilterGroup and returns matching rows.
 */
export function filterRows(
  rows: RowData[],
  filter: FilterGroup | undefined,
): RowData[] {
  if (!filter || filter.conditions.length === 0) return rows;

  return rows.filter((row) => evaluateGroup(row, filter));
}

function evaluateGroup(row: RowData, group: FilterGroup): boolean {
  const results = group.conditions.map((cond) => {
    // Nested FilterGroup has an `operator` property ("and" | "or")
    if ("operator" in cond && "conditions" in cond) {
      return evaluateGroup(row, cond as FilterGroup);
    }
    return matchCondition(row, cond as FilterCondition);
  });

  return group.operator === "and"
    ? results.every(Boolean)
    : results.some(Boolean);
}

function matchCondition(row: RowData, condition: FilterCondition): boolean {
  const value = row.values[condition.propertyId];
  const target = condition.value;

  switch (condition.operator) {
    case "equals":
      return String(value ?? "") === String(target ?? "");
    case "does_not_equal":
      return String(value ?? "") !== String(target ?? "");
    case "contains":
      return String(value ?? "")
        .toLowerCase()
        .includes(String(target ?? "").toLowerCase());
    case "does_not_contain":
      return !String(value ?? "")
        .toLowerCase()
        .includes(String(target ?? "").toLowerCase());
    case "starts_with":
      return String(value ?? "")
        .toLowerCase()
        .startsWith(String(target ?? "").toLowerCase());
    case "ends_with":
      return String(value ?? "")
        .toLowerCase()
        .endsWith(String(target ?? "").toLowerCase());
    case "is_empty":
      return value === null || value === undefined || value === "";
    case "is_not_empty":
      return value !== null && value !== undefined && value !== "";
    case "greater_than":
      return Number(value) > Number(target);
    case "less_than":
      return Number(value) < Number(target);
    case "greater_than_or_equal":
      return Number(value) >= Number(target);
    case "less_than_or_equal":
      return Number(value) <= Number(target);
    case "before":
      return new Date(String(value)).getTime() < new Date(String(target)).getTime();
    case "after":
      return new Date(String(value)).getTime() > new Date(String(target)).getTime();
    case "on_or_before":
      return new Date(String(value)).getTime() <= new Date(String(target)).getTime();
    case "on_or_after":
      return new Date(String(value)).getTime() >= new Date(String(target)).getTime();
    default:
      return true;
  }
}
