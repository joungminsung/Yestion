"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { trpc } from "@/server/trpc/client";
import { useToastStore } from "@/stores/toast";
import { FileText, Search, FolderUp, X } from "lucide-react";

type FlatPage = {
  id: string;
  title: string;
  icon: string | null;
  parentId: string | null;
};

type PageMoveDialogProps = {
  pageId: string;
  workspaceId: string;
  onClose: () => void;
};

export function PageMoveDialog({ pageId, workspaceId, onClose }: PageMoveDialogProps) {
  const [search, setSearch] = useState("");
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [selectedMoveToRoot, setSelectedMoveToRoot] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const addToast = useToastStore((s) => s.addToast);
  const utils = trpc.useUtils();

  const { data: flatPages } = trpc.page.list.useQuery(
    { workspaceId },
    { enabled: !!workspaceId },
  );

  const movePage = trpc.page.move.useMutation({
    onSuccess: () => {
      utils.page.list.invalidate();
      addToast({ message: "페이지가 이동되었습니다", type: "success" });
      onClose();
    },
    onError: () => {
      addToast({ message: "이동에 실패했습니다", type: "error" });
    },
  });

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  // Close on ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Build tree structure, excluding the page being moved and its descendants
  const availablePages = useMemo((): FlatPage[] => {
    if (!flatPages) return [];

    const pages = flatPages as FlatPage[];

    // Find all descendant IDs of the page being moved (to prevent moving into itself)
    const descendantIds = new Set<string>();
    const findDescendants = (parentId: string) => {
      descendantIds.add(parentId);
      for (const p of pages) {
        if (p.parentId === parentId && !descendantIds.has(p.id)) {
          findDescendants(p.id);
        }
      }
    };
    findDescendants(pageId);

    return pages.filter((p: FlatPage) => !descendantIds.has(p.id));
  }, [flatPages, pageId]);

  // Filter by search
  const filteredPages = useMemo((): FlatPage[] => {
    if (!search.trim()) return availablePages;
    const lower = search.toLowerCase();
    return availablePages.filter(
      (p: FlatPage) =>
        (p.title || "제목 없음").toLowerCase().includes(lower),
    );
  }, [availablePages, search]);

  // Build display with depth indicator
  type PageWithDepth = FlatPage & { depth: number };
  const displayPages = useMemo((): PageWithDepth[] => {
    if (search.trim()) {
      // When searching, show flat list
      return filteredPages.map((p: FlatPage) => ({ ...p, depth: 0 }));
    }

    // Build tree and flatten with depth
    const pageMap = new Map(filteredPages.map((p: FlatPage) => [p.id, p]));
    const result: PageWithDepth[] = [];
    const visited = new Set<string>();

    const addWithDepth = (parentId: string | null, depth: number) => {
      for (const p of filteredPages) {
        if (p.parentId === parentId && !visited.has(p.id)) {
          visited.add(p.id);
          result.push({ ...p, depth });
          addWithDepth(p.id, depth + 1);
        }
      }
    };

    // Start from root pages
    addWithDepth(null, 0);

    // Add any remaining (orphaned) pages
    for (const p of filteredPages) {
      if (!visited.has(p.id)) {
        // Check if parent is in our available set
        if (!p.parentId || !pageMap.has(p.parentId)) {
          visited.add(p.id);
          result.push({ ...p, depth: 0 });
          addWithDepth(p.id, 1);
        }
      }
    }

    return result;
  }, [filteredPages, search]);

  const handleConfirm = () => {
    if (selectedMoveToRoot) {
      movePage.mutate({ id: pageId, parentId: null });
    } else if (selectedParentId) {
      movePage.mutate({ id: pageId, parentId: selectedParentId });
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 300 }}>
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        ref={ref}
        className="relative rounded-lg overflow-hidden dropdown-enter"
        style={{
          width: "440px",
          maxHeight: "500px",
          backgroundColor: "var(--bg-primary)",
          boxShadow: "var(--shadow-popup)",
          border: "1px solid var(--border-default)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: "1px solid var(--border-divider)" }}
        >
          <span className="font-medium" style={{ fontSize: "14px", color: "var(--text-primary)" }}>
            페이지 이동
          </span>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-notion-bg-hover"
            style={{ color: "var(--text-tertiary)" }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-2" style={{ borderBottom: "1px solid var(--border-divider)" }}>
          <div
            className="flex items-center gap-2 px-2 py-1.5 rounded"
            style={{
              backgroundColor: "var(--bg-secondary)",
              border: "1px solid var(--border-default)",
            }}
          >
            <Search size={14} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
            <input
              type="text"
              placeholder="페이지 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent outline-none"
              style={{ fontSize: "13px", color: "var(--text-primary)" }}
              autoFocus
            />
          </div>
        </div>

        {/* Page list */}
        <div className="overflow-y-auto" style={{ maxHeight: "320px" }}>
          {/* Move to root option */}
          <button
            onClick={() => {
              setSelectedParentId(null);
              setSelectedMoveToRoot(true);
            }}
            className="w-full flex items-center gap-2 px-4 py-2 hover:bg-notion-bg-hover text-left"
            style={{
              fontSize: "13px",
              color: "var(--text-primary)",
              backgroundColor: selectedMoveToRoot ? "var(--bg-active)" : undefined,
            }}
          >
            <FolderUp size={16} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
            <span className="font-medium">최상위로 이동</span>
          </button>

          <div
            className="mx-4 my-0.5"
            style={{ height: "1px", backgroundColor: "var(--border-divider)" }}
          />

          {displayPages.map((page: PageWithDepth) => (
            <button
              key={page.id}
              onClick={() => {
                setSelectedParentId(page.id);
                setSelectedMoveToRoot(false);
              }}
              className="w-full flex items-center gap-2 py-1.5 hover:bg-notion-bg-hover text-left"
              style={{
                fontSize: "13px",
                color: "var(--text-primary)",
                paddingLeft: `${16 + page.depth * 16}px`,
                paddingRight: "16px",
                backgroundColor:
                  selectedParentId === page.id && !selectedMoveToRoot
                    ? "var(--bg-active)"
                    : undefined,
              }}
            >
              <span className="text-sm flex items-center flex-shrink-0">
                {page.icon || <FileText size={16} />}
              </span>
              <span className="truncate">{page.title || "제목 없음"}</span>
            </button>
          ))}

          {displayPages.length === 0 && (
            <div
              className="px-4 py-6 text-center"
              style={{ fontSize: "13px", color: "var(--text-tertiary)" }}
            >
              이동할 수 있는 페이지가 없습니다
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-4 py-3"
          style={{ borderTop: "1px solid var(--border-divider)" }}
        >
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded text-sm hover:bg-notion-bg-hover"
            style={{ color: "var(--text-secondary)" }}
          >
            취소
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedParentId && !selectedMoveToRoot}
            className="px-3 py-1.5 rounded text-sm text-white disabled:opacity-40"
            style={{
              backgroundColor: "#2383e2",
            }}
          >
            이동
          </button>
        </div>
      </div>
    </div>
  );
}
