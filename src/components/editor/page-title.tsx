"use client";

import { useRef, useCallback } from "react";
import { trpc } from "@/server/trpc/client";

type PageTitleProps = { pageId: string; initialTitle: string };

export function PageTitle({ pageId, initialTitle }: PageTitleProps) {
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);
  const updateTitle = trpc.page.updateTitle.useMutation();

  const handleInput = useCallback(
    (e: React.FormEvent<HTMLHeadingElement>) => {
      const newTitle = e.currentTarget.textContent || "";
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(() => {
        updateTitle.mutate({ id: pageId, title: newTitle });
      }, 500);
    },
    [pageId, updateTitle],
  );

  return (
    <h1
      className="text-4xl font-bold outline-none mb-4"
      style={{ color: "var(--text-primary)", fontWeight: 700, lineHeight: 1.2 }}
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      data-placeholder="제목 없음"
    >
      {initialTitle || ""}
    </h1>
  );
}
