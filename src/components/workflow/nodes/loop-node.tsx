"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Repeat } from "lucide-react";
import type { LoopNodeData } from "@/lib/workflows/types";

function LoopNodeComponent({ data, selected }: NodeProps & { data: LoopNodeData }) {
  return (
    <div
      className="px-4 py-3 rounded-lg border-2 min-w-[180px] shadow-sm"
      style={{
        backgroundColor: "var(--bg-primary)",
        borderColor: selected ? "#10B981" : "var(--color-green)",
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-green-500 !w-3 !h-3 !border-2 !border-white" />
      <div className="flex items-center gap-2 mb-1">
        <div className="p-1 rounded" style={{ backgroundColor: "rgba(16,185,129,0.15)" }}>
          <Repeat size={14} style={{ color: "var(--color-green)" }} />
        </div>
        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {data.label}
        </span>
      </div>
      <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
        for {data.itemVariable} in {data.collection}
      </p>
      <p className="text-[10px]" style={{ color: "var(--text-placeholder)" }}>
        max {data.maxIterations} iterations
      </p>
      <div className="flex justify-between mt-2">
        <div className="relative">
          <Handle
            type="source"
            position={Position.Bottom}
            id="loop"
            className="!bg-green-500 !w-3 !h-3 !border-2 !border-white !left-0"
          />
          <span className="text-[10px] absolute -bottom-4 left-0" style={{ color: "var(--color-green)" }}>
            Loop
          </span>
        </div>
        <div className="relative">
          <Handle
            type="source"
            position={Position.Bottom}
            id="done"
            className="!bg-gray-500 !w-3 !h-3 !border-2 !border-white !right-0 !left-auto"
          />
          <span className="text-[10px] absolute -bottom-4 right-0" style={{ color: "var(--text-tertiary)" }}>
            Done
          </span>
        </div>
      </div>
    </div>
  );
}

export const LoopNode = memo(LoopNodeComponent);
