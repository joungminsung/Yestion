"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { GitBranch } from "lucide-react";
import type { ConditionNodeData } from "@/lib/workflows/types";

function ConditionNodeComponent({ data, selected }: NodeProps & { data: ConditionNodeData }) {
  return (
    <div
      className="px-4 py-3 rounded-lg border-2 min-w-[180px] shadow-sm"
      style={{
        backgroundColor: "var(--bg-primary)",
        borderColor: selected ? "#8B5CF6" : "var(--color-purple)",
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-purple-500 !w-3 !h-3 !border-2 !border-white" />
      <div className="flex items-center gap-2 mb-1">
        <div className="p-1 rounded" style={{ backgroundColor: "rgba(139,92,246,0.15)" }}>
          <GitBranch size={14} style={{ color: "var(--color-purple)" }} />
        </div>
        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {data.label}
        </span>
      </div>
      <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
        {data.field} {data.operator} {String(data.value ?? "")}
      </p>
      <div className="flex justify-between mt-2">
        <div className="relative">
          <Handle
            type="source"
            position={Position.Bottom}
            id="true"
            className="!bg-green-500 !w-3 !h-3 !border-2 !border-white !left-0"
          />
          <span className="text-[10px] absolute -bottom-4 left-0" style={{ color: "var(--color-green)" }}>
            True
          </span>
        </div>
        <div className="relative">
          <Handle
            type="source"
            position={Position.Bottom}
            id="false"
            className="!bg-red-500 !w-3 !h-3 !border-2 !border-white !right-0 !left-auto"
          />
          <span className="text-[10px] absolute -bottom-4 right-0" style={{ color: "var(--color-red)" }}>
            False
          </span>
        </div>
      </div>
    </div>
  );
}

export const ConditionNode = memo(ConditionNodeComponent);
