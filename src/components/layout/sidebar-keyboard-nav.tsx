"use client";

import { useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { usePageTreeStore } from "@/stores/page-tree";

type Page = {
  id: string;
  title: string;
  icon: string | null;
  parentId?: string | null;
  children?: Page[];
};

export function useSidebarKeyboardNav(pages: Page[], workspaceId: string) {
  const router = useRouter();
  const { expandedNodes, toggleExpanded, setActivePage, activePageId } =
    usePageTreeStore();

  const flattenPages = useCallback(
    (pages: Page[], depth = 0): { page: Page; depth: number }[] => {
      const result: { page: Page; depth: number }[] = [];
      for (const page of pages) {
        result.push({ page, depth });
        if (expandedNodes.has(page.id) && page.children) {
          result.push(...flattenPages(page.children, depth + 1));
        }
      }
      return result;
    },
    [expandedNodes]
  );

  useEffect(() => {
    const flat = flattenPages(pages);
    const currentIndex = flat.findIndex((f) => f.page.id === activePageId);

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.closest(".notion-editor") ||
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = Math.min(currentIndex + 1, flat.length - 1);
        if (next >= 0 && flat[next]) setActivePage(flat[next].page.id);
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev = Math.max(currentIndex - 1, 0);
        if (prev >= 0 && flat[prev]) setActivePage(flat[prev].page.id);
      }
      if (e.key === "Enter" && activePageId) {
        e.preventDefault();
        router.push(`/${workspaceId}/${activePageId}`);
      }
      if (e.key === "ArrowRight" && activePageId) {
        e.preventDefault();
        if (!expandedNodes.has(activePageId)) toggleExpanded(activePageId);
      }
      if (e.key === "ArrowLeft" && activePageId) {
        e.preventDefault();
        if (expandedNodes.has(activePageId)) {
          toggleExpanded(activePageId);
        } else {
          const current = flat.find((f) => f.page.id === activePageId);
          if (current && current.page.parentId) {
            setActivePage(current.page.parentId);
          }
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    pages,
    activePageId,
    expandedNodes,
    flattenPages,
    router,
    workspaceId,
    setActivePage,
    toggleExpanded,
  ]);
}
