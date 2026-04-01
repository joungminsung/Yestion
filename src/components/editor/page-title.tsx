"use client";

import { useRef, useCallback, useEffect } from "react";
import { trpc } from "@/server/trpc/client";

type PageTitleProps = { pageId: string; initialTitle: string };

export function PageTitle({ pageId, initialTitle }: PageTitleProps) {
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);
  const updateTitle = trpc.page.updateTitle.useMutation();

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (saveTimeout.current) {
        clearTimeout(saveTimeout.current);
        saveTimeout.current = null;
        const title = document.querySelector<HTMLHeadingElement>("[contenteditable]")?.textContent || "";
        navigator.sendBeacon(
          "/api/trpc/page.updateTitle",
          new Blob([JSON.stringify({ json: { id: pageId, title } })], { type: "application/json" })
        );
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && saveTimeout.current) {
        clearTimeout(saveTimeout.current);
        saveTimeout.current = null;
        const title = document.querySelector<HTMLHeadingElement>("[contenteditable]")?.textContent || "";
        updateTitle.mutate({ id: pageId, title });
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [pageId, updateTitle]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLHeadingElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        // Focus the editor (first child of .notion-editor)
        const editorEl = document.querySelector(".notion-editor") as HTMLElement;
        if (editorEl) editorEl.focus();
      }
    },
    [],
  );

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
      onKeyDown={handleKeyDown}
      data-placeholder="제목 없음"
    >
      {initialTitle || ""}
    </h1>
  );
}
