"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { CircleStop } from "lucide-react";
import type { EndNodeData } from "@/lib/workflows/types";

function EndNodeComponent({ data, selected }: NodeProps & { data: EndNodeData }) {
  return (
    <div
      className="px-4 py-3 rounded-lg border-2 min-w-[120px] shadow-sm text-center"
      style={{
        backgroundColor: "var(--bg-primary)",
        borderColor: selected ? "#EF4444" : "var(--color-red)",
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-red-500 !w-3 !h-3 !border-2 !border-white" />
      <div className="flex items-center justify-center gap-2">
        <div className="p-1 rounded" style={{ backgroundColor: "rgba(239,68,68,0.15)" }}>
          <CircleStop size={14} style={{ color: "var(--color-red)" }} />
        </div>
        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {data.label}
        </span>
      </div>
    </div>
  );
}

export const EndNode = memo(EndNodeComponent);
