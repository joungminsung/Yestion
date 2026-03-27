"use client";

import { useState, useEffect } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { EmbedInput } from "./embed-input";

export function EmbedNodeView({ node, updateAttributes, selected, editor }: NodeViewProps) {
  const url = node.attrs.url as string;
  const embedUrl = node.attrs.embedUrl as string;
  const provider = node.attrs.provider as string;
  const width = node.attrs.width as string;
  const height = node.attrs.height as number;

  const [showInput, setShowInput] = useState(!url);

  useEffect(() => {
    if (!url) setShowInput(true);
  }, [url]);

  const handleEmbed = (newUrl: string, newProvider: string, newEmbedUrl: string) => {
    updateAttributes({ url: newUrl, provider: newProvider, embedUrl: newEmbedUrl });
    setShowInput(false);
  };

  const handleDelete = () => {
    const pos = editor.view.state.selection.from;
    editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run();
  };

  // No URL yet — show input
  if (!url) {
    return (
      <NodeViewWrapper>
        {showInput ? (
          <EmbedInput onEmbed={handleEmbed} onClose={() => setShowInput(false)} />
        ) : (
          <div
            className="notion-embed-placeholder"
            onClick={() => setShowInput(true)}
          >
            <span className="notion-embed-placeholder-icon">🔗</span>
            <span>임베드를 추가하려면 클릭하세요</span>
          </div>
        )}
      </NodeViewWrapper>
    );
  }

  // Twitter / GitHub Gist — show as link card (no iframe)
  if (provider === "Twitter" || provider === "GitHub Gist") {
    return (
      <NodeViewWrapper>
        <div className="notion-embed-link-card" data-provider={provider}>
          <a href={url} target="_blank" rel="noopener noreferrer" className="notion-embed-link">
            <span className="notion-embed-link-provider">{provider}</span>
            <span className="notion-embed-link-url">{url}</span>
          </a>
          {selected && (
            <button className="notion-embed-delete" onClick={handleDelete} title="삭제">✕</button>
          )}
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper>
      <div
        className={`notion-embed-block ${selected ? "selected" : ""}`}
        style={{ width }}
        data-provider={provider}
      >
        {provider && (
          <div className="notion-embed-provider">{provider}</div>
        )}
        <iframe
          src={embedUrl || url}
          width="100%"
          height={`${height}px`}
          frameBorder="0"
          allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          style={{ border: "none", borderRadius: 4 }}
        />
        {selected && (
          <div className="notion-embed-toolbar">
            <button
              onClick={() => {
                setShowInput(true);
                updateAttributes({ url: "", embedUrl: "", provider: "" });
              }}
              title="URL 변경"
              className="notion-embed-toolbar-btn"
            >
              🔗
            </button>
            <button
              onClick={handleDelete}
              title="삭제"
              className="notion-embed-toolbar-btn danger"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}
