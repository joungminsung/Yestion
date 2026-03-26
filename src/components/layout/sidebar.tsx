"use client";

import { useSidebarStore } from "@/stores/sidebar";
import { SidebarResizer } from "./sidebar-resizer";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const { isOpen, width, isResizing } = useSidebarStore();

  return (
    <>
      <aside
        className={cn(
          "fixed top-0 left-0 bottom-0 flex flex-col",
          "bg-notion-bg-sidebar",
          !isResizing && "transition-all duration-300 ease-in-out"
        )}
        style={{
          width: isOpen ? `${width}px` : "0px",
          zIndex: "var(--z-sidebar)",
          overflow: "hidden",
        }}
      >
        <div className="flex flex-col h-full" style={{ width: `${width}px` }}>
          {/* Workspace Switcher */}
          <div
            className="flex items-center px-3 h-[45px] hover:bg-notion-bg-hover cursor-pointer"
            style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-primary)" }}
          >
            <span className="mr-2 text-lg">📋</span>
            <span className="truncate flex-1">Workspace</span>
          </div>

          {/* Search */}
          <div
            className="flex items-center gap-2 mx-2 px-2 py-1 rounded hover:bg-notion-bg-hover cursor-pointer"
            style={{ fontSize: "14px", color: "var(--text-secondary)" }}
          >
            <span>🔍</span>
            <span>검색</span>
            <span className="ml-auto text-xs opacity-50">⌘K</span>
          </div>

          {/* Settings */}
          <div
            className="flex items-center gap-2 mx-2 px-2 py-1 rounded hover:bg-notion-bg-hover cursor-pointer"
            style={{ fontSize: "14px", color: "var(--text-secondary)" }}
          >
            <span>⚙️</span>
            <span>설정</span>
          </div>

          {/* Divider */}
          <div className="mx-3 my-1" style={{ height: "1px", backgroundColor: "var(--border-divider)" }} />

          {/* Sections */}
          <div className="flex-1 overflow-y-auto px-1">
            <div className="px-3 py-1" style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-tertiary)", letterSpacing: "0.02em" }}>
              즐겨찾기
            </div>
            <div className="px-3 py-1 mt-4" style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-tertiary)", letterSpacing: "0.02em" }}>
              개인 페이지
            </div>
          </div>

          {/* New Page */}
          <div
            className="flex items-center gap-2 mx-2 mb-2 px-2 py-1 rounded hover:bg-notion-bg-hover cursor-pointer"
            style={{ fontSize: "14px", color: "var(--text-secondary)" }}
          >
            <span>➕</span>
            <span>새 페이지</span>
          </div>
        </div>

        <SidebarResizer />
      </aside>

      {/* Spacer */}
      <div
        className={cn(!isResizing && "transition-all duration-300 ease-in-out")}
        style={{ width: isOpen ? `${width}px` : "0px", flexShrink: 0 }}
      />
    </>
  );
}
