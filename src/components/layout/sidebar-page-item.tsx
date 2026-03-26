"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { usePageTreeStore } from "@/stores/page-tree";
import { trpc } from "@/server/trpc/client";
import { useToastStore } from "@/stores/toast";

type Page = { id: string; title: string; icon: string | null; children?: Page[] };

export function SidebarPageItem({
  page,
  workspaceId,
  depth = 0,
}: {
  page: Page;
  workspaceId: string;
  depth?: number;
}) {
  const router = useRouter();
  const { expandedNodes, toggleExpanded, activePageId, setActivePage, setExpanded } =
    usePageTreeStore();
  const addToast = useToastStore((s) => s.addToast);
  const [showMenu, setShowMenu] = useState(false);

  const isExpanded = expandedNodes.has(page.id);
  const isActive = activePageId === page.id;
  const hasChildren = page.children && page.children.length > 0;

  const utils = trpc.useUtils();
  const moveToTrash = trpc.page.moveToTrash.useMutation({
    onSuccess: () => {
      addToast({
        message: "휴지통으로 이동됨",
        type: "info",
        undo: () => restorePage.mutate({ id: page.id }),
      });
      utils.page.list.invalidate();
    },
  });
  const restorePage = trpc.page.restore.useMutation({
    onSuccess: () => utils.page.list.invalidate(),
  });
  const createSubPage = trpc.page.create.useMutation({
    onSuccess: (newPage) => {
      utils.page.list.invalidate();
      setExpanded(page.id, true);
      router.push(`/${workspaceId}/${newPage.id}`);
    },
  });
  const duplicatePage = trpc.page.duplicate.useMutation({
    onSuccess: () => {
      addToast({ message: "복제됨", type: "success" });
      utils.page.list.invalidate();
    },
  });
  const addFavorite = trpc.page.addFavorite.useMutation({
    onSuccess: () => {
      addToast({ message: "즐겨찾기에 추가됨", type: "success" });
      utils.page.listFavorites.invalidate();
    },
  });

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-1 py-[2px] pr-2 rounded-sm cursor-pointer hover:bg-notion-bg-hover",
          isActive && "bg-notion-bg-active"
        )}
        style={{
          paddingLeft: `${12 + depth * 16}px`,
          fontSize: "14px",
          color: "var(--text-primary)",
          minHeight: "28px",
        }}
        onClick={() => {
          setActivePage(page.id);
          router.push(`/${workspaceId}/${page.id}`);
        }}
      >
        <button
          className="w-5 h-5 flex items-center justify-center rounded hover:bg-notion-bg-active flex-shrink-0"
          style={{ color: "var(--text-tertiary)", fontSize: "10px" }}
          onClick={(e) => {
            e.stopPropagation();
            toggleExpanded(page.id);
          }}
        >
          <span
            style={{
              transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 0.15s",
              display: "inline-block",
            }}
          >
            ▶
          </span>
        </button>
        <span className="flex-shrink-0 text-sm" style={{ width: "20px", textAlign: "center" }}>
          {page.icon || "📄"}
        </span>
        <span
          className="truncate flex-1"
          style={{ color: page.title ? "var(--text-primary)" : "var(--text-tertiary)" }}
        >
          {page.title || "제목 없음"}
        </span>
        <div className="hidden group-hover:flex items-center gap-0.5 flex-shrink-0">
          <button
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-notion-bg-active"
            style={{ color: "var(--text-tertiary)", fontSize: "14px" }}
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
          >
            ···
          </button>
          <button
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-notion-bg-active"
            style={{ color: "var(--text-tertiary)", fontSize: "14px" }}
            onClick={(e) => {
              e.stopPropagation();
              createSubPage.mutate({ workspaceId, title: "", parentId: page.id });
            }}
          >
            +
          </button>
        </div>
      </div>

      {showMenu && (
        <div
          className="ml-8 rounded-lg overflow-hidden py-1 mb-1"
          style={{
            backgroundColor: "var(--bg-primary)",
            boxShadow: "var(--shadow-popup)",
            fontSize: "13px",
          }}
        >
          {[
            {
              label: "삭제",
              action: () => {
                moveToTrash.mutate({ id: page.id });
                setShowMenu(false);
              },
            },
            {
              label: "복제",
              action: () => {
                duplicatePage.mutate({ id: page.id });
                setShowMenu(false);
              },
            },
            {
              label: "즐겨찾기 추가",
              action: () => {
                addFavorite.mutate({ pageId: page.id });
                setShowMenu(false);
              },
            },
          ].map((item) => (
            <button
              key={item.label}
              className="w-full text-left px-3 py-1.5 hover:bg-notion-bg-hover"
              style={{ color: "var(--text-primary)" }}
              onClick={item.action}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {isExpanded &&
        hasChildren &&
        page.children!.map((child) => (
          <SidebarPageItem
            key={child.id}
            page={child}
            workspaceId={workspaceId}
            depth={depth + 1}
          />
        ))}
    </div>
  );
}
