"use client";

import { useState } from "react";
import { trpc } from "@/server/trpc/client";
import { Button } from "@/components/ui/button";

type NewDatabaseProps = {
  workspaceId: string;
  isInline?: boolean;
  onCreated?: (databaseId: string, pageId: string) => void;
  onCancel?: () => void;
};

export function NewDatabase({
  workspaceId,
  isInline = false,
  onCreated,
  onCancel,
}: NewDatabaseProps) {
  const [name, setName] = useState("");
  const createMutation = trpc.database.create.useMutation({
    onSuccess: (data) => {
      onCreated?.(data.id, data.pageId);
    },
  });

  const handleCreate = () => {
    createMutation.mutate({
      workspaceId,
      name: name.trim() || "제목 없음 데이터베이스",
      isInline,
    });
  };

  return (
    <div
      className="w-[320px] rounded-lg border p-4 shadow-lg"
      style={{
        backgroundColor: "var(--bg-primary)",
        borderColor: "var(--border-default)",
      }}
    >
      <h3
        className="mb-3 text-sm font-semibold"
        style={{ color: "var(--text-primary)" }}
      >
        새 데이터베이스
      </h3>

      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="제목 없음 데이터베이스"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter") handleCreate();
          if (e.key === "Escape") onCancel?.();
        }}
        className="mb-3 w-full rounded border px-2 py-1.5 text-sm"
        style={{
          backgroundColor: "var(--bg-primary)",
          borderColor: "var(--border-default)",
          color: "var(--text-primary)",
        }}
      />

      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel}>
            취소
          </Button>
        )}
        <Button
          variant="primary"
          size="sm"
          onClick={handleCreate}
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? "생성 중..." : "생성"}
        </Button>
      </div>

      {createMutation.error && (
        <p className="mt-2 text-xs text-red-500">
          {createMutation.error.message}
        </p>
      )}
    </div>
  );
}
