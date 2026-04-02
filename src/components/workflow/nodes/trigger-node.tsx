"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Zap } from "lucide-react";
import type { TriggerNodeData } from "@/lib/workflows/types";

function TriggerNodeComponent({ data, selected }: NodeProps & { data: TriggerNodeData }) {
  return (
    <div
      className="px-4 py-3 rounded-lg border-2 min-w-[180px] shadow-sm"
      style={{
        backgroundColor: "var(--bg-primary)",
        borderColor: selected ? "#F59E0B" : "var(--color-yellow)",
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <div className="p-1 rounded" style={{ backgroundColor: "rgba(245,158,11,0.15)" }}>
          <Zap size={14} style={{ color: "var(--color-yellow)" }} />
        </div>
        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {data.label}
        </span>
      </div>
      <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
        {data.triggerType}
      </p>
      <Handle type="source" position={Position.Bottom} className="!bg-yellow-500 !w-3 !h-3 !border-2 !border-white" />
    </div>
  );
}

export const TriggerNode = memo(TriggerNodeComponent);
