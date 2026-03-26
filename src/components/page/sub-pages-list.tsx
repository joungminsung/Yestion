"use client";

import Link from "next/link";

type SubPage = {
  id: string;
  title: string | null;
  icon: string | null;
};

type SubPagesListProps = {
  pages: SubPage[];
  workspaceId: string;
};

export function SubPagesList({ pages, workspaceId }: SubPagesListProps) {
  if (pages.length === 0) return null;

  return (
    <div className="mt-2 mb-8">
      {pages.map((page) => (
        <Link
          key={page.id}
          href={`/${workspaceId}/${page.id}`}
          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-notion-bg-hover transition-colors"
          style={{ color: "var(--text-primary)", fontSize: "14px" }}
        >
          <span style={{ fontSize: "16px", width: "20px", textAlign: "center" }}>
            {page.icon || "📄"}
          </span>
          <span className="truncate">{page.title || "제목 없음"}</span>
        </Link>
      ))}
    </div>
  );
}
