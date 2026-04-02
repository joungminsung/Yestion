"use client";

import { trpc } from "@/server/trpc/client";
import { Loader2 } from "lucide-react";
import type { PropertyConfig } from "@/types/database";

type RollupCellRendererProps = {
  rowId: string;
  config: PropertyConfig;
};

export function RollupCellRenderer({ rowId, config }: RollupCellRendererProps) {
  const relationPropertyId = config.relationPropertyId || "";
  const targetPropertyId = config.targetPropertyId || config.rollupPropertyId || "";
  const rollupFunction = config.rollupFunction || "count";

  const { data, isLoading } = trpc.database.computeRollup.useQuery(
    {
      rowId,
      relationPropertyId,
      targetPropertyId,
      rollupFunction,
    },
    {
      enabled: !!relationPropertyId && !!targetPropertyId,
    },
  );

  if (!relationPropertyId || !targetPropertyId) {
    return (
      <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
        Configure rollup
      </span>
    );
  }

  if (isLoading) {
    return <Loader2 size={12} className="animate-spin" style={{ color: "var(--text-tertiary)" }} />;
  }

  if (data === undefined || data.value === null) {
    return <span style={{ color: "var(--text-tertiary)" }}>-</span>;
  }

  if (rollupFunction === "show_original" && Array.isArray(data.value)) {
    return (
      <div className="flex flex-wrap gap-1">
        {data.value.map((item: unknown, i: number) => (
          <span
            key={i}
            className="inline-flex px-1.5 py-0.5 rounded text-xs"
            style={{
              backgroundColor: "var(--bg-secondary)",
              color: "var(--text-primary)",
            }}
          >
            {String(item)}
          </span>
        ))}
      </div>
    );
  }

  const displayValue =
    typeof data.value === "number"
      ? rollupFunction === "average"
        ? data.value.toFixed(2)
        : data.value.toLocaleString()
      : String(data.value);

  return (
    <span className="text-sm" style={{ color: "var(--text-primary)" }}>
      {displayValue}
    </span>
  );
}
