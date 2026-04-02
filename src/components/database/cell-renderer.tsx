"use client";

import { useMemo } from "react";
import { RollupCellRenderer } from "./rollup-cell-renderer";
import type { PropertyType, PropertyConfig, SelectOption } from "@/types/database";

type CellRendererProps = {
  value: unknown;
  type: PropertyType;
  config: PropertyConfig;
  rowId?: string;
};

/**
 * Read-only cell display, switching on property type.
 */
export function CellRenderer({ value, type, config, rowId }: CellRendererProps) {
  if (type === "rollup" && rowId) {
    return <RollupCellRenderer rowId={rowId} config={config} />;
  }

  const rendered = useMemo(
    () => renderByType(value, type, config),
    [value, type, config],
  );
  return <>{rendered}</>;
}

function renderByType(
  value: unknown,
  type: PropertyType,
  config: PropertyConfig,
): React.ReactNode {
  if (value === null || value === undefined || value === "") {
    return <span className="text-[var(--text-tertiary)]">&mdash;</span>;
  }

  switch (type) {
    case "title":
    case "text":
      return <span className="truncate">{String(value)}</span>;

    case "number":
      return <span className="font-mono">{formatNumber(Number(value), config)}</span>;

    case "select":
    case "status": {
      const option = findOption(String(value), config.options);
      return option ? (
        <SelectBadge option={option} />
      ) : (
        <span>{String(value)}</span>
      );
    }

    case "multi_select": {
      const ids = Array.isArray(value) ? value : String(value).split(",");
      return (
        <div className="flex flex-wrap gap-1">
          {ids.map((id: string) => {
            const option = findOption(id.trim(), config.options);
            return option ? (
              <SelectBadge key={option.id} option={option} />
            ) : (
              <span key={id} className="text-xs">{id}</span>
            );
          })}
        </div>
      );
    }

    case "date":
      return <span>{formatDate(String(value), config)}</span>;

    case "checkbox":
      return (
        <span className="text-base leading-none">
          {value === true ? "\u2611" : "\u2610"}
        </span>
      );

    case "url":
      return (
        <a
          href={String(value)}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate text-[#2383e2] underline hover:text-[#0b6ec5]"
        >
          {String(value)}
        </a>
      );

    case "email":
      return (
        <a
          href={`mailto:${String(value)}`}
          className="truncate text-[#2383e2] underline hover:text-[#0b6ec5]"
        >
          {String(value)}
        </a>
      );

    case "phone":
      return (
        <a
          href={`tel:${String(value)}`}
          className="truncate text-[#2383e2] underline hover:text-[#0b6ec5]"
        >
          {String(value)}
        </a>
      );

    case "person": {
      const name = typeof value === "object" && value !== null && "name" in value
        ? String((value as { name: string }).name)
        : String(value);
      return (
        <div className="flex items-center gap-1.5">
          <span
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#2383e2] text-[10px] font-medium text-white"
          >
            {name.charAt(0).toUpperCase()}
          </span>
          <span className="truncate text-sm">{name}</span>
        </div>
      );
    }

    case "created_time":
    case "last_edited_time":
      return <span className="text-[var(--text-secondary)]">{relativeDate(String(value))}</span>;

    case "created_by":
    case "last_edited_by": {
      const userName = typeof value === "object" && value !== null && "name" in value
        ? String((value as { name: string }).name)
        : String(value);
      return <span className="text-sm">{userName}</span>;
    }

    case "file": {
      const files = Array.isArray(value) ? value : [value];
      return (
        <div className="flex gap-1">
          {files.map((f, i) => (
            <span key={i} className="text-xs text-[#2383e2]">
              {typeof f === "string" ? f : "file"}
            </span>
          ))}
        </div>
      );
    }

    case "relation": {
      const ids = Array.isArray(value) ? value : [];
      if (ids.length === 0) return <span style={{ color: "var(--text-placeholder)" }}>&mdash;</span>;
      return (
        <div className="flex flex-wrap gap-1">
          {ids.map((id: string) => (
            <span
              key={id}
              className="px-1.5 py-0.5 rounded text-xs"
              style={{ backgroundColor: "var(--bg-secondary)" }}
            >
              {id.slice(0, 8)}
            </span>
          ))}
        </div>
      );
    }

    case "rollup":
      return <span style={{ color: "var(--text-tertiary)" }}>Rollup</span>;

    default:
      return <span className="truncate">{String(value)}</span>;
  }
}

// ── Helpers ───────────────────────────────────────────────────

function findOption(
  idOrName: string,
  options?: SelectOption[],
): SelectOption | undefined {
  if (!options) return undefined;
  return (
    options.find((o) => o.id === idOrName) ??
    options.find((o) => o.name === idOrName)
  );
}

function SelectBadge({ option }: { option: SelectOption }) {
  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: colorToBg(option.color),
        color: colorToText(option.color),
      }}
    >
      {option.name}
    </span>
  );
}

const COLOR_MAP: Record<string, { bg: string; text: string }> = {
  default: { bg: "#e3e2e0", text: "#37352f" },
  gray: { bg: "#e3e2e0", text: "#787774" },
  brown: { bg: "#eee0da", text: "#64473a" },
  orange: { bg: "#fadec9", text: "#d9730d" },
  yellow: { bg: "#fdecc8", text: "#cb912f" },
  green: { bg: "#dbeddb", text: "#448361" },
  blue: { bg: "#d3e5ef", text: "#2383e2" },
  purple: { bg: "#e8deee", text: "#9065b0" },
  pink: { bg: "#f5e0e9", text: "#c14c8a" },
  red: { bg: "#ffe2dd", text: "#d44c47" },
};

function colorToBg(color: string): string {
  return COLOR_MAP[color]?.bg ?? "#e3e2e0";
}

function colorToText(color: string): string {
  return COLOR_MAP[color]?.text ?? "#37352f";
}

function formatNumber(n: number, config: PropertyConfig): string {
  switch (config.numberFormat) {
    case "percent": return `${n}%`;
    case "dollar": return `$${n.toLocaleString()}`;
    case "euro": return `\u20AC${n.toLocaleString()}`;
    case "won": return `\u20A9${n.toLocaleString()}`;
    case "yen": return `\u00A5${n.toLocaleString()}`;
    case "pound": return `\u00A3${n.toLocaleString()}`;
    default: return n.toLocaleString();
  }
}

function formatDate(dateStr: string, config: PropertyConfig): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;

  if (config.dateFormat === "relative") return relativeDate(dateStr);

  const options: Intl.DateTimeFormatOptions =
    config.dateFormat === "short"
      ? { month: "short", day: "numeric", year: "numeric" }
      : { weekday: "long", month: "long", day: "numeric", year: "numeric" };

  if (config.includeTime) {
    options.hour = "numeric";
    options.minute = "2-digit";
  }

  return date.toLocaleDateString(undefined, options);
}

function relativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
