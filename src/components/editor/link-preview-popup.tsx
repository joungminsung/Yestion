"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { Extension } from "@tiptap/core";

type LinkPreviewData = {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  domain?: string;
  isInternal?: boolean;
  pageIcon?: string;
  lastEdited?: string;
};

const HOVER_DELAY = 300;
const HIDE_DELAY = 200;

const linkPreviewTimers = new WeakMap<EditorView, NodeJS.Timeout>();

export const linkPreviewPluginKey = new PluginKey("linkPreview");

export function LinkPreviewPopup({
  data,
  coords,
  onClose,
  onOpen,
  onCopyLink,
  onRemoveLink,
}: {
  data: LinkPreviewData;
  coords: { top: number; left: number };
  onClose: () => void;
  onOpen: () => void;
  onCopyLink: () => void;
  onRemoveLink: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const hideTimer = useRef<NodeJS.Timeout | null>(null);

  const scheduleHide = useCallback(() => {
    hideTimer.current = setTimeout(() => {
      if (!isHovered) {
        onClose();
      }
    }, HIDE_DELAY);
  }, [isHovered, onClose]);

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  const handleMouseEnter = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    scheduleHide();
  };

  // Compute position so popup doesn't overflow viewport
  const popupStyle: React.CSSProperties = {
    position: "fixed",
    top: coords.top + 24,
    left: Math.min(coords.left, window.innerWidth - 340),
    zIndex: 90,
    width: "320px",
  };

  return (
    <div
      ref={ref}
      className="rounded-lg overflow-hidden link-preview-enter"
      style={{
        ...popupStyle,
        backgroundColor: "var(--bg-primary)",
        boxShadow: "var(--shadow-popup, 0 4px 16px rgba(0,0,0,0.12))",
        border: "1px solid var(--border-default)",
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* OG image for external links */}
      {data.image && !data.isInternal && (
        <div
          className="w-full h-36 bg-cover bg-center"
          style={{ backgroundImage: `url(${data.image})`, backgroundColor: "var(--bg-secondary)" }}
        />
      )}

      <div className="p-3">
        {/* Internal page preview */}
        {data.isInternal ? (
          <div className="flex items-start gap-2">
            <span className="text-xl flex-shrink-0">{data.pageIcon || "📄"}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                {data.title || "제목 없음"}
              </p>
              {data.description && (
                <p
                  className="text-xs mt-0.5 line-clamp-2"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {data.description}
                </p>
              )}
              {data.lastEdited && (
                <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
                  마지막 편집: {data.lastEdited}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
              {data.title || data.url}
            </p>
            {data.description && (
              <p
                className="text-xs mt-0.5 line-clamp-2"
                style={{ color: "var(--text-tertiary)" }}
              >
                {data.description}
              </p>
            )}
            <p className="text-xs mt-1 truncate" style={{ color: "var(--text-tertiary)" }}>
              {data.domain || new URL(data.url).hostname}
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div
        className="flex items-center gap-0 border-t"
        style={{ borderColor: "var(--border-divider, var(--border-default))" }}
      >
        <button
          onClick={onOpen}
          className="flex-1 px-3 py-2 text-xs font-medium hover:bg-notion-bg-hover transition-colors"
          style={{ color: "var(--text-secondary)" }}
        >
          열기
        </button>
        <div style={{ width: "1px", height: "20px", backgroundColor: "var(--border-divider, var(--border-default))" }} />
        <button
          onClick={onCopyLink}
          className="flex-1 px-3 py-2 text-xs font-medium hover:bg-notion-bg-hover transition-colors"
          style={{ color: "var(--text-secondary)" }}
        >
          링크 복사
        </button>
        <div style={{ width: "1px", height: "20px", backgroundColor: "var(--border-divider, var(--border-default))" }} />
        <button
          onClick={onRemoveLink}
          className="flex-1 px-3 py-2 text-xs font-medium hover:bg-notion-bg-hover transition-colors"
          style={{ color: "#eb5757" }}
        >
          링크 제거
        </button>
      </div>
    </div>
  );
}

/**
 * Tiptap extension that shows a preview popup when hovering over links.
 */
export const LinkPreviewExtension = Extension.create({
  name: "linkPreview",

  addProseMirrorPlugins() {
    // editor reference available via this.editor if needed
    return [
      new Plugin({
        key: linkPreviewPluginKey,
        props: {
          handleDOMEvents: {
            mouseover(view: EditorView, event: MouseEvent) {
              const target = event.target as HTMLElement;
              const linkEl = target.closest("a");
              if (!linkEl) return false;

              const href = linkEl.getAttribute("href");
              if (!href) return false;

              // Debounce: set up hover timer
              const existingTimer = linkPreviewTimers.get(view);
              if (existingTimer) clearTimeout(existingTimer);

              const timer = setTimeout(() => {
                const rect = linkEl.getBoundingClientRect();
                const isInternal = href.startsWith("/") || href.includes(window.location.host);

                let domain = "";
                try {
                  domain = new URL(href, window.location.origin).hostname;
                } catch {
                  domain = href;
                }

                const previewData: LinkPreviewData = {
                  url: href,
                  title: linkEl.textContent || href,
                  domain,
                  isInternal,
                };

                // For external links, attempt to fetch OG data via our API
                if (!isInternal) {
                  fetch(`/api/link-preview?url=${encodeURIComponent(href)}`)
                    .then((r) => r.ok ? r.json() : null)
                    .then((og) => {
                      if (og) {
                        window.dispatchEvent(
                          new CustomEvent("link-preview-update", {
                            detail: {
                              ...previewData,
                              title: og.title || previewData.title,
                              description: og.description,
                              image: og.image,
                            },
                          })
                        );
                      }
                    })
                    .catch(() => {});
                }

                window.dispatchEvent(
                  new CustomEvent("link-preview-show", {
                    detail: {
                      data: previewData,
                      coords: { top: rect.top, left: rect.left },
                      href,
                    },
                  })
                );
              }, HOVER_DELAY);

              linkPreviewTimers.set(view, timer);
              return false;
            },

            mouseout(view: EditorView, event: MouseEvent) {
              const target = event.target as HTMLElement;
              const linkEl = target.closest("a");
              if (!linkEl) return false;

              const existingTimer = linkPreviewTimers.get(view);
              if (existingTimer) clearTimeout(existingTimer);

              // Schedule hide after delay
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent("link-preview-hide-schedule"));
              }, HIDE_DELAY);

              return false;
            },
          },
        },
      }),
    ];
  },
});

/**
 * Hook that manages link preview popup state.
 * Use in the editor wrapper component.
 */
export function useLinkPreview(editor: { chain: () => { focus: () => { unsetLink: () => { run: () => boolean } } } } | null) {
  const [preview, setPreview] = useState<{
    data: LinkPreviewData;
    coords: { top: number; left: number };
    href: string;
  } | null>(null);
  const hideTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleShow = (e: Event) => {
      const { data, coords, href } = (e as CustomEvent).detail;
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setPreview({ data, coords, href });
    };

    const handleUpdate = (e: Event) => {
      const updatedData = (e as CustomEvent).detail;
      setPreview((prev) => prev ? { ...prev, data: { ...prev.data, ...updatedData } } : null);
    };

    const handleHideSchedule = () => {
      hideTimer.current = setTimeout(() => {
        setPreview(null);
      }, HIDE_DELAY + 100);
    };

    window.addEventListener("link-preview-show", handleShow);
    window.addEventListener("link-preview-update", handleUpdate);
    window.addEventListener("link-preview-hide-schedule", handleHideSchedule);

    return () => {
      window.removeEventListener("link-preview-show", handleShow);
      window.removeEventListener("link-preview-update", handleUpdate);
      window.removeEventListener("link-preview-hide-schedule", handleHideSchedule);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  const handleClose = useCallback(() => {
    setPreview(null);
  }, []);

  const handleOpen = useCallback(() => {
    if (!preview) return;
    if (preview.data.isInternal) {
      window.location.href = preview.href;
    } else {
      window.open(preview.href, "_blank", "noopener,noreferrer");
    }
    setPreview(null);
  }, [preview]);

  const handleCopyLink = useCallback(() => {
    if (!preview) return;
    const fullUrl = preview.data.isInternal
      ? `${window.location.origin}${preview.href}`
      : preview.href;
    navigator.clipboard.writeText(fullUrl);
    setPreview(null);
  }, [preview]);

  const handleRemoveLink = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().unsetLink().run();
    setPreview(null);
  }, [editor]);

  return { preview, handleClose, handleOpen, handleCopyLink, handleRemoveLink };
}
