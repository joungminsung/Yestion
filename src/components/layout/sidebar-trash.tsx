"use client";

import { useState } from "react";
import { trpc } from "@/server/trpc/client";
import { useToastStore } from "@/stores/toast";
import { Trash2, FileText, X } from "lucide-react";

export function SidebarTrash({ workspaceId }: { workspaceId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const addToast = useToastStore((s) => s.addToast);
  const { data: trashPages, refetch } = trpc.page.listTrash.useQuery(
    { workspaceId },
    { enabled: isOpen }
  );
  const utils = trpc.useUtils();

  const restore = trpc.page.restore.useMutation({
    onSuccess: () => {
      addToast({ message: "복원됨", type: "success" });
      refetch();
      utils.page.list.invalidate();
    },
  });
  const deletePerm = trpc.page.deletePermanently.useMutation({
    onSuccess: () => {
      addToast({ message: "영구 삭제됨", type: "info" });
      refetch();
    },
  });

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 mx-2 px-2 py-1 rounded hover:bg-notion-bg-hover cursor-pointer text-left w-auto"
        style={{ fontSize: "14px", color: "var(--text-secondary)" }}
      >
        <Trash2 size={16} />
        <span>휴지통</span>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0"
            style={{ zIndex: "var(--z-modal)", backgroundColor: "rgba(15,15,15,0.6)" }}
            onClick={() => setIsOpen(false)}
          />
          <div
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] max-h-[70vh] rounded-lg overflow-hidden flex flex-col"
            style={{
              zIndex: "calc(var(--z-modal) + 1)",
              backgroundColor: "var(--bg-primary)",
              boxShadow: "var(--shadow-popup)",
            }}
          >
            <div
              className="flex items-center justify-between px-4 py-3 border-b"
              style={{ borderColor: "var(--border-default)" }}
            >
              <h3
                style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}
              >
                휴지통
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded hover:bg-notion-bg-hover"
                style={{ color: "var(--text-tertiary)" }}
              >
                <X size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {!trashPages || trashPages.length === 0 ? (
                <div
                  className="py-8 text-center"
                  style={{ color: "var(--text-tertiary)", fontSize: "14px" }}
                >
                  휴지통이 비어있습니다
                </div>
              ) : (
                trashPages.map((page) => (
                  <div
                    key={page.id}
                    className="flex items-center justify-between px-4 py-2 hover:bg-notion-bg-hover"
                    style={{ fontSize: "14px" }}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span>{page.icon || <FileText size={16} />}</span>
                      <span style={{ color: "var(--text-primary)" }}>
                        {page.title || "제목 없음"}
                      </span>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => restore.mutate({ id: page.id })}
                        className="px-2 py-1 rounded text-xs hover:bg-notion-bg-active"
                        style={{ color: "var(--color-blue)" }}
                      >
                        복원
                      </button>
                      <button
                        onClick={() => deletePerm.mutate({ id: page.id })}
                        className="px-2 py-1 rounded text-xs hover:bg-notion-bg-active"
                        style={{ color: "var(--color-red)" }}
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
