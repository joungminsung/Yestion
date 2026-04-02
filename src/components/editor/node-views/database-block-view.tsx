"use client";

import { useCallback, useEffect, useState } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { trpc } from "@/server/trpc/client";
import { DatabaseView } from "@/components/database/database-view";
import { useParams } from "next/navigation";

export function DatabaseBlockView({ node, updateAttributes, deleteNode }: NodeViewProps) {
  const params = useParams();
  const workspaceId = params.workspaceId as string;
  const databaseId = node.attrs.databaseId as string | null;
  const [isCreating, setIsCreating] = useState(false);

  const createMutation = trpc.database.create.useMutation({
    onSuccess: (data) => {
      updateAttributes({ databaseId: data.id });
      setIsCreating(false);
    },
    onError: () => {
      setIsCreating(false);
    },
  });

  // Auto-create database if none assigned yet
  useEffect(() => {
    if (!databaseId && workspaceId && !isCreating) {
      setIsCreating(true);
      createMutation.mutate({
        workspaceId,
        name: "제목 없음",
        isInline: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on mount
  }, []);

  const handleDelete = useCallback(() => {
    deleteNode();
  }, [deleteNode]);

  if (!databaseId) {
    return (
      <NodeViewWrapper data-type="database-block">
        <div
          className="flex items-center justify-center rounded-md border border-dashed p-8"
          style={{
            borderColor: "var(--border-default)",
            backgroundColor: "var(--bg-secondary, #f7f6f3)",
          }}
        >
          <div className="text-center">
            <div
              className="mb-2 text-sm font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              {isCreating ? "데이터베이스 생성 중..." : "데이터베이스를 불러올 수 없습니다"}
            </div>
            {!isCreating && (
              <button
                onClick={handleDelete}
                className="rounded px-3 py-1 text-xs text-red-500 transition-colors hover:bg-red-50"
              >
                블록 삭제
              </button>
            )}
          </div>
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper data-type="database-block">
      <div
        className="my-2 rounded-md border"
        style={{ borderColor: "var(--border-default)" }}
      >
        <DatabaseView databaseId={databaseId} />
      </div>
    </NodeViewWrapper>
  );
}
