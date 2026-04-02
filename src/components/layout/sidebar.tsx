"use client";

import { useRouter, useParams, usePathname } from "next/navigation";
import { useRef, useCallback, useState, useEffect } from "react";
import { useSidebarStore } from "@/stores/sidebar";
import { useCommandPaletteStore } from "@/stores/command-palette";
import { SidebarResizer } from "./sidebar-resizer";
import { SidebarPageItem } from "./sidebar-page-item";
import { SidebarFavorites } from "./sidebar-favorites";
import { SidebarRecent } from "./sidebar-recent";
import { SidebarTrash } from "./sidebar-trash";
import { WorkspaceSwitcher } from "./workspace-switcher";
import { m } from "framer-motion";
import { cn } from "@/lib/utils";
import { trpc } from "@/server/trpc/client";
import { Search, Settings, Plus, FileText, LayoutTemplate, BarChart3, Zap } from "lucide-react";
import { useSidebarKeyboardNav } from "./sidebar-keyboard-nav";
import { PageTemplatePicker } from "@/components/page/page-template-picker";
import { useTranslations } from "next-intl";
import { useDevice } from "@/components/providers/responsive-provider";
import { useTouchGestures } from "@/hooks/use-touch-gestures";

const MOBILE_SIDEBAR_WIDTH = "min(85vw, 320px)";

export function Sidebar() {
  const t = useTranslations("sidebar");
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const workspaceId = params.workspaceId as string;
  const { isOpen, width, isResizing, isHoverExpanded } = useSidebarStore();
  const { isMobile } = useDevice();

  // Swipe to open/close sidebar on mobile
  useTouchGestures({
    onSwipe: (direction) => {
      if (direction === "right" && !isOpen && isMobile) {
        useSidebarStore.getState().setOpen(true);
      }
      if (direction === "left" && isOpen && isMobile) {
        useSidebarStore.getState().setOpen(false);
      }
    },
    swipeThreshold: 60,
  });

  // Close sidebar on navigation change or when entering mobile mode.
  useEffect(() => {
    if (isMobile) {
      useSidebarStore.getState().setOpen(false);
    }
  }, [pathname, isMobile]);
  const openPalette = useCommandPaletteStore((s) => s.open);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleHoverZoneEnter = useCallback(() => {
    if (leaveTimeout.current) {
      clearTimeout(leaveTimeout.current);
      leaveTimeout.current = null;
    }
    hoverTimeout.current = setTimeout(() => {
      useSidebarStore.getState().setHoverExpanded(true);
    }, 200);
  }, []);

  const handleHoverZoneLeave = useCallback(() => {
    if (hoverTimeout.current) {
      clearTimeout(hoverTimeout.current);
      hoverTimeout.current = null;
    }
  }, []);

  const handleSidebarMouseLeave = useCallback(() => {
    if (isHoverExpanded && !isOpen) {
      leaveTimeout.current = setTimeout(() => {
        useSidebarStore.getState().setHoverExpanded(false);
      }, 500);
    }
  }, [isHoverExpanded, isOpen]);

  const handleSidebarMouseEnter = useCallback(() => {
    if (leaveTimeout.current) {
      clearTimeout(leaveTimeout.current);
      leaveTimeout.current = null;
    }
  }, []);

  const { data: flatPages } = trpc.page.list.useQuery(
    { workspaceId },
    { enabled: !!workspaceId, refetchInterval: 10000 },
  );

  // Build tree from flat list
  const pages = (() => {
    if (!flatPages) return undefined;
    type FlatPage = (typeof flatPages)[number];
    type PageNode = FlatPage & { children: PageNode[] };
    const map = new Map<string, PageNode>();
    for (const p of flatPages) {
      map.set(p.id, { ...p, children: [] });
    }
    const roots: PageNode[] = [];
    for (const p of flatPages) {
      const node = map.get(p.id)!;
      if (p.parentId && map.has(p.parentId)) {
        map.get(p.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  })();
  const utils = trpc.useUtils();
  const createPage = trpc.page.create.useMutation({
    onMutate: async (input) => {
      await utils.page.list.cancel();
      const prev = utils.page.list.getData({ workspaceId });
      const tempId = `temp-${Date.now()}`;
      utils.page.list.setData({ workspaceId }, (old) => [
        ...(old ?? []),
        {
          id: tempId,
          title: input.title ?? "",
          icon: null,
          parentId: input.parentId ?? null,
          workspaceId,
          isDeleted: false,
          position: (old?.length ?? 0),
          createdAt: new Date(),
          updatedAt: new Date(),
          cover: null,
          isLocked: false,
          isFullWidth: false,
        } as NonNullable<typeof old>[number],
      ]);
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) utils.page.list.setData({ workspaceId }, context.prev);
    },
    onSettled: () => utils.page.list.invalidate(),
    onSuccess: (newPage) => {
      router.push(`/${workspaceId}/${newPage.id}`);
    },
  });

  const [showNewPageMenu, setShowNewPageMenu] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const newPageMenuRef = useRef<HTMLDivElement>(null);

  useSidebarKeyboardNav(pages || [], workspaceId);

  const sidebarVisible = isOpen || isHoverExpanded;

  return (
    <>
      {/* Hover zone: invisible strip on the left edge when sidebar is collapsed (desktop only) */}
      {!isMobile && !isOpen && !isHoverExpanded && (
        <div
          className="fixed top-0 left-0 bottom-0 w-2 z-[99]"
          onMouseEnter={handleHoverZoneEnter}
          onMouseLeave={handleHoverZoneLeave}
        />
      )}

      {/* Mobile backdrop */}
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 z-[99] bg-black/40 transition-opacity duration-300"
          onClick={() => useSidebarStore.getState().setOpen(false)}
          aria-hidden="true"
        />
      )}

      <m.aside
        role="navigation"
        aria-label="페이지 네비게이션"
        className={cn(
          "fixed top-0 left-0 bottom-0 flex flex-col bg-notion-bg-sidebar",
          isMobile && "z-[100]"
        )}
        animate={{
          width: isMobile
            ? 320
            : (isOpen || isHoverExpanded ? width : 0),
          x: isMobile ? (isOpen ? 0 : -320) : 0,
        }}
        transition={{
          type: "spring",
          stiffness: 400,
          damping: 32,
          mass: 0.8,
        }}
        style={{
          zIndex: 100,
          overflow: "hidden",
          boxShadow: (isMobile && isOpen) || (isHoverExpanded && !isOpen)
            ? "var(--shadow-popup)"
            : undefined,
        }}
        onMouseLeave={isMobile ? undefined : handleSidebarMouseLeave}
        onMouseEnter={isMobile ? undefined : handleSidebarMouseEnter}
      >
        <div className="flex flex-col h-full" style={{ width: isMobile ? MOBILE_SIDEBAR_WIDTH : `${width}px` }}>
          {/* Workspace Switcher */}
          <WorkspaceSwitcher currentWorkspaceId={workspaceId} />

          {/* Search */}
          <button
            onClick={openPalette}
            className="flex items-center gap-2 mx-2 px-2 py-1 rounded hover:bg-notion-bg-hover cursor-pointer text-left w-auto"
            style={{ fontSize: "14px", color: "var(--text-secondary)" }}
          >
            <Search size={16} />
            <span>{t("search")}</span>
            <span className="ml-auto text-xs opacity-50">⌘K</span>
          </button>

          {/* Projects */}
          <button
            onClick={() => router.push(`/${workspaceId}/projects`)}
            className="flex items-center gap-2 mx-2 px-2 py-1 rounded hover:bg-notion-bg-hover cursor-pointer text-left w-auto"
            style={{ fontSize: "14px", color: "var(--text-secondary)" }}
          >
            <BarChart3 size={16} />
            <span>Projects</span>
          </button>

          {/* Automations */}
          <button
            onClick={() => router.push(`/${workspaceId}/automations`)}
            className="flex items-center gap-2 mx-2 px-2 py-1 rounded hover:bg-notion-bg-hover cursor-pointer text-left w-auto"
            style={{ fontSize: "14px", color: "var(--text-secondary)" }}
          >
            <Zap size={16} />
            <span>Automations</span>
          </button>

          {/* Settings */}
          <button
            onClick={() => router.push(`/${workspaceId}/settings`)}
            className="flex items-center gap-2 mx-2 px-2 py-1 rounded hover:bg-notion-bg-hover cursor-pointer text-left w-auto"
            style={{ fontSize: "14px", color: "var(--text-secondary)" }}
          >
            <Settings size={16} />
            <span>{t("settings")}</span>
          </button>

          {/* Divider */}
          <div
            className="mx-3 my-1"
            style={{ height: "1px", backgroundColor: "var(--border-divider)" }}
          />

          {/* Page Tree */}
          <div className="flex-1 overflow-y-auto px-1">
            {workspaceId && <SidebarRecent workspaceId={workspaceId} />}
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
              {t("private")}
            </div>
            {pages?.map((page) => (
              <SidebarPageItem key={page.id} page={page} workspaceId={workspaceId} />
            ))}
            {(!pages || pages.length === 0) && (
              <div className="px-3 py-2 text-xs" style={{ color: "var(--text-tertiary)" }}>
                {t("noPages")}
              </div>
            )}
          </div>

          {/* Trash */}
          {workspaceId && <SidebarTrash workspaceId={workspaceId} />}

          {/* New Page */}
          <div className="relative mx-2 mb-2">
            <button
              onClick={() => setShowNewPageMenu((v) => !v)}
              className="flex items-center gap-2 px-2 py-1 rounded hover:bg-notion-bg-hover cursor-pointer text-left w-full"
              style={{ fontSize: "14px", color: "var(--text-secondary)" }}
            >
              <Plus size={16} />
              <span>{t("newPage")}</span>
            </button>

            {showNewPageMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowNewPageMenu(false)} />
                <div
                  ref={newPageMenuRef}
                  className="absolute bottom-full left-0 mb-1 w-48 rounded-lg py-1 z-20"
                  style={{
                    backgroundColor: "var(--bg-primary)",
                    boxShadow: "var(--shadow-popup)",
                    border: "1px solid var(--border-default)",
                  }}
                >
                  <button
                    onClick={() => {
                      setShowNewPageMenu(false);
                      createPage.mutate({ workspaceId, title: "" });
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 hover:bg-notion-bg-hover text-left"
                    style={{ fontSize: "13px", color: "var(--text-primary)" }}
                  >
                    <FileText size={15} style={{ color: "var(--text-tertiary)" }} />
                    <span>{t("blankPage")}</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowNewPageMenu(false);
                      setShowTemplatePicker(true);
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 hover:bg-notion-bg-hover text-left"
                    style={{ fontSize: "13px", color: "var(--text-primary)" }}
                  >
                    <LayoutTemplate size={15} style={{ color: "var(--text-tertiary)" }} />
                    <span>{t("fromTemplate")}</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Template Picker Modal */}
          {showTemplatePicker && (
            <PageTemplatePicker
              workspaceId={workspaceId}
              onBlank={() => {
                setShowTemplatePicker(false);
                createPage.mutate({ workspaceId, title: "" });
              }}
              onSelect={(pageId) => {
                setShowTemplatePicker(false);
                router.push(`/${workspaceId}/${pageId}`);
              }}
              onClose={() => setShowTemplatePicker(false)}
            />
          )}
        </div>

        {!isMobile && <SidebarResizer />}
      </m.aside>

      {/* Spacer — zero on mobile (overlay doesn't push content) */}
      {!isMobile && (
        <div
          className={cn(!isResizing && "transition-all duration-300 ease-in-out")}
          style={{ width: isOpen ? `${width}px` : "0px", flexShrink: 0 }}
        />
      )}
    </>
  );
}
