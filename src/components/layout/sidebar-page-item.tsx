"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { usePageTreeStore } from "@/stores/page-tree";
import { trpc } from "@/server/trpc/client";
import { useToastStore } from "@/stores/toast";
import { FileText, ChevronRight, MoreHorizontal, Plus } from "lucide-react";
import { PagePeekPreview } from "./page-peek-preview";
import { PageIconPicker } from "@/components/page/page-icon-picker";

type Page = { id: string; title: string; icon: string | null; parentId?: string | null; children?: Page[] };

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
  const [isDragging, setIsDragging] = useState(false);
  const [dropPosition, setDropPosition] = useState<"before" | "after" | "inside" | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const hoverExpandTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemRef = useRef<HTMLDivElement>(null);

  // Hover preview state
  const [showPeek, setShowPeek] = useState(false);
  const [peekRect, setPeekRect] = useState<DOMRect | null>(null);
  const peekEnterTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const peekLeaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMouseInPeek = useRef(false);

  // Inline icon picker state
  const [showIconPicker, setShowIconPicker] = useState(false);
  const iconPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu]);

  const isExpanded = expandedNodes.has(page.id);
  const isActive = activePageId === page.id;
  const hasChildren = page.children && page.children.length > 0;

  const utils = trpc.useUtils();
  const restorePage = trpc.page.restore.useMutation({
    onSuccess: () => utils.page.list.invalidate(),
  });
  const moveToTrash = trpc.page.moveToTrash.useMutation({
    onMutate: async () => {
      await utils.page.list.cancel();
      const prev = utils.page.list.getData({ workspaceId });
      utils.page.list.setData({ workspaceId }, (old) =>
        old?.filter((p) => p.id !== page.id) ?? []
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) utils.page.list.setData({ workspaceId }, context.prev);
      addToast({ message: "삭제에 실패했습니다", type: "error" });
    },
    onSettled: () => utils.page.list.invalidate(),
    onSuccess: () => {
      addToast({
        message: "휴지통으로 이동됨",
        type: "info",
        undo: () => restorePage.mutate({ id: page.id }),
      });
    },
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
    onMutate: async () => {
      await utils.page.listFavorites.cancel();
      const prev = utils.page.listFavorites.getData({ workspaceId });
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) utils.page.listFavorites.setData({ workspaceId }, context.prev);
      addToast({ message: "즐겨찾기 추가에 실패했습니다", type: "error" });
    },
    onSettled: () => utils.page.listFavorites.invalidate(),
    onSuccess: () => {
      addToast({ message: "즐겨찾기에 추가됨", type: "success" });
    },
  });
  const movePage = trpc.page.move.useMutation({
    onSuccess: () => utils.page.list.invalidate(),
  });
  const updatePage = trpc.page.update.useMutation({
    onSuccess: () => {
      utils.page.get.invalidate({ id: page.id });
      utils.page.list.invalidate();
    },
  });

  // Hover preview handlers
  const handleItemMouseEnter = useCallback(() => {
    if (peekLeaveTimeout.current) {
      clearTimeout(peekLeaveTimeout.current);
      peekLeaveTimeout.current = null;
    }
    peekEnterTimeout.current = setTimeout(() => {
      if (itemRef.current) {
        setPeekRect(itemRef.current.getBoundingClientRect());
        setShowPeek(true);
      }
    }, 500);
  }, []);

  const handleItemMouseLeave = useCallback(() => {
    if (peekEnterTimeout.current) {
      clearTimeout(peekEnterTimeout.current);
      peekEnterTimeout.current = null;
    }
    peekLeaveTimeout.current = setTimeout(() => {
      if (!isMouseInPeek.current) {
        setShowPeek(false);
      }
    }, 300);
  }, []);

  const handlePeekMouseEnter = useCallback(() => {
    isMouseInPeek.current = true;
    if (peekLeaveTimeout.current) {
      clearTimeout(peekLeaveTimeout.current);
      peekLeaveTimeout.current = null;
    }
  }, []);

  const handlePeekMouseLeave = useCallback(() => {
    isMouseInPeek.current = false;
    peekLeaveTimeout.current = setTimeout(() => {
      setShowPeek(false);
    }, 300);
  }, []);

  // Clean up timeouts
  useEffect(() => {
    return () => {
      if (peekEnterTimeout.current) clearTimeout(peekEnterTimeout.current);
      if (peekLeaveTimeout.current) clearTimeout(peekLeaveTimeout.current);
    };
  }, []);

  // Icon picker handler
  const handleIconClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowIconPicker(!showIconPicker);
  };

  const handleIconSelect = (icon: string | null) => {
    updatePage.mutate({ id: page.id, icon });
    setShowIconPicker(false);
  };

  return (
    <div>
      <div
        ref={itemRef}
        className={cn(
          "group relative flex items-center gap-1 py-[2px] pr-2 rounded-sm cursor-pointer hover:bg-notion-bg-hover",
          isActive && "bg-notion-bg-active",
          isDragging && "opacity-40"
        )}
        style={{
          paddingLeft: `${12 + depth * 16}px`,
          fontSize: "14px",
          color: "var(--text-primary)",
          minHeight: "28px",
          borderLeft: dropPosition === "inside" ? "2px solid #2383e2" : undefined,
          outline: isActive ? "2px solid rgba(35, 131, 226, 0.5)" : undefined,
          outlineOffset: "-2px",
        }}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", page.id);
          e.dataTransfer.effectAllowed = "move";
          setIsDragging(true);
        }}
        onDragEnd={() => {
          setIsDragging(false);
          setDropPosition(null);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          const rect = e.currentTarget.getBoundingClientRect();
          const y = e.clientY - rect.top;
          const height = rect.height;
          if (y < height * 0.25) setDropPosition("before");
          else if (y > height * 0.75) setDropPosition("after");
          else setDropPosition("inside");

          // Auto-expand children after hovering 300ms over "inside" zone
          if (y >= height * 0.25 && y <= height * 0.75 && !isExpanded && hasChildren) {
            if (!hoverExpandTimeout.current) {
              hoverExpandTimeout.current = setTimeout(() => {
                setExpanded(page.id, true);
                hoverExpandTimeout.current = null;
              }, 300);
            }
          } else {
            if (hoverExpandTimeout.current) {
              clearTimeout(hoverExpandTimeout.current);
              hoverExpandTimeout.current = null;
            }
          }
        }}
        onDragLeave={() => {
          setDropPosition(null);
          if (hoverExpandTimeout.current) {
            clearTimeout(hoverExpandTimeout.current);
            hoverExpandTimeout.current = null;
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          const draggedId = e.dataTransfer.getData("text/plain");
          if (draggedId === page.id) {
            setDropPosition(null);
            return;
          }

          if (dropPosition === "inside") {
            movePage.mutate({ id: draggedId, parentId: page.id });
          } else {
            // Move to same parent as this page (before/after reorder)
            movePage.mutate({ id: draggedId, parentId: page.parentId ?? null });
          }
          setDropPosition(null);
          if (hoverExpandTimeout.current) {
            clearTimeout(hoverExpandTimeout.current);
            hoverExpandTimeout.current = null;
          }
        }}
        onClick={() => {
          setActivePage(page.id);
          router.push(`/${workspaceId}/${page.id}`);
        }}
        onMouseEnter={handleItemMouseEnter}
        onMouseLeave={handleItemMouseLeave}
      >
        {/* Drop indicators */}
        {dropPosition === "before" && (
          <div className="absolute top-0 left-3 right-0 h-[2px] bg-[#2383e2] pointer-events-none" />
        )}
        {dropPosition === "after" && (
          <div className="absolute bottom-0 left-3 right-0 h-[2px] bg-[#2383e2] pointer-events-none" />
        )}
        <button
          className="w-5 h-5 flex items-center justify-center rounded hover:bg-notion-bg-active flex-shrink-0"
          style={{ color: "var(--text-tertiary)" }}
          onClick={(e) => {
            e.stopPropagation();
            toggleExpanded(page.id);
          }}
        >
          <ChevronRight
            size={12}
            style={{
              transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 0.15s",
            }}
          />
        </button>
        {/* Clickable icon for inline icon change */}
        <span
          className="flex-shrink-0 text-sm flex items-center justify-center cursor-pointer hover:opacity-70 relative"
          style={{ width: "20px" }}
          onClick={handleIconClick}
        >
          {page.icon || <FileText size={16} />}
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
            style={{ color: "var(--text-tertiary)" }}
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
          >
            <MoreHorizontal size={14} />
          </button>
          <button
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-notion-bg-active"
            style={{ color: "var(--text-tertiary)" }}
            onClick={(e) => {
              e.stopPropagation();
              createSubPage.mutate({ workspaceId, title: "", parentId: page.id });
            }}
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Inline icon picker popup */}
      {showIconPicker && (
        <div ref={iconPickerRef} className="relative" style={{ marginLeft: `${12 + depth * 16 + 20}px` }}>
          <PageIconPicker
            currentIcon={page.icon}
            onSelect={handleIconSelect}
            onClose={() => setShowIconPicker(false)}
          />
        </div>
      )}

      {showMenu && (
        <div
          ref={menuRef}
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

      {/* Hover peek preview */}
      {showPeek && peekRect && (
        <PagePeekPreview
          pageId={page.id}
          anchorRect={peekRect}
          onMouseEnter={handlePeekMouseEnter}
          onMouseLeave={handlePeekMouseLeave}
        />
      )}
    </div>
  );
}
