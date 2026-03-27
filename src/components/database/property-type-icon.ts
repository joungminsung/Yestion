import type { PropertyType } from "@/types/database";

/** Single source of truth for property type icons */
export function propertyTypeIcon(type: PropertyType | string): string {
  const icons: Record<string, string> = {
    title: "Aa",
    text: "T",
    number: "#",
    select: "\u25BC",
    multi_select: "\u25A4",
    date: "\uD83D\uDCC5",
    person: "\uD83D\uDC64",
    file: "\uD83D\uDCCE",
    files: "\uD83D\uDCCE",
    checkbox: "\u2611",
    url: "\uD83D\uDD17",
    email: "\u2709",
    phone: "\uD83D\uDCDE",
    formula: "\u0192",
    relation: "\u2194",
    rollup: "\u2211",
    created_time: "\uD83D\uDD52",
    created_by: "\uD83D\uDC64",
    last_edited_time: "\uD83D\uDD52",
    last_edited_by: "\uD83D\uDC64",
    status: "\u25CF",
  };
  return icons[type] || "?";
}
