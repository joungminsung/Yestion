"use client";

import { useSidebarStore } from "@/stores/sidebar";

export function Topbar() {
  const { isOpen, toggle } = useSidebarStore();

  return (
    <header
      className="sticky top-0 flex items-center justify-between px-3"
      style={{
        height: "var(--topbar-height)",
        zIndex: "var(--z-topbar)",
        backgroundColor: "var(--bg-primary)",
        fontSize: "14px",
      }}
    >
      <div className="flex items-center gap-1">
        {!isOpen && (
          <button
            onClick={toggle}
            className="p-1 rounded hover:bg-notion-bg-hover"
            style={{ color: "var(--text-secondary)" }}
            title="Open sidebar"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2 3h12v1.5H2V3zm0 4.25h12v1.5H2v-1.5zm0 4.25h12V13H2v-1.5z" />
            </svg>
          </button>
        )}
        <div className="flex items-center gap-1 px-1" style={{ color: "var(--text-secondary)" }}>
          <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>Getting Started</span>
        </div>
      </div>
      <div className="flex items-center gap-0.5">
        <button className="px-3 py-1 rounded hover:bg-notion-bg-hover text-sm" style={{ color: "var(--text-secondary)" }}>
          공유
        </button>
        <button className="p-1.5 rounded hover:bg-notion-bg-hover" style={{ color: "var(--text-secondary)" }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4.32 15.424l4.644-2.432a.5.5 0 01.235-.059h3.3A2.5 2.5 0 0015 10.433V5.5A2.5 2.5 0 0012.5 3h-9A2.5 2.5 0 001 5.5v4.933a2.5 2.5 0 002.5 2.5h.32a.5.5 0 01.5.5v1.991z" />
          </svg>
        </button>
        <button className="p-1.5 rounded hover:bg-notion-bg-hover" style={{ color: "var(--text-secondary)" }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M3 8a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm4.5 0a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zM12 6.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" />
          </svg>
        </button>
      </div>
    </header>
  );
}
