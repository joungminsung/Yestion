"use client";

import { useCallback } from "react";
import { useSidebarStore } from "@/stores/sidebar";

export function SidebarResizer() {
  const { setWidth, setResizing } = useSidebarStore();

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setResizing(true);
      const handleMouseMove = (e: MouseEvent) => { setWidth(e.clientX); };
      const handleMouseUp = () => {
        setResizing(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [setWidth, setResizing]
  );

  return (
    <div
      onMouseDown={handleMouseDown}
      className="absolute right-0 top-0 bottom-0 w-[3px] cursor-col-resize hover:bg-notion-border-divider transition-colors z-10"
      style={{ transition: "background-color var(--transition-fast)" }}
    />
  );
}
