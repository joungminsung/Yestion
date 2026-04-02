"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Clock } from "lucide-react";
import type { WaitNodeData } from "@/lib/workflows/types";

function WaitNodeComponent({ data, selected }: NodeProps & { data: WaitNodeData }) {
  const description =
    data.waitType === "delay"
      ? `Wait ${data.delayMinutes ?? 0} minutes`
      : data.waitType === "until_date"
        ? `Until ${data.untilDate ?? "..."}`
        : "Until condition met";

  return (
    <div
      className="px-4 py-3 rounded-lg border-2 min-w-[180px] shadow-sm"
      style={{
        backgroundColor: "var(--bg-primary)",
        borderColor: selected ? "#6B7280" : "var(--color-gray)",
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-500 !w-3 !h-3 !border-2 !border-white" />
      <div className="flex items-center gap-2 mb-1">
        <div className="p-1 rounded" style={{ backgroundColor: "rgba(107,114,128,0.15)" }}>
          <Clock size={14} style={{ color: "var(--color-gray)" }} />
        </div>
        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {data.label}
        </span>
      </div>
      <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
        {description}
      </p>
      <Handle type="source" position={Position.Bottom} className="!bg-gray-500 !w-3 !h-3 !border-2 !border-white" />
    </div>
  );
}

export const WaitNode = memo(WaitNodeComponent);
