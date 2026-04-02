"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { UserCheck } from "lucide-react";
import type { ApprovalNodeData } from "@/lib/workflows/types";

function ApprovalNodeComponent({ data, selected }: NodeProps & { data: ApprovalNodeData }) {
  return (
    <div
      className="px-4 py-3 rounded-lg border-2 min-w-[180px] shadow-sm"
      style={{
        backgroundColor: "var(--bg-primary)",
        borderColor: selected ? "#F97316" : "var(--color-orange)",
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-orange-500 !w-3 !h-3 !border-2 !border-white" />
      <div className="flex items-center gap-2 mb-1">
        <div className="p-1 rounded" style={{ backgroundColor: "rgba(249,115,22,0.15)" }}>
          <UserCheck size={14} style={{ color: "var(--color-orange)" }} />
        </div>
        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {data.label}
        </span>
      </div>
      <p className="text-xs line-clamp-2" style={{ color: "var(--text-tertiary)" }}>
        {data.message}
      </p>
      {data.timeoutMinutes && (
        <p className="text-[10px] mt-1" style={{ color: "var(--text-placeholder)" }}>
          Timeout: {data.timeoutMinutes}m
        </p>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-orange-500 !w-3 !h-3 !border-2 !border-white" />
    </div>
  );
}

export const ApprovalNode = memo(ApprovalNodeComponent);
