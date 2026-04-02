"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormulaEditor } from "./formula-editor";
import type { PropertyType, PropertyConfig, SelectOption, DatabaseData } from "@/types/database";

type PropertyEditorProps = {
  property: {
    id: string;
    name: string;
    type: PropertyType;
    config: PropertyConfig;
    isVisible: boolean;
  };
  onUpdate: (updates: {
    name?: string;
    type?: PropertyType;
    config?: PropertyConfig;
    isVisible?: boolean;
  }) => void;
  onDelete: () => void;
  onClose: () => void;
  /** All database properties, needed for formula editor autocomplete */
  allProperties?: DatabaseData["properties"];
};

const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
  { value: "title", label: "Title" },
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "select", label: "Select" },
  { value: "multi_select", label: "Multi-select" },
  { value: "status", label: "Status" },
  { value: "date", label: "Date" },
  { value: "person", label: "Person" },
  { value: "file", label: "File" },
  { value: "checkbox", label: "Checkbox" },
  { value: "url", label: "URL" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "created_time", label: "Created time" },
  { value: "created_by", label: "Created by" },
  { value: "last_edited_time", label: "Last edited time" },
  { value: "last_edited_by", label: "Last edited by" },
  { value: "formula", label: "Formula" },
  { value: "relation", label: "Relation" },
  { value: "rollup", label: "Rollup" },
];

/**
 * Popover for editing a database property: name, type, config, visibility, delete.
 */
export function PropertyEditor({
  property,
  onUpdate,
  onDelete,
  onClose,
  allProperties,
}: PropertyEditorProps) {
  const [name, setName] = useState(property.name);
  const [type, setType] = useState<PropertyType>(property.type);
  const [config, setConfig] = useState<PropertyConfig>(property.config);
  const [isVisible, setIsVisible] = useState(property.isVisible);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
    nameRef.current?.select();
  }, []);

  const handleSave = useCallback(() => {
    onUpdate({ name, type, config, isVisible });
    onClose();
  }, [name, type, config, isVisible, onUpdate, onClose]);

  const handleTypeChange = (newType: PropertyType) => {
    setType(newType);
    // Reset config when type changes — clear irrelevant config from previous type
    if (newType === "select" || newType === "multi_select" || newType === "status") {
      setConfig({ options: config.options ?? [] });
    } else if (newType === "formula") {
      setConfig({ formula: config.formula ?? "" });
    } else if (newType === "relation") {
      setConfig({ relationDbId: config.relationDbId });
    } else {
      setConfig({});
    }
  };

  const hasSelectOptions =
    type === "select" || type === "multi_select" || type === "status";

  const isTitleType = property.type === "title";

  return (
    <div
      className="w-[280px] rounded-lg border shadow-lg"
      style={{
        backgroundColor: "var(--bg-primary)",
        borderColor: "var(--border-default)",
      }}
    >
      {/* Header */}
      <div className="border-b p-3" style={{ borderColor: "var(--border-default)" }}>
        <Input
          ref={nameRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Property name"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") onClose();
          }}
        />
      </div>

      {/* Type selector */}
      <div className="border-b p-2" style={{ borderColor: "var(--border-default)" }}>
        <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
          Type
        </label>
        <select
          value={type}
          onChange={(e) => handleTypeChange(e.target.value as PropertyType)}
          disabled={isTitleType}
          className="w-full rounded border px-2 py-1.5 text-sm outline-none disabled:opacity-50"
          style={{
            backgroundColor: "var(--bg-primary)",
            borderColor: "var(--border-default)",
            color: "var(--text-primary)",
          }}
        >
          {PROPERTY_TYPES.map((pt) => (
            <option key={pt.value} value={pt.value}>
              {pt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Select options config */}
      {hasSelectOptions && (
        <div className="border-b p-2" style={{ borderColor: "var(--border-default)" }}>
          <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
            Options
          </label>
          <OptionsList
            options={config.options ?? []}
            onChange={(options) => setConfig({ ...config, options })}
          />
        </div>
      )}

      {/* Formula config */}
      {type === "formula" && (
        <div className="border-b p-2" style={{ borderColor: "var(--border-default)" }}>
          <FormulaEditor
            formula={config.formula ?? ""}
            properties={allProperties ?? []}
            config={config}
            onChange={(formula) => setConfig({ ...config, formula })}
          />
        </div>
      )}

      {/* Relation config */}
      {type === "relation" && (
        <div className="border-b p-2" style={{ borderColor: "var(--border-default)" }}>
          <div className="space-y-2">
            <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              Related Database
            </label>
            <input
              type="text"
              value={(config.relatedDatabaseId as string) || ""}
              onChange={(e) =>
                setConfig({ ...config, relatedDatabaseId: e.target.value })
              }
              placeholder="Enter database ID..."
              className="w-full px-2 py-1.5 rounded border text-sm bg-transparent outline-none"
              style={{
                color: "var(--text-primary)",
                borderColor: "var(--border-default)",
              }}
            />
            <p className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
              Paste the target database ID to create a relation
            </p>
          </div>
        </div>
      )}

      {/* Visibility toggle */}
      <div className="flex items-center justify-between border-b p-2" style={{ borderColor: "var(--border-default)" }}>
        <span className="text-sm text-[var(--text-primary)]">Visible</span>
        <button
          onClick={() => setIsVisible(!isVisible)}
          className="text-lg leading-none"
        >
          {isVisible ? "\u2611" : "\u2610"}
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between p-2">
        {!isTitleType && !showDeleteConfirm && (
          <Button
            variant="ghost"
            size="sm"
            className="text-red-500 hover:text-red-600"
            onClick={() => setShowDeleteConfirm(true)}
          >
            Delete property
          </Button>
        )}
        {showDeleteConfirm && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500"
              onClick={() => {
                onDelete();
                onClose();
              }}
            >
              Confirm delete
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDeleteConfirm(false)}
            >
              Cancel
            </Button>
          </div>
        )}
        {isTitleType && <div />}
        <Button variant="primary" size="sm" onClick={handleSave}>
          Save
        </Button>
      </div>
    </div>
  );
}

// ── Options List Editor ─────────────────────────────────────

const OPTION_COLORS = [
  "default", "gray", "brown", "orange", "yellow",
  "green", "blue", "purple", "pink", "red",
];

function OptionsList({
  options,
  onChange,
}: {
  options: SelectOption[];
  onChange: (options: SelectOption[]) => void;
}) {
  const [newName, setNewName] = useState("");

  const addOption = () => {
    if (!newName.trim()) return;
    const id = `opt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const color = OPTION_COLORS[options.length % OPTION_COLORS.length] ?? "default";
    onChange([...options, { id, name: newName.trim(), color }]);
    setNewName("");
  };

  const removeOption = (id: string) => {
    onChange(options.filter((o) => o.id !== id));
  };

  const updateOptionColor = (id: string, color: string) => {
    onChange(
      options.map((o) => (o.id === id ? { ...o, color } : o)),
    );
  };

  const updateOptionName = (id: string, name: string) => {
    onChange(
      options.map((o) => (o.id === id ? { ...o, name } : o)),
    );
  };

  const COLOR_MAP: Record<string, string> = {
    default: "#e3e2e0",
    gray: "#e3e2e0",
    brown: "#eee0da",
    orange: "#fadec9",
    yellow: "#fdecc8",
    green: "#dbeddb",
    blue: "#d3e5ef",
    purple: "#e8deee",
    pink: "#f5e0e9",
    red: "#ffe2dd",
  };

  return (
    <div className="space-y-1">
      {options.map((option) => (
        <div key={option.id} className="flex items-center gap-1">
          {/* Color picker */}
          <select
            value={option.color}
            onChange={(e) => updateOptionColor(option.id, e.target.value)}
            className="h-6 w-6 shrink-0 cursor-pointer appearance-none rounded border-0 p-0"
            style={{ backgroundColor: COLOR_MAP[option.color] ?? COLOR_MAP.default }}
            title="Change color"
          >
            {OPTION_COLORS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {/* Name */}
          <input
            value={option.name}
            onChange={(e) => updateOptionName(option.id, e.target.value)}
            className="min-w-0 flex-1 rounded border-0 bg-transparent px-1 py-0.5 text-sm outline-none"
            style={{ color: "var(--text-primary)" }}
          />
          {/* Remove */}
          <button
            onClick={() => removeOption(option.id)}
            className="shrink-0 text-xs text-[var(--text-secondary)] hover:text-red-500"
          >
            x
          </button>
        </div>
      ))}
      {/* Add new */}
      <div className="flex items-center gap-1">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Add option..."
          onKeyDown={(e) => {
            if (e.key === "Enter") addOption();
          }}
          className="min-w-0 flex-1 rounded border px-2 py-1 text-sm outline-none"
          style={{
            backgroundColor: "transparent",
            borderColor: "var(--border-default)",
            color: "var(--text-primary)",
          }}
        />
        <Button variant="ghost" size="sm" onClick={addOption}>
          +
        </Button>
      </div>
    </div>
  );
}
