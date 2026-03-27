"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { PropertyType, PropertyConfig, SelectOption } from "@/types/database";

type CellEditorProps = {
  value: unknown;
  type: PropertyType;
  config: PropertyConfig;
  onChange: (value: unknown) => void;
  onClose: () => void;
};

/**
 * Inline cell editor, switching on property type.
 */
export function CellEditor({ value, type, config, onChange, onClose }: CellEditorProps) {
  switch (type) {
    case "title":
    case "text":
    case "url":
    case "email":
    case "phone":
      return (
        <TextCellEditor
          value={String(value ?? "")}
          onChange={onChange}
          onClose={onClose}
          inputType={type === "email" ? "email" : type === "url" ? "url" : "text"}
        />
      );

    case "number":
      return (
        <NumberCellEditor
          value={value != null ? Number(value) : undefined}
          onChange={onChange}
          onClose={onClose}
        />
      );

    case "select":
    case "status":
      return (
        <SelectCellEditor
          value={String(value ?? "")}
          options={config.options ?? []}
          onChange={onChange}
          onClose={onClose}
        />
      );

    case "multi_select":
      return (
        <MultiSelectCellEditor
          value={Array.isArray(value) ? value : []}
          options={config.options ?? []}
          onChange={onChange}
          onClose={onClose}
        />
      );

    case "date":
      return (
        <DateCellEditor
          value={String(value ?? "")}
          includeTime={config.includeTime}
          onChange={onChange}
          onClose={onClose}
        />
      );

    case "checkbox":
      return (
        <CheckboxCellEditor
          value={value === true}
          onChange={onChange}
          onClose={onClose}
        />
      );

    default:
      return (
        <TextCellEditor
          value={String(value ?? "")}
          onChange={onChange}
          onClose={onClose}
        />
      );
  }
}

// ── Text Editor ─────────────────────────────────────────────

function TextCellEditor({
  value,
  onChange,
  onClose,
  inputType = "text",
}: {
  value: string;
  onChange: (v: unknown) => void;
  onClose: () => void;
  inputType?: string;
}) {
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const commit = useCallback(() => {
    onChange(localValue);
    onClose();
  }, [localValue, onChange, onClose]);

  return (
    <input
      ref={inputRef}
      type={inputType}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") onClose();
      }}
      className="w-full rounded border px-2 py-1 text-sm outline-none focus:border-[#2383e2]"
      style={{
        backgroundColor: "var(--bg-primary)",
        borderColor: "var(--border-default)",
        color: "var(--text-primary)",
      }}
    />
  );
}

// ── Number Editor ───────────────────────────────────────────

function NumberCellEditor({
  value,
  onChange,
  onClose,
}: {
  value: number | undefined;
  onChange: (v: unknown) => void;
  onClose: () => void;
}) {
  const [localValue, setLocalValue] = useState(value?.toString() ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const commit = useCallback(() => {
    const parsed = parseFloat(localValue);
    onChange(isNaN(parsed) ? null : parsed);
    onClose();
  }, [localValue, onChange, onClose]);

  return (
    <input
      ref={inputRef}
      type="number"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") onClose();
      }}
      className="w-full rounded border px-2 py-1 text-sm outline-none focus:border-[#2383e2]"
      style={{
        backgroundColor: "var(--bg-primary)",
        borderColor: "var(--border-default)",
        color: "var(--text-primary)",
      }}
    />
  );
}

// ── Select Editor ───────────────────────────────────────────

function SelectCellEditor({
  value,
  options,
  onChange,
  onClose,
}: {
  value: string;
  options: SelectOption[];
  onChange: (v: unknown) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = options.filter((o) =>
    o.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div
      className="rounded border shadow-lg"
      style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--border-default)" }}
    >
      <input
        ref={inputRef}
        type="text"
        placeholder="Search..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
        className="w-full border-b px-2 py-1.5 text-sm outline-none"
        style={{
          backgroundColor: "transparent",
          borderColor: "var(--border-default)",
          color: "var(--text-primary)",
        }}
      />
      <div className="max-h-[200px] overflow-y-auto py-1">
        {/* Clear option */}
        <button
          onClick={() => { onChange(""); onClose(); }}
          className="w-full px-2 py-1 text-left text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
        >
          Clear
        </button>
        {filtered.map((option) => (
          <button
            key={option.id}
            onClick={() => { onChange(option.id); onClose(); }}
            className={`flex w-full items-center gap-2 px-2 py-1 text-left text-sm hover:bg-[var(--bg-hover)] ${
              value === option.id ? "bg-[var(--bg-hover)]" : ""
            }`}
          >
            <OptionBadge option={option} />
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Multi-Select Editor ─────────────────────────────────────

function MultiSelectCellEditor({
  value,
  options,
  onChange,
  onClose,
}: {
  value: string[];
  options: SelectOption[];
  onChange: (v: unknown) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string[]>(value);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = options.filter((o) =>
    o.name.toLowerCase().includes(search.toLowerCase()),
  );

  const toggle = (id: string) => {
    const next = selected.includes(id)
      ? selected.filter((s) => s !== id)
      : [...selected, id];
    setSelected(next);
    onChange(next);
  };

  return (
    <div
      className="rounded border shadow-lg"
      style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--border-default)" }}
    >
      {/* Selected tags */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 border-b p-1.5" style={{ borderColor: "var(--border-default)" }}>
          {selected.map((id) => {
            const opt = options.find((o) => o.id === id);
            return opt ? (
              <OptionBadge key={id} option={opt} onRemove={() => toggle(id)} />
            ) : null;
          })}
        </div>
      )}
      <input
        ref={inputRef}
        type="text"
        placeholder="Search..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
        className="w-full border-b px-2 py-1.5 text-sm outline-none"
        style={{
          backgroundColor: "transparent",
          borderColor: "var(--border-default)",
          color: "var(--text-primary)",
        }}
      />
      <div className="max-h-[200px] overflow-y-auto py-1">
        {filtered.map((option) => (
          <button
            key={option.id}
            onClick={() => toggle(option.id)}
            className="flex w-full items-center gap-2 px-2 py-1 text-left text-sm hover:bg-[var(--bg-hover)]"
          >
            <span className="text-xs">
              {selected.includes(option.id) ? "\u2611" : "\u2610"}
            </span>
            <OptionBadge option={option} />
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Date Editor ─────────────────────────────────────────────

function DateCellEditor({
  value,
  includeTime,
  onChange,
  onClose,
}: {
  value: string;
  includeTime?: boolean;
  onChange: (v: unknown) => void;
  onClose: () => void;
}) {
  const [localValue, setLocalValue] = useState(() => {
    if (!value) return "";
    const date = new Date(value);
    if (isNaN(date.getTime())) return "";
    // Format for input type="date" or "datetime-local"
    if (includeTime) {
      return date.toISOString().slice(0, 16);
    }
    return date.toISOString().slice(0, 10);
  });

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const commit = useCallback(() => {
    onChange(localValue || null);
    onClose();
  }, [localValue, onChange, onClose]);

  return (
    <input
      ref={inputRef}
      type={includeTime ? "datetime-local" : "date"}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") onClose();
      }}
      className="w-full rounded border px-2 py-1 text-sm outline-none focus:border-[#2383e2]"
      style={{
        backgroundColor: "var(--bg-primary)",
        borderColor: "var(--border-default)",
        color: "var(--text-primary)",
      }}
    />
  );
}

// ── Checkbox Editor ─────────────────────────────────────────

function CheckboxCellEditor({
  value,
  onChange,
  onClose,
}: {
  value: boolean;
  onChange: (v: unknown) => void;
  onClose: () => void;
}) {
  // Toggle immediately
  useEffect(() => {
    onChange(!value);
    onClose();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

// ── Shared Components ───────────────────────────────────────

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

function OptionBadge({
  option,
  onRemove,
}: {
  option: SelectOption;
  onRemove?: () => void;
}) {
  const colors = COLOR_MAP[option.color] ?? COLOR_MAP.default;
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: colors.bg, color: colors.text }}
    >
      {option.name}
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="ml-0.5 opacity-60 hover:opacity-100"
        >
          x
        </button>
      )}
    </span>
  );
}
