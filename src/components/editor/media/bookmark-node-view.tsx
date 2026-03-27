"use client";

import { useState, useEffect, useCallback } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { trpc } from "@/server/trpc/client";

export function BookmarkNodeView({ node, updateAttributes, selected, editor }: NodeViewProps) {
  const url = node.attrs.url as string;
  const title = node.attrs.title as string;
  const description = node.attrs.description as string;
  const image = node.attrs.image as string;
  const favicon = node.attrs.favicon as string;
  const siteName = node.attrs.siteName as string;

  const [showInput, setShowInput] = useState(!url);
  const [inputUrl, setInputUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOg = trpc.media.fetchOgMetadata.useMutation();

  useEffect(() => {
    if (!url) setShowInput(true);
  }, [url]);

  const handleSubmit = useCallback(async () => {
    const trimmed = inputUrl.trim();
    if (!trimmed) return;

    try {
      new URL(trimmed);
    } catch {
      setError("유효한 URL을 입력해주세요.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const meta = await fetchOg.mutateAsync({ url: trimmed });
      updateAttributes({
        url: trimmed,
        title: meta.title || "",
        description: meta.description || "",
        image: meta.image || "",
        favicon: meta.favicon || "",
        siteName: meta.siteName || "",
      });
      setShowInput(false);
    } catch {
      // Even if OG fetch fails, still create the bookmark with just the URL
      updateAttributes({
        url: trimmed,
        title: trimmed,
        description: "",
        image: "",
        favicon: "",
        siteName: "",
      });
      setShowInput(false);
    }

    setIsLoading(false);
  }, [inputUrl, fetchOg, updateAttributes]);

  const handleDelete = useCallback(() => {
    const pos = editor.view.state.selection.from;
    editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run();
  }, [editor, node]);

  // URL input UI
  if (!url || showInput) {
    return (
      <NodeViewWrapper>
        <div className="bookmark-input-popover">
          <div className="bookmark-input-header">
            <span className="bookmark-input-title">북마크</span>
          </div>
          <div className="bookmark-input-body">
            <input
              type="text"
              className="bookmark-input-url"
              placeholder="URL을 붙여넣으세요"
              value={inputUrl}
              onChange={(e) => {
                setInputUrl(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
              autoFocus
              disabled={isLoading}
            />
            {error && <p className="bookmark-input-error">{error}</p>}
            <button
              className="bookmark-input-submit"
              onClick={handleSubmit}
              disabled={!inputUrl.trim() || isLoading}
            >
              {isLoading ? "불러오는 중..." : "북마크 만들기"}
            </button>
          </div>
        </div>
      </NodeViewWrapper>
    );
  }

  // Bookmark card
  return (
    <NodeViewWrapper>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`notion-bookmark-card ${selected ? "selected" : ""}`}
        onClick={(e) => {
          // Only open in new tab when not in editing context
          if (editor.isEditable) {
            e.preventDefault();
          }
        }}
      >
        <div className="notion-bookmark-content">
          <div className="notion-bookmark-text">
            <div className="notion-bookmark-title">
              {title || url}
            </div>
            {description && (
              <div className="notion-bookmark-description">
                {description}
              </div>
            )}
            <div className="notion-bookmark-url-row">
              {favicon && (
                <img
                  src={favicon}
                  alt=""
                  className="notion-bookmark-favicon"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              )}
              <span className="notion-bookmark-url">{siteName || url}</span>
            </div>
          </div>
          {image && (
            <div className="notion-bookmark-image">
              <img
                src={image}
                alt=""
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </div>
          )}
        </div>
        {selected && (
          <div className="notion-bookmark-toolbar">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowInput(true);
                setInputUrl(url);
              }}
              className="notion-bookmark-toolbar-btn"
              title="URL 변경"
            >
              🔗
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleDelete();
              }}
              className="notion-bookmark-toolbar-btn danger"
              title="삭제"
            >
              ✕
            </button>
          </div>
        )}
      </a>
    </NodeViewWrapper>
  );
}
