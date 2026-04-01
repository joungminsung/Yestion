"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/server/trpc/client";
import { LayoutList } from "lucide-react";

type Props = { currentWorkspaceId: string };

export function WorkspaceSwitcher({ currentWorkspaceId }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const { data: memberships } = trpc.workspace.list.useQuery();

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  const currentWs = memberships?.find((m) => m.workspaceId === currentWorkspaceId);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center w-full px-3 h-[45px] hover:bg-notion-bg-hover cursor-pointer"
        style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-primary)" }}
      >
        <span className="mr-2 flex items-center text-lg">
          {currentWs?.workspace.icon || <LayoutList size={18} />}
        </span>
        <span className="truncate flex-1 text-left">
          {currentWs?.workspace.name || "Workspace"}
        </span>
        <span
          style={{
            color: "var(--text-tertiary)",
            fontSize: "12px",
            transition: "transform 0.15s",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          ▼
        </span>
      </button>

      {isOpen && (
        <div
          className="absolute top-full left-0 w-full rounded-lg py-1 mt-1"
          style={{
            backgroundColor: "var(--bg-primary)",
            boxShadow: "var(--shadow-popup)",
            zIndex: 100,
          }}
        >
          <div
            className="px-3 py-1"
            style={{ fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 500 }}
          >
            워크스페이스
          </div>
          {memberships?.map((m) => (
            <button
              key={m.workspaceId}
              onClick={() => {
                router.push(`/${m.workspaceId}`);
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-notion-bg-hover text-left"
              style={{ fontSize: "14px", color: "var(--text-primary)" }}
            >
              <span>{m.workspace.icon || "📋"}</span>
              <span className="flex-1 truncate">{m.workspace.name}</span>
              {m.workspaceId === currentWorkspaceId && (
                <span style={{ color: "var(--color-blue)" }}>✓</span>
              )}
              <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                {m.role}
              </span>
            </button>
          ))}
          <div
            className="mx-2 my-1"
            style={{ height: "1px", backgroundColor: "var(--border-divider)" }}
          />
          <button
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-notion-bg-hover text-left"
            style={{ fontSize: "14px", color: "var(--text-secondary)" }}
            onClick={() => {
              // Clear session cookie
              document.cookie = "session-token=; path=/; max-age=0; samesite=lax";
              router.push("/login");
              router.refresh();
              setIsOpen(false);
            }}
          >
            로그아웃
          </button>
        </div>
      )}
    </div>
  );
}
