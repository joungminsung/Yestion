/**
 * CSV parsing and type detection utilities for database import.
 */

export function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseRow = (line: string): string[] => {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (char === "," && !inQuotes) {
        cells.push(current.trim());
        current = "";
        continue;
      }
      current += char;
    }
    cells.push(current.trim());
    return cells;
  };

  const headers = parseRow(lines[0]!);
  const rows = lines.slice(1).map(parseRow);
  return { headers, rows };
}

export function detectPropertyType(values: string[]): string {
  const nonEmpty = values.filter((v) => v);
  if (nonEmpty.length === 0) return "text";
  if (nonEmpty.every((v) => !isNaN(Number(v)))) return "number";
  if (nonEmpty.every((v) => !isNaN(Date.parse(v)))) return "date";
  if (nonEmpty.every((v) => v === "true" || v === "false")) return "checkbox";
  if (nonEmpty.every((v) => /^https?:\/\//.test(v))) return "url";
  return "text";
}
