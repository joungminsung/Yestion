"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { propertyTypeIcon } from "./property-type-icon";
import type { DatabaseData, FilterGroup, FilterCondition, FilterOperator, PropertyType } from "@/types/database";

type DatabaseFilterProps = {
  properties: DatabaseData["properties"];
  filter: FilterGroup | null;
  onFilterChange: (filter: FilterGroup | null) => void;
  onClose: () => void;
};

// ── Operator sets per property type ────────────────────────

const TEXT_OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: "contains", label: "포함" },
  { value: "does_not_contain", label: "포함하지 않음" },
  { value: "equals", label: "같음" },
  { value: "does_not_equal", label: "같지 않음" },
  { value: "starts_with", label: "시작" },
  { value: "ends_with", label: "끝" },
  { value: "is_empty", label: "비어 있음" },
  { value: "is_not_empty", label: "비어 있지 않음" },
];

const NUMBER_OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: "equals", label: "=" },
  { value: "does_not_equal", label: "!=" },
  { value: "greater_than", label: ">" },
  { value: "less_than", label: "<" },
  { value: "greater_than_or_equal", label: ">=" },
  { value: "less_than_or_equal", label: "<=" },
  { value: "is_empty", label: "비어 있음" },
  { value: "is_not_empty", label: "비어 있지 않음" },
];

const DATE_OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: "equals", label: "같음" },
  { value: "before", label: "이전" },
  { value: "after", label: "이후" },
  { value: "on_or_before", label: "이전 또는 같음" },
  { value: "on_or_after", label: "이후 또는 같음" },
  { value: "is_empty", label: "비어 있음" },
  { value: "is_not_empty", label: "비어 있지 않음" },
];

const SELECT_OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: "equals", label: "같음" },
  { value: "does_not_equal", label: "같지 않음" },
  { value: "is_empty", label: "비어 있음" },
  { value: "is_not_empty", label: "비어 있지 않음" },
];

const CHECKBOX_OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: "equals", label: "같음" },
  { value: "does_not_equal", label: "같지 않음" },
];

function getOperatorsForType(type: PropertyType) {
  switch (type) {
    case "number":
      return NUMBER_OPERATORS;
    case "date":
    case "created_time":
    case "last_edited_time":
      return DATE_OPERATORS;
    case "select":
    case "status":
    case "multi_select":
      return SELECT_OPERATORS;
    case "checkbox":
      return CHECKBOX_OPERATORS;
    default:
      return TEXT_OPERATORS;
  }
}

// propertyTypeIcon is now imported from ./property-type-icon

// ── Helper: ensure filter has flat conditions ──────────────

function flatConditions(filter: FilterGroup | null): FilterCondition[] {
  if (!filter) return [];
  return filter.conditions.filter(
    (c): c is FilterCondition => "propertyId" in c,
  );
}

function makeEmptyCondition(propertyId: string, type: PropertyType): FilterCondition {
  const ops = getOperatorsForType(type);
  return {
    propertyId,
    operator: ops[0]?.value ?? "contains",
    value: type === "checkbox" ? true : "",
  };
}

// ── Component ──────────────────────────────────────────────

export function DatabaseFilter({
  properties,
  filter,
  onFilterChange,
  onClose,
}: DatabaseFilterProps) {
  const [logicOp, setLogicOp] = useState<"and" | "or">(filter?.operator ?? "and");
  const [conditions, setConditions] = useState<FilterCondition[]>(
    flatConditions(filter),
  );

  const filterableProps = properties.filter((p) => p.type !== "formula" && p.type !== "rollup");

  const updateConditions = useCallback(
    (next: FilterCondition[]) => {
      setConditions(next);
    },
    [],
  );

  const addCondition = () => {
    const prop = filterableProps[0];
    if (!prop) return;
    updateConditions([...conditions, makeEmptyCondition(prop.id, prop.type)]);
  };

  const removeCondition = (idx: number) => {
    updateConditions(conditions.filter((_, i) => i !== idx));
  };

  const updateCondition = (idx: number, patch: Partial<FilterCondition>) => {
    updateConditions(
      conditions.map((c, i) => (i === idx ? { ...c, ...patch } : c)),
    );
  };

  const handleSave = () => {
    if (conditions.length === 0) {
      onFilterChange(null);
    } else {
      onFilterChange({ operator: logicOp, conditions });
    }
    onClose();
  };

  const handleClear = () => {
    setConditions([]);
    onFilterChange(null);
    onClose();
  };

  return (
    <div
      className="w-[480px] rounded-lg border shadow-lg"
      style={{
        backgroundColor: "var(--bg-primary)",
        borderColor: "var(--border-default)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-2" style={{ borderColor: "var(--border-default)" }}>
        <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
          필터
        </span>
        <button onClick={onClose} className="text-xs hover:underline" style={{ color: "var(--text-secondary)" }}>
          닫기
        </button>
      </div>

      {/* Logic toggle */}
      {conditions.length > 1 && (
        <div className="flex items-center gap-2 px-3 pt-2">
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>조건 연결:</span>
          <button
            onClick={() => setLogicOp("and")}
            className={`rounded px-2 py-0.5 text-xs font-medium ${logicOp === "and" ? "bg-[#2383e2] text-white" : ""}`}
            style={logicOp !== "and" ? { color: "var(--text-secondary)" } : undefined}
          >
            AND
          </button>
          <button
            onClick={() => setLogicOp("or")}
            className={`rounded px-2 py-0.5 text-xs font-medium ${logicOp === "or" ? "bg-[#2383e2] text-white" : ""}`}
            style={logicOp !== "or" ? { color: "var(--text-secondary)" } : undefined}
          >
            OR
          </button>
        </div>
      )}

      {/* Condition rows */}
      <div className="max-h-[300px] overflow-y-auto px-3 py-2 space-y-2">
        {conditions.length === 0 && (
          <p className="text-xs py-4 text-center" style={{ color: "var(--text-secondary)" }}>
            필터 조건이 없습니다. 아래에서 추가하세요.
          </p>
        )}

        {conditions.map((cond, idx) => {
          const prop = properties.find((p) => p.id === cond.propertyId);
          const propType = prop?.type ?? "text";
          const operators = getOperatorsForType(propType);
          const noValueOps: FilterOperator[] = ["is_empty", "is_not_empty"];
          const needsValue = !noValueOps.includes(cond.operator);

          return (
            <div key={idx} className="flex items-center gap-1.5">
              {/* Property dropdown */}
              <select
                value={cond.propertyId}
                onChange={(e) => {
                  const newProp = properties.find((p) => p.id === e.target.value);
                  if (newProp) {
                    updateCondition(idx, {
                      propertyId: newProp.id,
                      operator: getOperatorsForType(newProp.type)[0]?.value ?? "contains",
                      value: newProp.type === "checkbox" ? true : "",
                    });
                  }
                }}
                className="h-7 flex-shrink-0 rounded border px-1.5 text-xs"
                style={{
                  backgroundColor: "var(--bg-primary)",
                  borderColor: "var(--border-default)",
                  color: "var(--text-primary)",
                  maxWidth: "130px",
                }}
              >
                {filterableProps.map((p) => (
                  <option key={p.id} value={p.id}>
                    {propertyTypeIcon(p.type)} {p.name}
                  </option>
                ))}
              </select>

              {/* Operator dropdown */}
              <select
                value={cond.operator}
                onChange={(e) =>
                  updateCondition(idx, { operator: e.target.value as FilterOperator })
                }
                className="h-7 flex-shrink-0 rounded border px-1.5 text-xs"
                style={{
                  backgroundColor: "var(--bg-primary)",
                  borderColor: "var(--border-default)",
                  color: "var(--text-primary)",
                  maxWidth: "120px",
                }}
              >
                {operators.map((op) => (
                  <option key={op.value} value={op.value}>
                    {op.label}
                  </option>
                ))}
              </select>

              {/* Value input */}
              {needsValue && (
                <ConditionValueInput
                  propType={propType}
                  prop={prop}
                  value={cond.value}
                  onChange={(v) => updateCondition(idx, { value: v })}
                />
              )}

              {/* Remove */}
              <button
                onClick={() => removeCondition(idx)}
                className="flex-shrink-0 rounded p-1 hover:bg-[var(--bg-hover)]"
                title="조건 삭제"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t px-3 py-2" style={{ borderColor: "var(--border-default)" }}>
        <button
          onClick={addCondition}
          className="text-xs font-medium hover:underline"
          style={{ color: "#2383e2" }}
        >
          + 필터 추가
        </button>
        <div className="flex items-center gap-2">
          {conditions.length > 0 && (
            <Button variant="ghost" size="sm" onClick={handleClear}>
              초기화
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={handleSave}>
            적용
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Value Input subcomponent ───────────────────────────────

function ConditionValueInput({
  propType,
  prop,
  value,
  onChange,
}: {
  propType: PropertyType;
  prop: DatabaseData["properties"][number] | undefined;
  value: FilterCondition["value"];
  onChange: (v: FilterCondition["value"]) => void;
}) {
  const baseStyle = {
    backgroundColor: "var(--bg-primary)",
    borderColor: "var(--border-default)",
    color: "var(--text-primary)",
  };

  switch (propType) {
    case "number":
      return (
        <input
          type="number"
          value={typeof value === "number" ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
          placeholder="값"
          className="h-7 min-w-0 flex-1 rounded border px-1.5 text-xs"
          style={baseStyle}
        />
      );

    case "checkbox":
      return (
        <select
          value={value === true ? "true" : "false"}
          onChange={(e) => onChange(e.target.value === "true")}
          className="h-7 rounded border px-1.5 text-xs"
          style={baseStyle}
        >
          <option value="true">체크됨</option>
          <option value="false">체크 안됨</option>
        </select>
      );

    case "date":
    case "created_time":
    case "last_edited_time":
      return (
        <input
          type="date"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 min-w-0 flex-1 rounded border px-1.5 text-xs"
          style={baseStyle}
        />
      );

    case "select":
    case "status":
    case "multi_select": {
      const options = prop?.config?.options ?? [];
      return (
        <select
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 min-w-0 flex-1 rounded border px-1.5 text-xs"
          style={baseStyle}
        >
          <option value="">선택...</option>
          {options.map((opt) => (
            <option key={opt.id} value={opt.name}>
              {opt.name}
            </option>
          ))}
        </select>
      );
    }

    default:
      return (
        <input
          type="text"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="값"
          className="h-7 min-w-0 flex-1 rounded border px-1.5 text-xs"
          style={baseStyle}
        />
      );
  }
}
