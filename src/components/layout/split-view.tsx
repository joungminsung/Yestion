"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { useTabsStore } from "@/stores/tabs";
import { X } from "lucide-react";

export function SplitView({ children }: { children: ReactNode }) {
  const splitTabId = useTabsStore((s) => s.splitTabId);
  const splitDirection = useTabsStore((s) => s.splitDirection);
  const splitRatio = useTabsStore((s) => s.splitRatio);
  const setSplitRatio = useTabsStore((s) => s.setSplitRatio);
  const closeSplit = useTabsStore((s) => s.closeSplit);
  const tabs = useTabsStore((s) => s.tabs);

  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const splitTab = tabs.find((t) => t.id === splitTabId);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        let ratio: number;
        if (splitDirection === "horizontal") {
          ratio = (moveEvent.clientX - rect.left) / rect.width;
        } else {
          ratio = (moveEvent.clientY - rect.top) / rect.height;
        }
        setSplitRatio(ratio);
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [splitDirection, setSplitRatio],
  );

  if (!splitTab) {
    return <>{children}</>;
  }

  const isHorizontal = splitDirection === "horizontal";
  const primarySize = `${splitRatio * 100}%`;
  const secondarySize = `${(1 - splitRatio) * 100}%`;

  return (
    <div
      ref={containerRef}
      className="flex h-full min-w-0"
      style={{
        flexDirection: isHorizontal ? "row" : "column",
        userSelect: isDragging ? "none" : "auto",
      }}
    >
      {/* Primary pane (current page) */}
      <div
        className="min-w-0 overflow-y-auto"
        style={{
          [isHorizontal ? "width" : "height"]: primarySize,
          flexShrink: 0,
        }}
      >
        {children}
      </div>

      {/* Divider */}
      <div
        onMouseDown={handleMouseDown}
        className="flex-shrink-0 relative group"
        style={{
          [isHorizontal ? "width" : "height"]: "4px",
          cursor: isHorizontal ? "col-resize" : "row-resize",
          backgroundColor: isDragging ? "#2383e2" : "var(--border-divider)",
          transition: isDragging ? "none" : "background-color 150ms",
        }}
      >
        <div
          className="absolute opacity-0 group-hover:opacity-100 transition-opacity"
          style={{
            [isHorizontal ? "width" : "height"]: "12px",
            [isHorizontal ? "height" : "width"]: "100%",
            [isHorizontal ? "left" : "top"]: "-4px",
          }}
        />
      </div>

      {/* Secondary pane (split tab) */}
      <div
        className="relative min-w-0 overflow-y-auto"
        style={{
          [isHorizontal ? "width" : "height"]: secondarySize,
          flexShrink: 0,
        }}
      >
        {/* Close button for split */}
        <button
          onClick={closeSplit}
          className="absolute top-2 right-2 z-10 p-1 rounded hover:bg-notion-bg-hover"
          style={{ color: "var(--text-tertiary)" }}
          title="Close split view"
        >
          <X size={14} />
        </button>

        {/* Render split content via iframe for isolation */}
        <iframe
          src={splitTab.url}
          className="w-full h-full border-0"
          title={`Split view: ${splitTab.title}`}
        />
      </div>
    </div>
  );
}
