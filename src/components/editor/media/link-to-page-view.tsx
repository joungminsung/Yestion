"use client";

import { useState, useRef, useEffect } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { trpc } from "@/server/trpc/client";
import { useParams, useRouter } from "next/navigation";

export function LinkToPageView({ node, updateAttributes, selected }: NodeViewProps) {
  const { pageId, pageTitle, pageIcon } = node.attrs;
  const [isSearching, setIsSearching] = useState(!pageId);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const params = useParams();
  const workspaceId = params?.workspaceId as string | undefined;

  const { data: pages } = trpc.page.list.useQuery(
    { workspaceId: workspaceId || "" },
    { enabled: isSearching && !!workspaceId }
  );

  const filteredPages = pages?.filter(
    (p) =>
      !query ||
      (p.title || "").toLowerCase().includes(query.toLowerCase())
  ) ?? [];

  useEffect(() => {
    if (isSearching && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isSearching]);

  const handleSelect = (page: { id: string; title: string; icon: string | null }) => {
    updateAttributes({
      pageId: page.id,
      pageTitle: page.title || "제목 없음",
      pageIcon: page.icon || "📄",
    });
    setIsSearching(false);
  };

  const handleNavigate = () => {
    if (pageId && workspaceId) {
      router.push(`/${workspaceId}/${pageId}`);
    }
  };

  return (
    <NodeViewWrapper
      className={`notion-link-to-page ${selected ? "ProseMirror-selectednode" : ""}`}
    >
      {isSearching ? (
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="페이지 검색..."
            className="w-full px-2 py-1 text-sm bg-transparent outline-none"
            style={{ color: "var(--text-primary)", borderBottom: "1px solid var(--border-default)" }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setIsSearching(false);
              }
              if (e.key === "Enter" && filteredPages.length > 0) {
                const first = filteredPages[0];
                if (first) handleSelect(first);
              }
            }}
          />
          {filteredPages.length > 0 && (
            <div
              className="absolute left-0 right-0 top-full z-10 max-h-48 overflow-y-auto rounded-b-md shadow-lg"
              style={{ backgroundColor: "var(--bg-primary)", border: "1px solid var(--border-default)" }}
            >
              {filteredPages.slice(0, 8).map((page) => (
                <button
                  key={page.id}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-notion-bg-hover text-left"
                  style={{ color: "var(--text-primary)" }}
                  onClick={() => handleSelect(page)}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <span>{page.icon || "📄"}</span>
                  <span>{page.title || "제목 없음"}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={handleNavigate}
          onDoubleClick={() => setIsSearching(true)}
        >
          <span>{pageIcon || "📄"}</span>
          <span className="underline" style={{ textUnderlineOffset: "3px", textDecorationColor: "var(--border-divider)" }}>
            {pageTitle || "제목 없음"}
          </span>
        </div>
      )}
    </NodeViewWrapper>
  );
}
