"use client";

import { useRef } from "react";
import { trpc } from "@/server/trpc/client";
import { FileText } from "lucide-react";

type PagePeekPreviewProps = {
  pageId: string;
  anchorRect: DOMRect;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
};

export function PagePeekPreview({
  pageId,
  anchorRect,
  onMouseEnter,
  onMouseLeave,
}: PagePeekPreviewProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const { data: page } = trpc.page.get.useQuery({ id: pageId }, { enabled: !!pageId });
  const { data: blocks } = trpc.block.list.useQuery({ pageId }, { enabled: !!pageId });

  // Position the card to the right of the sidebar item
  const top = anchorRect.top;
  const left = anchorRect.right + 8;

  // Extract first 3 lines of text from blocks
  const textPreview: string[] = [];
  if (blocks) {
    for (const block of blocks) {
      if (textPreview.length >= 3) break;
      const content = block.content as Record<string, unknown> | null;
      if (content && typeof content === "object") {
        const text =
          (content as { text?: string }).text ||
          (content as { content?: string }).content ||
          "";
        if (typeof text === "string" && text.trim()) {
          textPreview.push(text.trim());
        }
      }
    }
  }

  const lastEditDate = page?.updatedAt
    ? new Date(page.updatedAt).toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div
      ref={cardRef}
      className="fixed rounded-lg overflow-hidden dropdown-enter"
      style={{
        top: `${top}px`,
        left: `${left}px`,
        width: "280px",
        zIndex: 200,
        backgroundColor: "var(--bg-primary)",
        boxShadow: "var(--shadow-popup)",
        border: "1px solid var(--border-default)",
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Cover image */}
      {page?.cover && (
        <div
          style={{
            width: "100%",
            height: "100px",
            backgroundImage: `url(${page.cover})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      )}

      <div className="p-3">
        {/* Icon + Title */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg flex items-center flex-shrink-0">
            {page?.icon || <FileText size={18} />}
          </span>
          <span
            className="font-medium truncate"
            style={{ fontSize: "14px", color: "var(--text-primary)" }}
          >
            {page?.title || "제목 없음"}
          </span>
        </div>

        {/* Text preview */}
        {textPreview.length > 0 && (
          <div className="mb-2">
            {textPreview.map((line, i) => (
              <p
                key={i}
                className="truncate"
                style={{
                  fontSize: "12px",
                  color: "var(--text-secondary)",
                  lineHeight: "1.5",
                  margin: 0,
                }}
              >
                {line}
              </p>
            ))}
          </div>
        )}

        {/* Last edited date */}
        {lastEditDate && (
          <div
            style={{
              fontSize: "11px",
              color: "var(--text-tertiary)",
            }}
          >
            마지막 수정: {lastEditDate}
          </div>
        )}
      </div>
    </div>
  );
}
