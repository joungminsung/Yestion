"use client";

import { useParams, useRouter } from "next/navigation";
import { Link as LinkIcon, ChevronDown, ChevronRight } from "lucide-react";
import { trpc } from "@/server/trpc/client";
import { useState } from "react";

type Props = {
  pageId: string;
};

export function Backlinks({ pageId }: Props) {
  const router = useRouter();
  const params = useParams();
  const workspaceId = params.workspaceId as string;
  const [isOpen, setIsOpen] = useState(false);

  // Query pages that contain a link to this page
  // This is a simple approach — search for pages containing this pageId in their blocks
  const { data: backlinks } = trpc.search.search.useQuery(
    { query: pageId, workspaceId },
    { enabled: !!workspaceId && !!pageId && isOpen }
  );

  // Filter out self-references
  const filteredLinks = backlinks?.filter((p) => p.id !== pageId) ?? [];

  return (
    <div
      className="mt-8 pt-4 border-t"
      style={{ borderColor: "var(--border-divider)" }}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-xs font-medium hover:bg-notion-bg-hover px-2 py-1 rounded"
        style={{ color: "var(--text-tertiary)" }}
      >
        {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <LinkIcon size={12} />
        Backlinks {filteredLinks.length > 0 && `(${filteredLinks.length})`}
      </button>

      {isOpen && (
        <div className="mt-2 space-y-1">
          {filteredLinks.length > 0 ? (
            filteredLinks.map((page) => (
              <button
                key={page.id}
                onClick={() => router.push(`/${workspaceId}/${page.id}`)}
                className="flex items-center gap-2 w-full px-3 py-1.5 rounded hover:bg-notion-bg-hover text-left"
              >
                <span className="text-sm shrink-0">{page.icon || "📄"}</span>
                <span className="text-sm truncate" style={{ color: "var(--text-primary)" }}>
                  {page.title || "Untitled"}
                </span>
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-xs" style={{ color: "var(--text-placeholder)" }}>
              No pages link to this page yet
            </p>
          )}
        </div>
      )}
    </div>
  );
}
