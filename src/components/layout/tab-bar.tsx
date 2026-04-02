"use client";

import { useCallback, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { X, Pin, SplitSquareHorizontal, FileText } from "lucide-react";
import { useTabsStore, type Tab } from "@/stores/tabs";

export function TabBar() {
  const router = useRouter();
  const tabs = useTabsStore((s) => s.tabs);
  const activeTabId = useTabsStore((s) => s.activeTabId);
  const setActiveTab = useTabsStore((s) => s.setActiveTab);
  const closeTab = useTabsStore((s) => s.closeTab);
  const pinTab = useTabsStore((s) => s.pinTab);
  const unpinTab = useTabsStore((s) => s.unpinTab);
  const openSplit = useTabsStore((s) => s.openSplit);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tabId: string } | null>(null);
  const tabBarRef = useRef<HTMLDivElement>(null);

  const handleTabClick = useCallback(
    (tab: Tab) => {
      setActiveTab(tab.id);
      router.push(tab.url);
    },
    [setActiveTab, router],
  );

  const handleTabClose = useCallback(
    (e: React.MouseEvent, tabId: string) => {
      e.stopPropagation();
      closeTab(tabId);
    },
    [closeTab],
  );

  const handleContextMenu = useCallback((e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, tabId });
  }, []);

  if (tabs.length === 0) return null;

  return (
    <div
      ref={tabBarRef}
      className="flex items-center h-9 overflow-x-auto border-b"
      style={{
        backgroundColor: "var(--bg-primary)",
        borderColor: "var(--border-divider)",
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab)}
            onContextMenu={(e) => handleContextMenu(e, tab.id)}
            className="group flex items-center gap-1.5 px-3 h-full text-xs min-w-0 max-w-[180px] border-r relative shrink-0"
            style={{
              backgroundColor: isActive ? "var(--bg-primary)" : "var(--bg-secondary)",
              borderColor: "var(--border-divider)",
              color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
              borderBottom: isActive ? "2px solid #2383e2" : "2px solid transparent",
            }}
          >
            {tab.isPinned && <Pin size={10} style={{ color: "var(--text-tertiary)" }} />}
            <span className="flex-shrink-0">
              {tab.icon || <FileText size={12} />}
            </span>
            <span className="truncate">{tab.title || "Untitled"}</span>
            {!tab.isPinned && (
              <span
                onClick={(e) => handleTabClose(e, tab.id)}
                className="flex-shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-notion-bg-hover"
                style={{ color: "var(--text-tertiary)" }}
              >
                <X size={12} />
              </span>
            )}
          </button>
        );
      })}

      {/* Context menu */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-50"
            onClick={() => setContextMenu(null)}
          />
          <div
            className="fixed z-50 rounded-lg py-1 min-w-[160px]"
            style={{
              left: contextMenu.x,
              top: contextMenu.y,
              backgroundColor: "var(--bg-primary)",
              boxShadow: "var(--shadow-popup)",
              border: "1px solid var(--border-default)",
            }}
          >
            {(() => {
              const tab = tabs.find((t) => t.id === contextMenu.tabId);
              if (!tab) return null;
              return (
                <>
                  <button
                    onClick={() => {
                      tab.isPinned ? unpinTab(tab.id) : pinTab(tab.id);
                      setContextMenu(null);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-notion-bg-hover"
                    style={{ color: "var(--text-primary)" }}
                  >
                    <Pin size={12} />
                    {tab.isPinned ? "Unpin tab" : "Pin tab"}
                  </button>
                  <button
                    onClick={() => {
                      openSplit(tab.id);
                      setContextMenu(null);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-notion-bg-hover"
                    style={{ color: "var(--text-primary)" }}
                  >
                    <SplitSquareHorizontal size={12} />
                    Open in split view
                  </button>
                  {!tab.isPinned && (
                    <button
                      onClick={() => {
                        closeTab(tab.id);
                        setContextMenu(null);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-notion-bg-hover"
                      style={{ color: "#eb5757" }}
                    >
                      <X size={12} />
                      Close tab
                    </button>
                  )}
                </>
              );
            })()}
          </div>
        </>
      )}
    </div>
  );
}
