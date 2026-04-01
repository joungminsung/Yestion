"use client";

import { useRef, useCallback, useState } from "react";
import { NodeViewWrapper, NodeViewContent, type NodeViewProps } from "@tiptap/react";

export function ColumnListView({ node, getPos, editor }: NodeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  const handleResizeStart = useCallback(
    (index: number, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDraggingIndex(index);

      const container = containerRef.current;
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      const totalWidth = containerRect.width;

      const startX = e.clientX;
      const pos = typeof getPos === "function" ? getPos() : null;
      if (pos === null || pos === undefined) return;

      // Get current widths from node children
      const childCount = node.childCount;
      const widths: number[] = [];
      for (let i = 0; i < childCount; i++) {
        widths.push((node.child(i).attrs.width as number) || 1 / childCount);
      }

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const dx = moveEvent.clientX - startX;
        const dxRatio = dx / totalWidth;

        const newWidths = [...widths];
        // Adjust the column at index and index+1
        newWidths[index] = Math.max(0.1, widths[index]! + dxRatio);
        newWidths[index + 1] = Math.max(0.1, widths[index + 1]! - dxRatio);

        // Apply widths via transaction
        const tr = editor.state.tr;
        let offset = pos + 1; // inside columnList
        for (let i = 0; i < childCount; i++) {
          const child = node.child(i);
          tr.setNodeMarkup(offset, undefined, { ...child.attrs, width: newWidths[i] });
          offset += child.nodeSize;
        }
        editor.view.dispatch(tr);
      };

      const handleMouseUp = () => {
        setDraggingIndex(null);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [node, getPos, editor]
  );

  // Render columns with resize handles between them
  const childCount = node.childCount;
  const handles: React.ReactNode[] = [];
  for (let i = 0; i < childCount - 1; i++) {
    handles.push(
      <div
        key={`handle-${i}`}
        className="notion-column-resize-handle"
        style={{
          position: "absolute",
          width: "6px",
          top: 0,
          bottom: 0,
          cursor: "col-resize",
          zIndex: 10,
          // Calculate position based on cumulative widths
          left: (() => {
            let cumWidth = 0;
            for (let j = 0; j <= i; j++) {
              cumWidth += (node.child(j).attrs.width as number) || 1 / childCount;
            }
            return `calc(${cumWidth * 100}% - 3px)`;
          })(),
        }}
        onMouseDown={(e) => handleResizeStart(i, e)}
      >
        <div
          style={{
            width: "2px",
            height: "100%",
            margin: "0 auto",
            backgroundColor: draggingIndex === i ? "#2383e2" : "transparent",
            transition: "background-color 0.15s",
          }}
          className="hover:!bg-[#2383e2]"
        />
      </div>
    );
  }

  return (
    <NodeViewWrapper>
      <div
        ref={containerRef}
        className="notion-column-list"
        style={{ position: "relative" }}
      >
        <NodeViewContent />
        {handles}
      </div>
    </NodeViewWrapper>
  );
}
