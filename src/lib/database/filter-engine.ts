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
      if (value == null || value === "") return false;
      return new Date(String(value)).getTime() < new Date(String(target)).getTime();
    case "after":
      if (value == null || value === "") return false;
      return new Date(String(value)).getTime() > new Date(String(target)).getTime();
    case "on_or_before":
      if (value == null || value === "") return false;
      return new Date(String(value)).getTime() <= new Date(String(target)).getTime();
    case "on_or_after":
      if (value == null || value === "") return false;
      return new Date(String(value)).getTime() >= new Date(String(target)).getTime();
    // Relative date operators
    case "is_today": {
      if (value == null || value === "") return false;
      const d = new Date(String(value));
      const now = new Date();
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    }
    case "is_yesterday": {
      if (value == null || value === "") return false;
      const d = new Date(String(value));
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      return d.getFullYear() === yesterday.getFullYear() && d.getMonth() === yesterday.getMonth() && d.getDate() === yesterday.getDate();
    }
    case "is_this_week": {
      if (value == null || value === "") return false;
      const d = new Date(String(value));
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 7);
      return d.getTime() >= startOfWeek.getTime() && d.getTime() < endOfWeek.getTime();
    }
    case "is_last_week": {
      if (value == null || value === "") return false;
      const d = new Date(String(value));
      const now = new Date();
      const startOfThisWeek = new Date(now);
      startOfThisWeek.setDate(now.getDate() - now.getDay());
      startOfThisWeek.setHours(0, 0, 0, 0);
      const startOfLastWeek = new Date(startOfThisWeek);
      startOfLastWeek.setDate(startOfThisWeek.getDate() - 7);
      return d.getTime() >= startOfLastWeek.getTime() && d.getTime() < startOfThisWeek.getTime();
    }
    case "is_this_month": {
      if (value == null || value === "") return false;
      const d = new Date(String(value));
      const now = new Date();
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }
    case "is_last_month": {
      if (value == null || value === "") return false;
      const d = new Date(String(value));
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return d.getFullYear() === lastMonth.getFullYear() && d.getMonth() === lastMonth.getMonth();
    }
    case "is_last_7_days": {
      if (value == null || value === "") return false;
      const d = new Date(String(value));
      const now = new Date();
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(now.getDate() - 7);
      sevenDaysAgo.setHours(0, 0, 0, 0);
      return d.getTime() >= sevenDaysAgo.getTime() && d.getTime() <= now.getTime();
    }
    case "is_last_30_days": {
      if (value == null || value === "") return false;
      const d = new Date(String(value));
      const now = new Date();
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(now.getDate() - 30);
      thirtyDaysAgo.setHours(0, 0, 0, 0);
      return d.getTime() >= thirtyDaysAgo.getTime() && d.getTime() <= now.getTime();
    }
    case "is_next_7_days": {
      if (value == null || value === "") return false;
      const d = new Date(String(value));
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const sevenDaysLater = new Date(now);
      sevenDaysLater.setDate(now.getDate() + 7);
      return d.getTime() >= now.getTime() && d.getTime() <= sevenDaysLater.getTime();
    }
    case "is_next_30_days": {
      if (value == null || value === "") return false;
      const d = new Date(String(value));
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const thirtyDaysLater = new Date(now);
      thirtyDaysLater.setDate(now.getDate() + 30);
      return d.getTime() >= now.getTime() && d.getTime() <= thirtyDaysLater.getTime();
    }
    case "is_within_range": {
      if (value == null || value === "") return false;
      if (!Array.isArray(target) || target.length !== 2) return false;
      const d = new Date(String(value)).getTime();
      const start = new Date(String(target[0])).getTime();
      const end = new Date(String(target[1])).getTime();
      return d >= start && d <= end;
    }
    default:
      return true;
  }
}
