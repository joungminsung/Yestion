"use client";

import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { LinkedDatabaseView } from "@/components/database/linked-database-view";

export function LinkedDatabaseBlockView({ node }: NodeViewProps) {
  const databaseId = node.attrs.databaseId as string | null;
  const viewId = node.attrs.viewId as string | null;

  if (!databaseId) {
    return (
      <NodeViewWrapper data-type="linked-database">
        <div
          className="my-2 rounded-md border border-dashed p-4 text-sm"
          style={{
            borderColor: "var(--border-default)",
            backgroundColor: "var(--bg-secondary, #f7f6f3)",
            color: "var(--text-tertiary)",
          }}
        >
          연결할 데이터베이스를 선택해 주세요.
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper data-type="linked-database">
      <LinkedDatabaseView databaseId={databaseId} viewId={viewId} />
    </NodeViewWrapper>
  );
}
