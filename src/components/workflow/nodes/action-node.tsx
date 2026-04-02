"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Play } from "lucide-react";
import type { ActionNodeData } from "@/lib/workflows/types";

function ActionNodeComponent({ data, selected }: NodeProps & { data: ActionNodeData }) {
  return (
    <div
      className="px-4 py-3 rounded-lg border-2 min-w-[180px] shadow-sm"
      style={{
        backgroundColor: "var(--bg-primary)",
        borderColor: selected ? "#3B82F6" : "var(--accent-blue, #2383e2)",
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-blue-500 !w-3 !h-3 !border-2 !border-white" />
      <div className="flex items-center gap-2 mb-1">
        <div className="p-1 rounded" style={{ backgroundColor: "rgba(35,131,226,0.15)" }}>
          <Play size={14} style={{ color: "var(--accent-blue)" }} />
        </div>
        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {data.label}
        </span>
      </div>
      <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
        {data.actionType}
      </p>
      <Handle type="source" position={Position.Bottom} className="!bg-blue-500 !w-3 !h-3 !border-2 !border-white" />
    </div>
  );
}

export const ActionNode = memo(ActionNodeComponent);
