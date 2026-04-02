"use client";

import { useEffect, useState } from "react";
import { WifiOff, FileText, RefreshCw } from "lucide-react";
import { cacheManager, type CachedPage } from "@/lib/offline/cache-manager";

export default function OfflinePage() {
  const [cachedPages, setCachedPages] = useState<CachedPage[]>([]);
  const [selectedPage, setSelectedPage] = useState<CachedPage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cacheManager.getAllPages().then((pages) => {
      setCachedPages(pages.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
      setLoading(false);
    });
  }, []);

  // If a cached page is selected, render its content
  if (selectedPage) {
    const blocks = selectedPage.content as Array<{
      type: string;
      content: unknown;
    }>;

    return (
      <div
        className="min-h-screen"
        style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}
      >
        <div
          className="sticky top-0 flex items-center gap-3 px-4 py-3 border-b z-10"
          style={{
            backgroundColor: "var(--bg-primary)",
            borderColor: "var(--border-default)",
          }}
        >
          <button
            onClick={() => setSelectedPage(null)}
            className="text-sm px-3 py-1 rounded hover:bg-notion-bg-hover"
            style={{ color: "var(--text-secondary)" }}
          >
            ← 목록으로
          </button>
          <div
            className="flex items-center gap-2 px-3 py-1 rounded text-xs"
            style={{ backgroundColor: "#e74c3c20", color: "#e74c3c" }}
          >
            <WifiOff size={12} />
            오프라인 · 읽기 전용
          </div>
        </div>

        <div className="mx-auto max-w-[720px] px-6 py-8">
          <h1 className="text-3xl font-bold mb-6">{selectedPage.title}</h1>
          <div className="prose max-w-none">
            {blocks.map((block, i) => (
              <OfflineBlock key={i} block={block} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col items-center min-h-screen pt-20 px-4"
      style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}
    >
      <div className="w-full max-w-[500px]">
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
            style={{ backgroundColor: "#e74c3c15" }}
          >
            <WifiOff size={28} style={{ color: "#e74c3c" }} />
          </div>
          <h1 className="text-2xl font-bold mb-2">오프라인 상태입니다</h1>
          <p style={{ color: "var(--text-secondary)" }}>
            이전에 방문한 페이지를 오프라인에서 읽을 수 있습니다.
          </p>
        </div>

        {loading ? (
          <div className="text-center py-8" style={{ color: "var(--text-tertiary)" }}>
            캐시된 페이지 불러오는 중...
          </div>
        ) : cachedPages.length === 0 ? (
          <div className="text-center py-8">
            <p style={{ color: "var(--text-tertiary)" }}>캐시된 페이지가 없습니다.</p>
            <p className="text-sm mt-2" style={{ color: "var(--text-tertiary)" }}>
              온라인 상태에서 페이지를 방문하면 자동으로 저장됩니다.
            </p>
          </div>
        ) : (
          <div>
            <h2
              className="text-sm font-medium mb-3 px-1"
              style={{ color: "var(--text-secondary)" }}
            >
              저장된 페이지 ({cachedPages.length}개)
            </h2>
            <div className="flex flex-col gap-1">
              {cachedPages.map((page) => (
                <button
                  key={page.id}
                  onClick={() => setSelectedPage(page)}
                  className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-notion-bg-hover text-left w-full transition-colors"
                  style={{ border: "1px solid var(--border-default)" }}
                >
                  <FileText size={18} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{page.title}</div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                      마지막 저장: {new Date(page.updatedAt).toLocaleString("ko-KR")}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="text-center mt-8">
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm"
            style={{ backgroundColor: "#2383e2", color: "white" }}
          >
            <RefreshCw size={14} />
            다시 연결 시도
          </button>
        </div>
      </div>
    </div>
  );
}

/** Simple offline block renderer — renders cached TipTap JSON as readable HTML */
function OfflineBlock({ block }: { block: { type: string; content: unknown } }) {
  const content = block.content as Record<string, unknown> | undefined;

  // Extract text from TipTap content nodes
  const extractText = (node: unknown): string => {
    if (!node || typeof node !== "object") return "";
    const n = node as Record<string, unknown>;
    if (n.text && typeof n.text === "string") return n.text;
    if (Array.isArray(n.content)) {
      return n.content.map(extractText).join("");
    }
    return "";
  };

  const text = content ? extractText(content) : "";

  switch (block.type) {
    case "heading":
    case "heading_2": {
      const level = (content as Record<string, unknown>)?.attrs
        ? ((content as Record<string, unknown>).attrs as Record<string, unknown>)?.level
        : 2;
      if (level === 1) return <h1 className="text-2xl font-bold mt-6 mb-2">{text}</h1>;
      if (level === 3) return <h3 className="text-lg font-semibold mt-4 mb-1">{text}</h3>;
      return <h2 className="text-xl font-bold mt-5 mb-2">{text}</h2>;
    }
    case "paragraph":
      return text ? <p className="my-2 leading-relaxed">{text}</p> : <div className="h-4" />;
    case "bulletList":
    case "bullet_list":
      return (
        <ul className="list-disc pl-6 my-2">
          {Array.isArray((content as Record<string, unknown>)?.content)
            ? ((content as Record<string, unknown>).content as unknown[]).map((item, i) => (
                <li key={i} className="my-1">{extractText(item)}</li>
              ))
            : <li>{text}</li>}
        </ul>
      );
    case "taskList":
    case "task_list":
      return (
        <div className="my-2 pl-2">
          {Array.isArray((content as Record<string, unknown>)?.content)
            ? ((content as Record<string, unknown>).content as unknown[]).map((item, i) => (
                <div key={i} className="flex items-start gap-2 my-1">
                  <input type="checkbox" disabled className="mt-1" />
                  <span>{extractText(item)}</span>
                </div>
              ))
            : <div className="flex items-start gap-2"><input type="checkbox" disabled /><span>{text}</span></div>}
        </div>
      );
    case "blockquote":
      return (
        <blockquote
          className="border-l-4 pl-4 my-3 italic"
          style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}
        >
          {text}
        </blockquote>
      );
    case "horizontalRule":
      return <hr className="my-4" style={{ borderColor: "var(--border-default)" }} />;
    case "callout":
      return (
        <div
          className="flex gap-3 p-4 rounded-lg my-3"
          style={{ backgroundColor: "var(--bg-secondary)" }}
        >
          <span>{(content as Record<string, unknown>)?.attrs ? ((content as Record<string, unknown>).attrs as Record<string, unknown>)?.icon as string : "💡"}</span>
          <span>{text}</span>
        </div>
      );
    case "codeBlock":
    case "code_block":
      return (
        <pre
          className="p-4 rounded-lg my-3 overflow-x-auto text-sm"
          style={{ backgroundColor: "var(--bg-secondary)" }}
        >
          <code>{text}</code>
        </pre>
      );
    default:
      return text ? <p className="my-2">{text}</p> : null;
  }
}
