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
import { ImageIcon, AlignLeft, AlignCenter, AlignRight, X } from "lucide-react";

export function ImageNodeView({ node, updateAttributes, selected, editor }: NodeViewProps) {
  const src = node.attrs.src as string;
  const width = node.attrs.width as string | null;
  const alignment = (node.attrs.alignment as string) || "center";
  const alt = (node.attrs.alt as string) || "";

  const [showUpload, setShowUpload] = useState(!src);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDimensions, setResizeDimensions] = useState<{ w: number; h: number } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const startRef = useRef<{ x: number; y: number; width: number; height: number; aspectRatio: number }>({ x: 0, y: 0, width: 0, height: 0, aspectRatio: 1 });

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
      const startY = e.clientY;
      const startWidth = imgRef.current.offsetWidth;
      const startHeight = imgRef.current.offsetHeight;
      const aspectRatio = startWidth / startHeight;
      startRef.current = { x: startX, y: startY, width: startWidth, height: startHeight, aspectRatio };
      setIsResizing(true);
      setResizeDimensions({ w: startWidth, h: startHeight });

      const onMouseMove = (ev: globalThis.MouseEvent) => {
        const diff = ev.clientX - startRef.current.x;
        const newWidth = Math.max(100, startRef.current.width + diff);
        let newHeight: number;

        if (ev.shiftKey) {
          // Shift+drag locks aspect ratio
          newHeight = Math.round(newWidth / startRef.current.aspectRatio);
        } else {
          // Free resize: height follows vertical mouse movement
          const diffY = ev.clientY - startRef.current.y;
          newHeight = Math.max(50, startRef.current.height + diffY);
        }

        if (imgRef.current) {
          imgRef.current.style.width = `${newWidth}px`;
        }
        setResizeDimensions({ w: Math.round(newWidth), h: newHeight });
      };

      const onMouseUp = (ev: globalThis.MouseEvent) => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        setIsResizing(false);
        setResizeDimensions(null);

        const diff = ev.clientX - startRef.current.x;
        const newWidth = Math.max(100, startRef.current.width + diff);
        updateAttributes({ width: newWidth });
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
            <span className="notion-image-placeholder-icon"><ImageIcon size={24} /></span>
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
            style={{ width: typeof width === "number" ? `${width}px` : (width || undefined), maxWidth: "100%" }}
            draggable={false}
          />

          {/* Size badge during resize */}
          {isResizing && resizeDimensions && (
            <div
              style={{
                position: "absolute",
                bottom: 8,
                left: "50%",
                transform: "translateX(-50%)",
                background: "rgba(0, 0, 0, 0.75)",
                color: "#fff",
                padding: "2px 8px",
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 500,
                whiteSpace: "nowrap",
                zIndex: 30,
                pointerEvents: "none",
              }}
            >
              {resizeDimensions.w} x {resizeDimensions.h}
            </div>
          )}

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
                  {align === "left" ? <AlignLeft size={14} /> : align === "center" ? <AlignCenter size={14} /> : <AlignRight size={14} />}
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
                <X size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Caption */}
        {src && (
          <div className="w-full" contentEditable={false}>
            <input
              type="text"
              value={alt || ""}
              onChange={(e) => updateAttributes({ alt: e.target.value })}
              placeholder="캡션 추가..."
              className="w-full text-center text-xs py-1 outline-none"
              style={{
                color: "var(--text-tertiary)",
                backgroundColor: "transparent",
              }}
            />
          </div>
        )}

        {/* Alignment controls (shown on hover/select) */}
        {selected && src && (
          <div className="flex items-center gap-1 justify-center mt-1" contentEditable={false}>
            {(["left", "center", "right"] as const).map((align) => (
              <button
                key={align}
                onClick={() => updateAttributes({ alignment: align })}
                className="p-1 rounded hover:bg-notion-bg-hover"
                style={{
                  color: alignment === align ? "#2383e2" : "var(--text-tertiary)",
                }}
                title={align === "left" ? "왼쪽" : align === "center" ? "가운데" : "오른쪽"}
              >
                {align === "left" ? "◧" : align === "center" ? "◻" : "◨"}
              </button>
            ))}
          </div>
        )}
      </figure>
    </NodeViewWrapper>
  );
}
