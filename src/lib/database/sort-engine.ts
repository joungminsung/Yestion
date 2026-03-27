import type { SortRule, RowData } from "@/types/database";

/**
 * Client-side sort: takes rows + SortRule[] + property type map and returns sorted rows.
 * Does not mutate the original array.
 */
export function sortRows(
  rows: RowData[],
  sorts: SortRule[] | undefined,
  propertyTypes: Record<string, string>,
): RowData[] {
  if (!sorts || sorts.length === 0) return rows;

  return [...rows].sort((a, b) => {
    for (const sort of sorts) {
      const aVal = a.values[sort.propertyId];
      const bVal = b.values[sort.propertyId];
      const type = propertyTypes[sort.propertyId] || "text";
      const cmp = compareValues(aVal, bVal, type);
      if (cmp !== 0) return sort.direction === "asc" ? cmp : -cmp;
    }
    return 0;
  });
}

function compareValues(a: unknown, b: unknown, type: string): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;

  switch (type) {
    case "number":
      return Number(a) - Number(b);
    case "date":
    case "created_time":
    case "last_edited_time":
      return new Date(String(a)).getTime() - new Date(String(b)).getTime();
    case "checkbox":
      return (a === true ? 1 : 0) - (b === true ? 1 : 0);
    default:
      return String(a).localeCompare(String(b));
  }
}
