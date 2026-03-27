"use client";

import { useRouter } from "next/navigation";
import { trpc } from "@/server/trpc/client";
import { usePageTreeStore } from "@/stores/page-tree";
import { FileText } from "lucide-react";

export function SidebarFavorites({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const { activePageId, setActivePage } = usePageTreeStore();
  const { data: favorites } = trpc.page.listFavorites.useQuery({ workspaceId });

  if (!favorites || favorites.length === 0) return null;

  return (
    <div className="mb-2">
      <div
        className="px-3 py-1"
        style={{
          fontSize: "12px",
          fontWeight: 500,
          color: "var(--text-tertiary)",
          letterSpacing: "0.02em",
        }}
      >
        즐겨찾기
      </div>
      {favorites.map((fav) => (
        <div
          key={fav.id}
          className="flex items-center gap-2 px-3 py-[3px] rounded-sm cursor-pointer hover:bg-notion-bg-hover"
          style={{
            fontSize: "14px",
            color: "var(--text-primary)",
            backgroundColor: activePageId === fav.page.id ? "var(--bg-active)" : undefined,
          }}
          onClick={() => {
            setActivePage(fav.page.id);
            router.push(`/${workspaceId}/${fav.page.id}`);
          }}
        >
          <span className="text-sm flex items-center">{fav.page.icon || <FileText size={16} />}</span>
          <span className="truncate">{fav.page.title || "제목 없음"}</span>
        </div>
      ))}
    </div>
  );
}
