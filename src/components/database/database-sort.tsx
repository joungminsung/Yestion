"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { propertyTypeIcon } from "./property-type-icon";
import type { DatabaseData, SortRule } from "@/types/database";

type DatabaseSortProps = {
  properties: DatabaseData["properties"];
  sorts: SortRule[] | null;
  onSortChange: (sorts: SortRule[] | null) => void;
  onClose: () => void;
};

export function DatabaseSort({
  properties,
  sorts,
  onSortChange,
  onClose,
}: DatabaseSortProps) {
  const [rules, setRules] = useState<SortRule[]>(sorts ?? []);

  const sortableProps = properties.filter((p) => p.type !== "formula" && p.type !== "rollup");

  const addRule = () => {
    const prop = sortableProps[0];
    if (!prop) return;
    setRules([...rules, { propertyId: prop.id, direction: "asc" }]);
  };

  const removeRule = (idx: number) => {
    setRules(rules.filter((_, i) => i !== idx));
  };

  const updateRule = useCallback(
    (idx: number, patch: Partial<SortRule>) => {
      setRules((prev) =>
        prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
      );
    },
    [],
  );

  const handleSave = () => {
    onSortChange(rules.length === 0 ? null : rules);
    onClose();
  };

  const handleClear = () => {
    setRules([]);
    onSortChange(null);
    onClose();
  };

  return (
    <div
      className="w-[380px] rounded-lg border shadow-lg"
      style={{
        backgroundColor: "var(--bg-primary)",
        borderColor: "var(--border-default)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-2" style={{ borderColor: "var(--border-default)" }}>
        <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
          정렬
        </span>
        <button onClick={onClose} className="text-xs hover:underline" style={{ color: "var(--text-secondary)" }}>
          닫기
        </button>
      </div>

      {/* Sort rules */}
      <div className="max-h-[250px] overflow-y-auto px-3 py-2 space-y-2">
        {rules.length === 0 && (
          <p className="text-xs py-4 text-center" style={{ color: "var(--text-secondary)" }}>
            정렬 규칙이 없습니다. 아래에서 추가하세요.
          </p>
        )}

        {rules.map((rule, idx) => (
          <div key={idx} className="flex items-center gap-1.5">
            {/* Property dropdown */}
            <select
              value={rule.propertyId}
              onChange={(e) => updateRule(idx, { propertyId: e.target.value })}
              className="h-7 flex-shrink-0 rounded border px-1.5 text-xs"
              style={{
                backgroundColor: "var(--bg-primary)",
                borderColor: "var(--border-default)",
                color: "var(--text-primary)",
                maxWidth: "160px",
              }}
            >
              {sortableProps.map((p) => (
                <option key={p.id} value={p.id}>
                  {propertyTypeIcon(p.type)} {p.name}
                </option>
              ))}
            </select>

            {/* Direction toggle */}
            <select
              value={rule.direction}
              onChange={(e) => updateRule(idx, { direction: e.target.value as "asc" | "desc" })}
              className="h-7 flex-shrink-0 rounded border px-1.5 text-xs"
              style={{
                backgroundColor: "var(--bg-primary)",
                borderColor: "var(--border-default)",
                color: "var(--text-primary)",
              }}
            >
              <option value="asc">오름차순</option>
              <option value="desc">내림차순</option>
            </select>

            {/* Remove */}
            <button
              onClick={() => removeRule(idx)}
              className="flex-shrink-0 rounded p-1 hover:bg-[var(--bg-hover)]"
              title="정렬 삭제"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t px-3 py-2" style={{ borderColor: "var(--border-default)" }}>
        <button
          onClick={addRule}
          className="text-xs font-medium hover:underline"
          style={{ color: "#2383e2" }}
        >
          + 정렬 추가
        </button>
        <div className="flex items-center gap-2">
          {rules.length > 0 && (
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
