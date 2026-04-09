"use client";

import { useRouter, useParams, usePathname } from "next/navigation";
import Link from "next/link";
import { useRef, useCallback, useMemo, useState, useEffect } from "react";
import { useSidebarStore } from "@/stores/sidebar";
import { useToastStore } from "@/stores/toast";
import { useCommandPaletteStore } from "@/stores/command-palette";
import { SidebarResizer } from "./sidebar-resizer";
import { SidebarPageItem } from "./sidebar-page-item";
import { SidebarFavorites } from "./sidebar-favorites";
import { SidebarRecent } from "./sidebar-recent";
import { SidebarTrash } from "./sidebar-trash";
import { WorkspaceSwitcher } from "./workspace-switcher";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { trpc } from "@/server/trpc/client";
import { Search, Settings, Plus, FileText, LayoutTemplate, Home, Database, Users, ChevronRight, ChevronsLeft, MoreHorizontal } from "lucide-react";
import { useSidebarKeyboardNav } from "./sidebar-keyboard-nav";
import { PageTemplatePicker } from "@/components/page/page-template-picker";
import { TemplateGallery } from "@/components/page/template-gallery";
import { TeamspaceSettingsModal } from "./teamspace-settings-modal";
import { SidebarChannelItem } from "./sidebar-channel-item";
import { CreateChannelModal } from "./create-channel-modal";
import { useTranslations } from "next-intl";
import { useDevice } from "@/components/providers/responsive-provider";
import { useTouchGestures } from "@/hooks/use-touch-gestures";

const COMPACT_SIDEBAR_WIDTH = "min(85vw, 320px)";

export function Sidebar() {
  const t = useTranslations("sidebar");
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const workspaceId = params.workspaceId as string;
  const { isOpen, width, isResizing, isHoverExpanded } = useSidebarStore();
  const { isMobile, isTablet } = useDevice();
  const isCompactSidebar = isMobile || isTablet;

  // Swipe to open/close sidebar on compact viewports
  useTouchGestures({
    onSwipe: (direction) => {
      if (direction === "right" && !isOpen && isCompactSidebar) {
        useSidebarStore.getState().setOpen(true);
      }
      if (direction === "left" && isOpen && isCompactSidebar) {
        useSidebarStore.getState().setOpen(false);
      }
    },
    swipeThreshold: 60,
  });

  // Close overlay sidebar on navigation change or when entering compact mode.
  useEffect(() => {
    if (isCompactSidebar) {
      useSidebarStore.getState().setOpen(false);
    }
  }, [pathname, isCompactSidebar]);
  const openPalette = useCommandPaletteStore((s) => s.open);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const collapseTimestampRef = useRef(0);

  const handleHoverZoneEnter = useCallback(() => {
    // Ignore hover expansion for 600ms after manual collapse to prevent immediate reopen
    if (Date.now() - collapseTimestampRef.current < 600) return;
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

  const { data: teamspaces } = trpc.teamspace.list.useQuery(
    { workspaceId },
    { enabled: !!workspaceId, refetchInterval: 15000 },
  );
  const { data: collaborationCapabilities } = trpc.channel.getCapabilities.useQuery(
    { workspaceId },
    { enabled: !!workspaceId, refetchOnWindowFocus: false, staleTime: 60_000 },
  );
  const { data: channels } = trpc.channel.list.useQuery(
    { workspaceId },
    { enabled: !!workspaceId, refetchOnWindowFocus: false, refetchInterval: 10000 },
  );

  // Build tree from flat list, split by teamspace
  type FlatPage = NonNullable<typeof flatPages>[number];
  type PageNode = FlatPage & { children: PageNode[] };

  const buildTree = useCallback((pageList: FlatPage[]): PageNode[] => {
    const map = new Map<string, PageNode>();
    for (const p of pageList) {
      map.set(p.id, { ...p, children: [] });
    }
    const roots: PageNode[] = [];
    for (const p of pageList) {
      const node = map.get(p.id)!;
      if (p.parentId && map.has(p.parentId)) {
        map.get(p.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  }, []);

  // Personal pages (no teamspaceId)
  const personalPages = useMemo(
    () => flatPages ? buildTree(flatPages.filter((p) => !p.teamspaceId)) : undefined,
    [flatPages, buildTree]
  );

  // Group pages by teamspace
  const teamspacePages = useMemo(
    () => flatPages
      ? (teamspaces ?? []).reduce<Record<string, PageNode[]>>((acc, ts) => {
          acc[ts.id] = buildTree(flatPages.filter((p) => p.teamspaceId === ts.id));
          return acc;
        }, {})
      : {},
    [flatPages, teamspaces, buildTree]
  );
  const rootChannels = useMemo(
    () => (channels ?? []).filter((channel) => !channel.teamspaceId),
    [channels],
  );
  const teamspaceChannels = useMemo(
    () =>
      (channels ?? []).reduce<Record<string, NonNullable<typeof channels>>>((acc, channel) => {
        if (!channel.teamspaceId) {
          return acc;
        }

        if (!acc[channel.teamspaceId]) {
          acc[channel.teamspaceId] = [];
        }

        acc[channel.teamspaceId]!.push(channel);
        return acc;
      }, {}),
    [channels],
  );

  // Legacy: keep `pages` reference for keyboard nav
  const pages = personalPages;
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
          teamspaceId: input.teamspaceId ?? null,
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

  const createDatabase = trpc.database.create.useMutation({
    onSettled: () => utils.page.list.invalidate(),
    onSuccess: (data) => {
      router.push(`/${workspaceId}/database/${data.id}`);
    },
  });

  const [showNewPageMenu, setShowNewPageMenu] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showTemplateGallery, setShowTemplateGallery] = useState(false);
  const [showCreateTeamspace, setShowCreateTeamspace] = useState(false);
  const [settingsTeamspaceId, setSettingsTeamspaceId] = useState<string | null>(null);
  const [expandedTeamspaces, setExpandedTeamspaces] = useState<Set<string>>(new Set());
  const [createChannelScope, setCreateChannelScope] = useState<{
    teamspaceId: string | null;
    scopeLabel: string;
  } | null>(null);
  const newPageMenuRef = useRef<HTMLDivElement>(null);

  const toggleTeamspaceExpand = (id: string) => {
    setExpandedTeamspaces((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addToast = useToastStore((s) => s.addToast);
  const createTeamspace = trpc.teamspace.create.useMutation({
    onSuccess: (ts) => {
      utils.teamspace.list.invalidate();
      setExpandedTeamspaces((prev) => new Set(prev).add(ts.id));
      setShowCreateTeamspace(false);
    },
    onError: (err) => {
      addToast({ message: err.message, type: "error" });
    },
  });
  const createChannel = trpc.channel.create.useMutation({
    onSuccess: (channel) => {
      utils.channel.list.invalidate({ workspaceId });
      setCreateChannelScope(null);
      router.push(`/${workspaceId}/channels/${channel.id}`);
    },
    onError: (err) => {
      addToast({ message: err.message, type: "error" });
    },
  });

  useSidebarKeyboardNav(pages || [], workspaceId);

  // Listen for full-page database creation requests (from slash commands)
  useEffect(() => {
    function handleCreateFullPageDb() {
      if (workspaceId) {
        createDatabase.mutate({
          workspaceId,
          name: "제목 없음 데이터베이스",
        });
      }
    }
    document.addEventListener("database:createFullPage", handleCreateFullPageDb);
    return () => document.removeEventListener("database:createFullPage", handleCreateFullPageDb);
  }, [workspaceId, createDatabase]);

  return (
    <>
      {/* Hover zone: invisible strip on the left edge when sidebar is collapsed (desktop only) */}
      {!isCompactSidebar && !isOpen && !isHoverExpanded && (
        <div
          className="fixed top-0 left-0 bottom-0 w-2 z-[99]"
          onMouseEnter={handleHoverZoneEnter}
          onMouseLeave={handleHoverZoneLeave}
        />
      )}

      {/* Mobile backdrop */}
      {isCompactSidebar && isOpen && (
        <div
          className="fixed inset-0 z-[99] bg-black/40 transition-opacity duration-300"
          onClick={() => useSidebarStore.getState().setOpen(false)}
          aria-hidden="true"
        />
      )}

      <motion.aside
        role="navigation"
        aria-label="페이지 네비게이션"
        className={cn(
          "flex flex-col bg-notion-bg-sidebar",
          isCompactSidebar
            ? "fixed top-0 left-0 bottom-0 z-[100]"
            : "relative h-full shrink-0 border-r"
        )}
        animate={{
          width: isCompactSidebar
            ? COMPACT_SIDEBAR_WIDTH
            : (isOpen || isHoverExpanded ? width : 0),
          x: isCompactSidebar ? (isOpen ? "0%" : "-100%") : 0,
        }}
        transition={{
          type: "spring",
          stiffness: 400,
          damping: 32,
          mass: 0.8,
        }}
        style={{
          zIndex: isCompactSidebar ? 100 : undefined,
          overflow: "hidden",
          pointerEvents: isCompactSidebar && !isOpen ? "none" : "auto",
          borderColor: isCompactSidebar ? undefined : "var(--border-default)",
          boxShadow: (isCompactSidebar && isOpen) || (isHoverExpanded && !isOpen)
            ? "var(--shadow-popup)"
            : undefined,
        }}
        onMouseLeave={isCompactSidebar ? undefined : handleSidebarMouseLeave}
        onMouseEnter={isCompactSidebar ? undefined : handleSidebarMouseEnter}
      >
        <div className="flex flex-col h-full" style={{ width: isCompactSidebar ? "100%" : `${width}px` }}>
          {/* Workspace Switcher + Collapse toggle */}
          <div className="group/header flex items-center">
            <div className="min-w-0 flex-1">
              <WorkspaceSwitcher currentWorkspaceId={workspaceId} />
            </div>
            {!isCompactSidebar && (
              <button
                onClick={(e) => { e.stopPropagation(); collapseTimestampRef.current = Date.now(); useSidebarStore.getState().setOpen(false); useSidebarStore.getState().setHoverExpanded(false); }}
                className="mr-2 shrink-0 rounded p-1 opacity-0 transition-opacity hover:bg-notion-bg-hover group-hover/header:opacity-100"
                style={{ color: "var(--text-tertiary)" }}
                title="사이드바 접기"
              >
                <ChevronsLeft size={16} />
              </button>
            )}
          </div>

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

          {/* Home / Dashboard */}
          <Link
            href={`/${workspaceId}`}
            className={cn(
              "flex items-center gap-2 mx-2 px-2 py-1 rounded hover:bg-notion-bg-hover cursor-pointer text-left w-auto",
              pathname === `/${workspaceId}` && "bg-notion-bg-hover font-medium"
            )}
            style={{ fontSize: "14px", color: pathname === `/${workspaceId}` ? "var(--text-primary)" : "var(--text-secondary)" }}
          >
            <Home size={16} />
            <span>홈</span>
          </Link>

          {/* Templates Gallery */}
          <button
            onClick={() => setShowTemplateGallery(true)}
            className="flex items-center gap-2 mx-2 px-2 py-1 rounded hover:bg-notion-bg-hover cursor-pointer text-left w-auto"
            style={{ fontSize: "14px", color: "var(--text-secondary)" }}
          >
            <LayoutTemplate size={16} />
            <span>템플릿</span>
          </button>

          {/* Settings */}
          <Link
            href={`/${workspaceId}/settings`}
            className={cn(
              "flex items-center gap-2 mx-2 px-2 py-1 rounded hover:bg-notion-bg-hover cursor-pointer text-left w-auto",
              pathname?.includes("/settings") && "bg-notion-bg-hover font-medium"
            )}
            style={{ fontSize: "14px", color: pathname?.includes("/settings") ? "var(--text-primary)" : "var(--text-secondary)" }}
          >
            <Settings size={16} />
            <span>{t("settings")}</span>
          </Link>

          {/* Divider */}
          <div
            className="mx-3 my-1"
            style={{ height: "1px", backgroundColor: "var(--border-divider)" }}
          />

          {/* Page Tree */}
          <div className="flex-1 overflow-y-auto px-1">
            {workspaceId && <SidebarRecent workspaceId={workspaceId} />}
            {workspaceId && <SidebarFavorites workspaceId={workspaceId} />}

            {collaborationCapabilities?.channelsEnabled !== false && (
              <>
                <div
                  className="mt-2 flex items-center justify-between px-3 py-1 group"
                  style={{
                    fontSize: "12px",
                    fontWeight: 500,
                    color: "var(--text-tertiary)",
                    letterSpacing: "0.02em",
                  }}
                >
                  <span>채널</span>
                  <button
                    onClick={() =>
                      setCreateChannelScope({
                        teamspaceId: null,
                        scopeLabel: "워크스페이스",
                      })
                    }
                    className="opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center rounded hover:bg-notion-bg-hover"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    <Plus size={12} />
                  </button>
                </div>
                {rootChannels.length > 0 ? (
                  rootChannels.map((channel) => (
                    <SidebarChannelItem
                      key={channel.id}
                      workspaceId={workspaceId}
                      channel={channel}
                    />
                  ))
                ) : (
                  <div className="px-3 py-2 text-xs" style={{ color: "var(--text-tertiary)" }}>
                    페이지 밖 대화용 채널을 만들어보세요.
                  </div>
                )}
              </>
            )}

            {/* Teamspaces */}
            {teamspaces && teamspaces.length > 0 && (
              <>
                <div
                  className="flex items-center justify-between px-3 py-1 mt-2 group"
                  style={{
                    fontSize: "12px",
                    fontWeight: 500,
                    color: "var(--text-tertiary)",
                    letterSpacing: "0.02em",
                  }}
                >
                  <span>{t("teamspaces")}</span>
                  <button
                    onClick={() => setShowCreateTeamspace(true)}
                    className="opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center rounded hover:bg-notion-bg-hover"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    <Plus size={12} />
                  </button>
                </div>
                {teamspaces.map((ts) => {
                  const isTeamExpanded = expandedTeamspaces.has(ts.id);
                  const tsPages = teamspacePages[ts.id] ?? [];
                  const tsChannels = teamspaceChannels[ts.id] ?? [];
                  return (
                    <div key={ts.id}>
                      <div
                        className="group flex items-center gap-1 py-[2px] pr-2 rounded-sm cursor-pointer hover:bg-notion-bg-hover"
                        style={{
                          paddingLeft: "12px",
                          fontSize: "14px",
                          color: "var(--text-primary)",
                          minHeight: "28px",
                        }}
                        onClick={() => toggleTeamspaceExpand(ts.id)}
                      >
                        <button
                          className="w-5 h-5 flex items-center justify-center rounded hover:bg-notion-bg-active flex-shrink-0"
                          style={{ color: "var(--text-tertiary)" }}
                        >
                          <ChevronRight
                            size={12}
                            style={{
                              transform: isTeamExpanded ? "rotate(90deg)" : "rotate(0deg)",
                              transition: "transform 0.15s",
                            }}
                          />
                        </button>
                        <span className="flex-shrink-0 text-sm" style={{ width: "20px" }}>
                          {ts.icon || <Users size={16} style={{ color: "var(--text-tertiary)" }} />}
                        </span>
                        <span className="truncate flex-1 font-medium" style={{ fontSize: "13px" }}>
                          {ts.name}
                        </span>
                        <span
                          className="text-xs flex-shrink-0"
                          style={{ color: "var(--text-tertiary)" }}
                        >
                          {ts.members.length}
                        </span>
                        <div className="hidden group-hover:flex items-center gap-0.5 flex-shrink-0 ml-1">
                          <button
                            className="w-5 h-5 flex items-center justify-center rounded hover:bg-notion-bg-active"
                            style={{ color: "var(--text-tertiary)" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSettingsTeamspaceId(ts.id);
                            }}
                          >
                            <MoreHorizontal size={14} />
                          </button>
                          <button
                            className="w-5 h-5 flex items-center justify-center rounded hover:bg-notion-bg-active"
                            style={{ color: "var(--text-tertiary)" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              createPage.mutate({ workspaceId, title: "", teamspaceId: ts.id });
                            }}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                      {isTeamExpanded && (
                        <>
                          {collaborationCapabilities?.channelsEnabled !== false && (
                            <>
                              <div
                                className="mt-1 flex items-center justify-between pr-2"
                                style={{ paddingLeft: "44px" }}
                              >
                                <span
                                  className="text-[11px] font-medium uppercase tracking-[0.16em]"
                                  style={{ color: "var(--text-tertiary)" }}
                                >
                                  Channels
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCreateChannelScope({
                                      teamspaceId: ts.id,
                                      scopeLabel: ts.name,
                                    });
                                  }}
                                  className="flex h-5 w-5 items-center justify-center rounded hover:bg-notion-bg-hover"
                                  style={{ color: "var(--text-tertiary)" }}
                                >
                                  <Plus size={12} />
                                </button>
                              </div>
                              {tsChannels.length > 0 ? (
                                tsChannels.map((channel) => (
                                  <SidebarChannelItem
                                    key={channel.id}
                                    workspaceId={workspaceId}
                                    channel={channel}
                                    depth={2}
                                  />
                                ))
                              ) : (
                                <div
                                  className="px-3 py-1 text-xs"
                                  style={{ color: "var(--text-tertiary)", paddingLeft: "44px" }}
                                >
                                  팀스페이스 채널 없음
                                </div>
                              )}
                            </>
                          )}
                          <div
                            className="mt-2 text-[11px] font-medium uppercase tracking-[0.16em]"
                            style={{ color: "var(--text-tertiary)", paddingLeft: "44px" }}
                          >
                            Pages
                          </div>
                          {tsPages.map((page) => (
                            <SidebarPageItem key={page.id} page={page} workspaceId={workspaceId} depth={1} />
                          ))}
                          {tsPages.length === 0 && (
                            <div
                              className="px-3 py-1 text-xs"
                              style={{ color: "var(--text-tertiary)", paddingLeft: "44px" }}
                            >
                              {t("noTeamspacePages")}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </>
            )}

            {/* Create teamspace button when none exist */}
            {(!teamspaces || teamspaces.length === 0) && (
              <div
                className="flex items-center justify-between px-3 py-1 mt-2 group"
                style={{
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "var(--text-tertiary)",
                  letterSpacing: "0.02em",
                }}
              >
                <span>{t("teamspaces")}</span>
                <button
                  onClick={() => setShowCreateTeamspace(true)}
                  className="opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center rounded hover:bg-notion-bg-hover"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  <Plus size={12} />
                </button>
              </div>
            )}

            {/* Personal pages */}
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
            {personalPages?.map((page) => (
              <SidebarPageItem key={page.id} page={page} workspaceId={workspaceId} />
            ))}
            {(!personalPages || personalPages.length === 0) && (
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
                  <div
                    className="mx-2 my-1"
                    style={{ height: "1px", backgroundColor: "var(--border-divider)" }}
                  />
                  <button
                    onClick={() => {
                      setShowNewPageMenu(false);
                      createDatabase.mutate({
                        workspaceId,
                        name: "제목 없음 데이터베이스",
                      });
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 hover:bg-notion-bg-hover text-left"
                    style={{ fontSize: "13px", color: "var(--text-primary)" }}
                  >
                    <Database size={15} style={{ color: "var(--text-tertiary)" }} />
                    <span>데이터베이스</span>
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

          {/* Teamspace Settings Modal */}
          {settingsTeamspaceId && (
            <TeamspaceSettingsModal
              teamspaceId={settingsTeamspaceId}
              workspaceId={workspaceId}
              onClose={() => setSettingsTeamspaceId(null)}
            />
          )}

          {/* Create Teamspace Modal */}
          {showCreateTeamspace && (
            <CreateTeamspaceModal
              onClose={() => setShowCreateTeamspace(false)}
              onCreate={(name, icon) => {
                createTeamspace.mutate({ workspaceId, name, icon: icon || undefined });
                // Modal closes via onSuccess callback
              }}
            />
          )}

          {/* Template Gallery Modal (80 templates) */}
          {showTemplateGallery && (
            <TemplateGallery
              workspaceId={workspaceId}
              onSelect={(template) => {
                setShowTemplateGallery(false);
                createPage.mutate({
                  workspaceId,
                  title: template.name,
                  icon: template.icon,
                  blocks: template.blocks as Record<string, unknown>[],
                });
              }}
              onClose={() => setShowTemplateGallery(false)}
            />
          )}

          {createChannelScope && (
            <CreateChannelModal
              scopeLabel={createChannelScope.scopeLabel}
              onClose={() => setCreateChannelScope(null)}
              onCreate={(input) => {
                createChannel.mutate({
                  workspaceId,
                  teamspaceId: createChannelScope.teamspaceId,
                  name: input.name,
                  description: input.description,
                  type: input.type,
                });
              }}
            />
          )}
        </div>

        {!isCompactSidebar && <SidebarResizer />}
      </motion.aside>

      {/* Expand button — fixed to left edge when collapsed on desktop */}
      {!isCompactSidebar && !isOpen && !isHoverExpanded && (
        <button
          onClick={() => useSidebarStore.getState().setOpen(true)}
          className="fixed left-2 top-14 z-[98] rounded-md p-1.5 transition-colors hover:bg-notion-bg-hover"
          style={{ color: "var(--text-tertiary)" }}
          title="사이드바 펼치기"
        >
          <ChevronsLeft size={16} style={{ transform: "rotate(180deg)" }} />
        </button>
      )}
    </>
  );
}

function CreateTeamspaceModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string, icon: string | null) => void;
}) {
  const t = useTranslations("sidebar");
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative rounded-xl p-6 w-[400px]"
        style={{
          backgroundColor: "var(--bg-primary)",
          boxShadow: "var(--shadow-popup)",
          border: "1px solid var(--border-default)",
        }}
      >
        <h2
          className="text-base font-semibold mb-4"
          style={{ color: "var(--text-primary)" }}
        >
          {t("createTeamspace")}
        </h2>
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) {
              onCreate(name.trim(), null);
            }
            if (e.key === "Escape") onClose();
          }}
          placeholder={t("teamspaceName")}
          className="w-full px-3 py-2 rounded-lg text-sm mb-4"
          style={{
            backgroundColor: "var(--bg-secondary)",
            border: "1px solid var(--border-default)",
            color: "var(--text-primary)",
            outline: "none",
          }}
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-sm hover:bg-notion-bg-hover"
            style={{ color: "var(--text-secondary)" }}
          >
            {t("cancel")}
          </button>
          <button
            onClick={() => name.trim() && onCreate(name.trim(), null)}
            disabled={!name.trim()}
            className="px-3 py-1.5 rounded-lg text-sm font-medium"
            style={{
              backgroundColor: name.trim() ? "#2383e2" : "var(--bg-secondary)",
              color: name.trim() ? "#fff" : "var(--text-tertiary)",
              cursor: name.trim() ? "pointer" : "not-allowed",
            }}
          >
            {t("create")}
          </button>
        </div>
      </div>
    </div>
  );
}
