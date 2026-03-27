"use client";

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { ImageUpload } from "./image-upload";

export function ImageNodeView({ node, updateAttributes, selected, editor }: NodeViewProps) {
  const src = node.attrs.src as string;
  const width = node.attrs.width as string | null;
  const alignment = (node.attrs.alignment as string) || "center";
  const alt = (node.attrs.alt as string) || "";

  const [showUpload, setShowUpload] = useState(!src);
  const [isResizing, setIsResizing] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const startRef = useRef<{ x: number; width: number }>({ x: 0, width: 0 });

  // Show upload popover when src is empty
  useEffect(() => {
    if (!src) setShowUpload(true);
  }, [src]);

  const handleImageSelected = useCallback(
    (url: string) => {
      updateAttributes({ src: url });
      setShowUpload(false);
    },
    [updateAttributes],
  );

  const handleResizeStart = useCallback(
    (e: ReactMouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!imgRef.current) return;

      const startX = e.clientX;
      const startWidth = imgRef.current.offsetWidth;
      startRef.current = { x: startX, width: startWidth };
      setIsResizing(true);

      const onMouseMove = (ev: globalThis.MouseEvent) => {
        const diff = ev.clientX - startRef.current.x;
        const newWidth = Math.max(100, startRef.current.width + diff);
        if (imgRef.current) {
          imgRef.current.style.width = `${newWidth}px`;
        }
      };

      const onMouseUp = (ev: globalThis.MouseEvent) => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        setIsResizing(false);

        const diff = ev.clientX - startRef.current.x;
        const newWidth = Math.max(100, startRef.current.width + diff);
        updateAttributes({ width: `${newWidth}px` });
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [updateAttributes],
  );

  const handleAlignChange = useCallback(
    (align: string) => {
      updateAttributes({ alignment: align });
    },
    [updateAttributes],
  );

  const handleDelete = useCallback(() => {
    const pos = editor.view.state.selection.from;
    editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run();
  }, [editor, node]);

  const justifyMap: Record<string, string> = {
    left: "flex-start",
    center: "center",
    right: "flex-end",
  };

  if (!src) {
    return (
      <NodeViewWrapper>
        {showUpload ? (
          <ImageUpload
            onImageSelected={handleImageSelected}
            onClose={() => setShowUpload(false)}
          />
        ) : (
          <div
            className="notion-image-placeholder"
            onClick={() => setShowUpload(true)}
          >
            <span className="notion-image-placeholder-icon">🖼</span>
            <span>이미지를 추가하려면 클릭하세요</span>
          </div>
        )}
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper>
      <figure
        className="notion-image-block"
        style={{ justifyContent: justifyMap[alignment] || "center" }}
      >
        <div style={{ position: "relative", display: "inline-block" }}>
          <img
            ref={imgRef}
            src={src}
            alt={alt}
            style={{ width: width || undefined, maxWidth: "100%" }}
            draggable={false}
          />

          {/* Resize handles - visible on selection */}
          {selected && !isResizing && (
            <>
              <span
                className="notion-image-resize-handle se"
                onMouseDown={handleResizeStart}
              />
            </>
          )}

          {/* Toolbar on selection */}
          {selected && (
            <div
              style={{
                position: "absolute",
                top: 4,
                left: "50%",
                transform: "translateX(-50%)",
                display: "flex",
                gap: 2,
                background: "var(--bg-primary, #fff)",
                border: "1px solid var(--border-divider, #e0e0e0)",
                borderRadius: 6,
                padding: "2px 4px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                zIndex: 20,
              }}
            >
              {(["left", "center", "right"] as const).map((align) => (
                <button
                  key={align}
                  onClick={() => handleAlignChange(align)}
                  style={{
                    padding: "4px 8px",
                    fontSize: 12,
                    background: alignment === align ? "var(--bg-secondary, #f5f5f5)" : "transparent",
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                    color: "var(--text-primary, #333)",
                  }}
                  title={align === "left" ? "왼쪽" : align === "center" ? "가운데" : "오른쪽"}
                >
                  {align === "left" ? "⬅" : align === "center" ? "⬛" : "➡"}
                </button>
              ))}
              <button
                onClick={handleDelete}
                style={{
                  padding: "4px 8px",
                  fontSize: 12,
                  background: "transparent",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                  color: "var(--color-red, #e03e3e)",
                }}
                title="삭제"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </figure>
    </NodeViewWrapper>
  );
}
