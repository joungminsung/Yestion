"use client";

import { NodeViewWrapper, NodeViewContent } from "@tiptap/react";
import { RefreshCw, Unlink, Copy } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/server/trpc/client";

export function SyncedBlockView(props: {
  node: { attrs: Record<string, unknown> };
  updateAttributes: (attrs: Record<string, unknown>) => void;
  deleteNode: () => void;
  selected: boolean;
}) {
  const { node, updateAttributes, selected } = props;
  const isSynced = node.attrs.synced as boolean;
  const sourceBlockId = node.attrs.sourceBlockId as string | null;
  const [showMenu, setShowMenu] = useState(false);

  const detachMutation = trpc.syncedBlock.detach.useMutation({
    onSuccess: () => {
      updateAttributes({ synced: false, sourceBlockId: null, sourcePageId: null });
    },
  });

  const handleDetach = () => {
    if (sourceBlockId) {
      detachMutation.mutate({ sourceBlockId });
    } else {
      updateAttributes({ synced: false });
    }
    setShowMenu(false);
  };

  const handleCopyRef = () => {
    const blockId = node.attrs.blockId as string;
    if (blockId) {
      navigator.clipboard.writeText(blockId).catch(() => {});
    }
    setShowMenu(false);
  };

  return (
    <NodeViewWrapper
      className="relative my-1 rounded-md border-l-4 px-4 py-2 group"
      style={{
        borderColor: isSynced ? "#eb5757" : "var(--border-default)",
        backgroundColor: isSynced
          ? "rgba(235, 87, 87, 0.04)"
          : "transparent",
        outline: selected ? "2px solid #2383e2" : "none",
      }}
    >
      {/* Toolbar */}
      <div className="absolute -top-3 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {isSynced && (
          <span
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium"
            style={{ backgroundColor: "rgba(235, 87, 87, 0.1)", color: "#eb5757" }}
          >
            <RefreshCw size={10} />
            동기화됨
          </span>
        )}
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-notion-bg-hover text-xs"
          style={{ color: "var(--text-tertiary)" }}
        >
          ...
        </button>
        {showMenu && (
          <div
            className="absolute top-full right-0 mt-1 w-44 rounded-md border shadow-lg py-1"
            style={{
              backgroundColor: "var(--bg-primary)",
              borderColor: "var(--border-default)",
              zIndex: 50,
            }}
          >
            <button
              onClick={handleCopyRef}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-notion-bg-hover"
              style={{ color: "var(--text-primary)" }}
            >
              <Copy size={14} />
              블록 참조 복사
            </button>
            {isSynced && (
              <button
                onClick={handleDetach}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-notion-bg-hover"
                style={{ color: "#eb5757" }}
              >
                <Unlink size={14} />
                동기화 해제
              </button>
            )}
          </div>
        )}
      </div>

      <NodeViewContent className="synced-block-content" />
    </NodeViewWrapper>
  );
}
