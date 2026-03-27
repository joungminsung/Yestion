"use client";

import { useState, useEffect, useRef } from "react";
import { trpc } from "@/server/trpc/client";
import { useToastStore } from "@/stores/toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PermissionRow } from "./permission-row";

type ShareDialogProps = {
  pageId: string;
  onClose: () => void;
};

export function ShareDialog({ pageId, onClose }: ShareDialogProps) {
  const [email, setEmail] = useState("");
  const [level, setLevel] = useState<"edit" | "comment" | "view">("view");
  const [publicLevel, setPublicLevel] = useState<"view" | "comment" | "edit">("view");
  const dialogRef = useRef<HTMLDivElement>(null);
  const addToast = useToastStore((s) => s.addToast);

  const utils = trpc.useUtils();
  const { data: permissions = [] } = trpc.share.listPermissions.useQuery({ pageId });
  const { data: publicPage } = trpc.share.getPublicPage.useQuery({ pageId });

  const shareMutation = trpc.share.sharePage.useMutation({
    onSuccess: () => {
      utils.share.listPermissions.invalidate({ pageId });
      setEmail("");
      addToast({ message: "초대되었습니다.", type: "success" });
    },
    onError: (err) => {
      addToast({ message: err.message || "초대에 실패했습니다.", type: "error" });
    },
  });

  const updateMutation = trpc.share.updatePermission.useMutation({
    onSuccess: () => utils.share.listPermissions.invalidate({ pageId }),
  });

  const removeMutation = trpc.share.removePermission.useMutation({
    onSuccess: () => {
      utils.share.listPermissions.invalidate({ pageId });
      addToast({ message: "권한이 삭제되었습니다.", type: "info" });
    },
  });

  const enablePublicMutation = trpc.share.enablePublicLink.useMutation({
    onSuccess: () => {
      utils.share.getPublicPage.invalidate({ pageId });
      addToast({ message: "공개 링크가 활성화되었습니다.", type: "success" });
    },
  });

  const disablePublicMutation = trpc.share.disablePublicLink.useMutation({
    onSuccess: () => {
      utils.share.getPublicPage.invalidate({ pageId });
      addToast({ message: "공개 링크가 비활성화되었습니다.", type: "info" });
    },
  });

  const isPublicEnabled = !!publicPage?.publicAccessToken;

  useEffect(() => {
    if (publicPage?.publicAccessLevel) {
      setPublicLevel(publicPage.publicAccessLevel as "view" | "comment" | "edit");
    }
  }, [publicPage?.publicAccessLevel]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  function handleInvite() {
    if (!email.trim()) return;
    shareMutation.mutate({ pageId, email: email.trim(), level });
  }

  function handleCopyLink() {
    if (publicPage?.publicAccessToken) {
      const url = `${window.location.origin}/public/${publicPage.publicAccessToken}`;
      navigator.clipboard.writeText(url);
      addToast({ message: "링크가 복사되었습니다.", type: "success" });
    }
  }

  function handleTogglePublic() {
    if (isPublicEnabled) {
      disablePublicMutation.mutate({ pageId });
    } else {
      enablePublicMutation.mutate({ pageId, level: publicLevel });
    }
  }

  function handlePublicLevelChange(newLevel: "view" | "comment" | "edit") {
    setPublicLevel(newLevel);
    if (isPublicEnabled) {
      enablePublicMutation.mutate({ pageId, level: newLevel });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]" role="dialog" aria-modal="true" aria-label="공유">
      <div className="fixed inset-0 modal-backdrop-enter" style={{ backgroundColor: "rgba(0,0,0,0.2)" }} />
      <div
        ref={dialogRef}
        className="relative rounded-lg shadow-xl w-full max-w-md modal-content-enter"
        style={{
          backgroundColor: "var(--bg-primary)",
          border: "1px solid var(--border-default)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border-default)" }}>
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>공유</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-notion-bg-hover"
            style={{ color: "var(--text-secondary)" }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3.5 3.5l7 7m0-7l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Invite section */}
        <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border-default)" }}>
          <div className="flex items-center gap-2">
            <Input
              type="email"
              placeholder="이메일 주소 입력"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleInvite()}
              className="flex-1 text-sm"
              style={{ padding: "6px 10px" }}
            />
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value as "edit" | "comment" | "view")}
              className="text-xs rounded px-2 py-1.5 border-none outline-none cursor-pointer flex-shrink-0"
              style={{
                backgroundColor: "var(--bg-secondary)",
                color: "var(--text-secondary)",
              }}
            >
              <option value="edit">편집</option>
              <option value="comment">댓글</option>
              <option value="view">보기</option>
            </select>
            <Button
              size="sm"
              onClick={handleInvite}
              disabled={!email.trim() || shareMutation.isPending}
            >
              초대
            </Button>
          </div>
        </div>

        {/* Permissions list */}
        {permissions.length > 0 && (
          <div className="px-4 py-2" style={{ borderBottom: "1px solid var(--border-default)", maxHeight: "200px", overflowY: "auto" }}>
            <div className="text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
              액세스 권한이 있는 사용자
            </div>
            {permissions.map((perm) => (
              <PermissionRow
                key={perm.id}
                id={perm.id}
                user={perm.user}
                level={perm.level}
                onUpdate={(id, lvl) => updateMutation.mutate({ id, level: lvl })}
                onRemove={(id) => removeMutation.mutate({ id })}
              />
            ))}
          </div>
        )}

        {/* Public link section */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color: "var(--text-secondary)" }}>
                <path d="M6.5 9.5l3-3M9 10.5a2.5 2.5 0 003.5-3.5l-1-1a2.5 2.5 0 00-3.5 0M7 5.5a2.5 2.5 0 00-3.5 3.5l1 1a2.5 2.5 0 003.5 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              <span className="text-sm" style={{ color: "var(--text-primary)" }}>웹에서 공유</span>
            </div>
            <button
              onClick={handleTogglePublic}
              className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
              style={{
                backgroundColor: isPublicEnabled ? "#2383e2" : "var(--bg-tertiary)",
              }}
            >
              <span
                className="inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform"
                style={{
                  transform: isPublicEnabled ? "translateX(18px)" : "translateX(3px)",
                }}
              />
            </button>
          </div>
          {isPublicEnabled && (
            <div className="flex items-center gap-2 mt-2">
              <select
                value={publicLevel}
                onChange={(e) => handlePublicLevelChange(e.target.value as "view" | "comment" | "edit")}
                className="text-xs rounded px-2 py-1 border-none outline-none cursor-pointer"
                style={{
                  backgroundColor: "var(--bg-secondary)",
                  color: "var(--text-secondary)",
                }}
              >
                <option value="view">보기 가능</option>
                <option value="comment">댓글 가능</option>
                <option value="edit">편집 가능</option>
              </select>
              <Button size="sm" variant="secondary" onClick={handleCopyLink}>
                링크 복사
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
