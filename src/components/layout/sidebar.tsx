"use client";

import { useRouter, useParams } from "next/navigation";
import { useSidebarStore } from "@/stores/sidebar";
import { useCommandPaletteStore } from "@/stores/command-palette";
import { SidebarResizer } from "./sidebar-resizer";
import { SidebarPageItem } from "./sidebar-page-item";
import { SidebarFavorites } from "./sidebar-favorites";
import { SidebarTrash } from "./sidebar-trash";
import { cn } from "@/lib/utils";
import { trpc } from "@/server/trpc/client";

export function Sidebar() {
  const router = useRouter();
  const params = useParams();
  const workspaceId = params.workspaceId as string;
  const { isOpen, width, isResizing } = useSidebarStore();
  const openPalette = useCommandPaletteStore((s) => s.open);

  const { data: pages } = trpc.page.list.useQuery(
    { workspaceId },
    { enabled: !!workspaceId }
  );
  const { data: memberships } = trpc.workspace.list.useQuery();
  const workspace = memberships?.find((m) => m.workspaceId === workspaceId)?.workspace;

  const utils = trpc.useUtils();
  const createPage = trpc.page.create.useMutation({
    onSuccess: (newPage) => {
      utils.page.list.invalidate();
      router.push(`/${workspaceId}/${newPage.id}`);
    },
  });

  return (
    <>
      <aside
        className={cn(
          "fixed top-0 left-0 bottom-0 flex flex-col bg-notion-bg-sidebar",
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
            <span className="mr-2 text-lg">{workspace?.icon || "📋"}</span>
            <span className="truncate flex-1">{workspace?.name || "Workspace"}</span>
          </div>

          {/* Search */}
          <button
            onClick={openPalette}
            className="flex items-center gap-2 mx-2 px-2 py-1 rounded hover:bg-notion-bg-hover cursor-pointer text-left w-auto"
            style={{ fontSize: "14px", color: "var(--text-secondary)" }}
          >
            <span>🔍</span>
            <span>검색</span>
            <span className="ml-auto text-xs opacity-50">⌘K</span>
          </button>

          {/* Settings */}
          <button
            onClick={() => router.push(`/${workspaceId}/settings`)}
            className="flex items-center gap-2 mx-2 px-2 py-1 rounded hover:bg-notion-bg-hover cursor-pointer text-left w-auto"
            style={{ fontSize: "14px", color: "var(--text-secondary)" }}
          >
            <span>⚙️</span>
            <span>설정</span>
          </button>

          {/* Divider */}
          <div
            className="mx-3 my-1"
            style={{ height: "1px", backgroundColor: "var(--border-divider)" }}
          />

          {/* Page Tree */}
          <div className="flex-1 overflow-y-auto px-1">
            {workspaceId && <SidebarFavorites workspaceId={workspaceId} />}

            <div
              className="px-3 py-1 mt-2"
              style={{
                fontSize: "12px",
                fontWeight: 500,
                color: "var(--text-tertiary)",
                letterSpacing: "0.02em",
              }}
            >
              개인 페이지
            </div>
            {pages?.map((page) => (
              <SidebarPageItem key={page.id} page={page} workspaceId={workspaceId} />
            ))}
            {(!pages || pages.length === 0) && (
              <div className="px-3 py-2 text-xs" style={{ color: "var(--text-tertiary)" }}>
                페이지가 없습니다
              </div>
            )}
          </div>

          {/* Trash */}
          {workspaceId && <SidebarTrash workspaceId={workspaceId} />}

          {/* New Page */}
          <button
            onClick={() => createPage.mutate({ workspaceId, title: "" })}
            className="flex items-center gap-2 mx-2 mb-2 px-2 py-1 rounded hover:bg-notion-bg-hover cursor-pointer text-left w-auto"
            style={{ fontSize: "14px", color: "var(--text-secondary)" }}
          >
            <span>➕</span>
            <span>새 페이지</span>
          </button>
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
