"use client";

import { useEffect, useRef } from "react";
import { trpc } from "@/server/trpc/client";
import { X } from "lucide-react";

type PageStatsPanelProps = {
  pageId: string;
  onClose: () => void;
};

export function PageStatsPanel({ pageId, onClose }: PageStatsPanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { data: page } = trpc.page.get.useQuery({ id: pageId });
  const { data: blocks } = trpc.block.list.useQuery({ pageId });
  const { data: permissions } = trpc.share.listPermissions.useQuery(
    { pageId },
    {
      retry: false,
      // This may fail if user doesn't have permission to view share settings
    },
  );

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  // Close on ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Calculate stats from blocks
  const stats = (() => {
    if (!blocks) return null;

    let wordCount = 0;
    let charCount = 0;
    let blockCount = 0;

    const countBlock = (block: { content: unknown; children?: { content: unknown }[] }) => {
      blockCount++;
      const content = block.content as Record<string, unknown> | null;
      if (content && typeof content === "object") {
        const text =
          ((content as { text?: string }).text || (content as { content?: string }).content || "");
        if (typeof text === "string") {
          charCount += text.length;
          const words = text.trim().split(/\s+/).filter(Boolean);
          wordCount += words.length;
        }
      }
      if (block.children) {
        for (const child of block.children) {
          countBlock(child as typeof block);
        }
      }
    };

    for (const block of blocks) {
      countBlock(block as { content: unknown; children?: { content: unknown }[] });
    }

    return { wordCount, charCount, blockCount };
  })();

  const subPageCount = page?.children?.length ?? 0;

  const createdDate = page?.createdAt
    ? new Date(page.createdAt).toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";

  const updatedDate = page?.updatedAt
    ? new Date(page.updatedAt).toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";

  // Determine share status
  const shareStatus = (() => {
    if (page?.publicAccessToken) return "공개";
    if (permissions && permissions.length > 0) return "공유됨";
    return "비공개";
  })();

  const statRows: { label: string; value: string | number }[] = [
    { label: "단어 수", value: stats?.wordCount ?? "-" },
    { label: "글자 수", value: stats?.charCount ?? "-" },
    { label: "블록 수", value: stats?.blockCount ?? "-" },
    { label: "하위 페이지", value: subPageCount },
    { label: "생성일", value: createdDate },
    { label: "마지막 수정", value: updatedDate },
    { label: "공유 상태", value: shareStatus },
  ];

  return (
    <div
      ref={ref}
      className="fixed right-4 top-14 rounded-lg overflow-hidden dropdown-enter"
      style={{
        width: "300px",
        zIndex: 200,
        backgroundColor: "var(--bg-primary)",
        boxShadow: "var(--shadow-popup)",
        border: "1px solid var(--border-default)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid var(--border-divider)" }}
      >
        <span className="font-medium" style={{ fontSize: "14px", color: "var(--text-primary)" }}>
          페이지 통계
        </span>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-notion-bg-hover"
          style={{ color: "var(--text-tertiary)" }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Stats */}
      <div className="px-4 py-3">
        {statRows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between py-1.5"
            style={{ fontSize: "13px" }}
          >
            <span style={{ color: "var(--text-secondary)" }}>{row.label}</span>
            <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
