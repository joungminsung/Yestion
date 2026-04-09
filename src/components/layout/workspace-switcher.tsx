"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/server/trpc/client";
import { LayoutList, Plus, LogOut, Trash2, DoorOpen, Settings } from "lucide-react";
import { useToastStore } from "@/stores/toast";

type Props = { currentWorkspaceId: string };

export function WorkspaceSwitcher({ currentWorkspaceId }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const addToast = useToastStore((s) => s.addToast);
  const updateToast = useToastStore((s) => s.updateToast);
  const utils = trpc.useUtils();
  const { data: memberships } = trpc.workspace.list.useQuery();

  const logoutMutation = trpc.auth.logout.useMutation();

  const createWorkspace = trpc.workspace.create.useMutation({
    onMutate: () => {
      const toastId = addToast({
        type: "info",
        title: "워크스페이스 생성 중",
        message: "새 워크스페이스와 기본 구조를 준비하고 있습니다.",
        loading: true,
        progress: 24,
        persistent: true,
      });
      return { toastId };
    },
    onSuccess: (ws, _variables, context) => {
      utils.workspace.list.invalidate();
      router.push(`/${ws.id}`);
      setShowCreate(false);
      setNewName("");
      setNewIcon("");
      if (context?.toastId) {
        updateToast(context.toastId, {
          type: "success",
          title: "워크스페이스 생성 완료",
          message: "새 워크스페이스로 이동하고 있습니다.",
          loading: false,
          progress: 100,
          persistent: false,
        });
      }
    },
    onError: (err, _variables, context) => {
      if (context?.toastId) {
        updateToast(context.toastId, {
          type: "error",
          title: "워크스페이스 생성 실패",
          message: err.message,
          loading: false,
          progress: 100,
          persistent: false,
        });
        return;
      }
      addToast({ message: err.message, type: "error" });
    },
  });

  const deleteWorkspace = trpc.workspace.delete.useMutation({
    onMutate: () => {
      const toastId = addToast({
        type: "warning",
        title: "워크스페이스 삭제 중",
        message: "관련 데이터를 정리하고 있습니다.",
        loading: true,
        progress: 34,
        persistent: true,
      });
      return { toastId };
    },
    onSuccess: (_data, _variables, context) => {
      utils.workspace.list.invalidate();
      const other = memberships?.find((m) => m.workspaceId !== currentWorkspaceId);
      if (other) router.push(`/${other.workspaceId}`);
      setShowDelete(false);
      setDeleteConfirm("");
      if (context?.toastId) {
        updateToast(context.toastId, {
          type: "success",
          title: "워크스페이스 삭제 완료",
          message: other ? "다른 워크스페이스로 이동하고 있습니다." : "삭제가 완료되었습니다.",
          loading: false,
          progress: 100,
          persistent: false,
        });
      }
    },
    onError: (err, _variables, context) => {
      if (context?.toastId) {
        updateToast(context.toastId, {
          type: "error",
          title: "워크스페이스 삭제 실패",
          message: err.message,
          loading: false,
          progress: 100,
          persistent: false,
        });
        return;
      }
      addToast({ message: err.message, type: "error" });
    },
  });

  const leaveWorkspace = trpc.workspace.leave.useMutation({
    onMutate: () => {
      const toastId = addToast({
        type: "info",
        title: "워크스페이스 나가는 중",
        message: "권한과 이동 경로를 정리하고 있습니다.",
        loading: true,
        progress: 28,
        persistent: true,
      });
      return { toastId };
    },
    onSuccess: (_data, _variables, context) => {
      utils.workspace.list.invalidate();
      const other = memberships?.find((m) => m.workspaceId !== currentWorkspaceId);
      if (other) router.push(`/${other.workspaceId}`);
      setIsOpen(false);
      if (context?.toastId) {
        updateToast(context.toastId, {
          type: "success",
          title: "워크스페이스에서 나왔습니다",
          message: other ? "다른 워크스페이스로 이동하고 있습니다." : "현재 워크스페이스를 정리했습니다.",
          loading: false,
          progress: 100,
          persistent: false,
        });
      }
    },
    onError: (err, _variables, context) => {
      if (context?.toastId) {
        updateToast(context.toastId, {
          type: "error",
          title: "워크스페이스 나가기 실패",
          message: err.message,
          loading: false,
          progress: 100,
          persistent: false,
        });
        return;
      }
      addToast({ message: err.message, type: "error" });
    },
  });

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
        setShowCreate(false);
        setShowDelete(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  const currentWs = memberships?.find((m) => m.workspaceId === currentWorkspaceId);
  const currentRole = currentWs?.role;

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
            minWidth: "260px",
          }}
        >
          {/* Workspace List */}
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
                {m.role === "OWNER" ? "소유자" : m.role === "ADMIN" ? "관리자" : m.role === "GUEST" ? "게스트" : "멤버"}
              </span>
            </button>
          ))}

          <div className="mx-2 my-1" style={{ height: "1px", backgroundColor: "var(--border-divider)" }} />

          {/* Create Workspace */}
          {showCreate ? (
            <div className="px-3 py-2">
              <div className="flex gap-2 mb-2">
                <input
                  value={newIcon}
                  onChange={(e) => setNewIcon(e.target.value)}
                  placeholder="🏢"
                  className="w-10 text-center rounded border px-1 py-1 text-lg"
                  style={{ borderColor: "var(--border-default)", backgroundColor: "var(--bg-primary)" }}
                  maxLength={2}
                />
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="워크스페이스 이름"
                  className="flex-1 rounded border px-2 py-1 text-sm"
                  style={{ borderColor: "var(--border-default)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newName.trim()) {
                      createWorkspace.mutate({ name: newName.trim(), icon: newIcon || undefined });
                    }
                    if (e.key === "Escape") setShowCreate(false);
                  }}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCreate(false)}
                  className="flex-1 text-xs py-1 rounded hover:bg-notion-bg-hover"
                  style={{ color: "var(--text-secondary)" }}
                >
                  취소
                </button>
                <button
                  onClick={() => {
                    if (newName.trim()) createWorkspace.mutate({ name: newName.trim(), icon: newIcon || undefined });
                  }}
                  disabled={!newName.trim() || createWorkspace.isPending}
                  className="flex-1 text-xs py-1 rounded text-white disabled:opacity-50"
                  style={{ backgroundColor: "#2383e2" }}
                >
                  {createWorkspace.isPending ? "생성 중..." : "생성"}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowCreate(true)}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-notion-bg-hover text-left"
              style={{ fontSize: "14px", color: "var(--text-secondary)" }}
            >
              <Plus size={16} />
              <span>새 워크스페이스</span>
            </button>
          )}

          {/* Settings */}
          <button
            onClick={() => {
              router.push(`/${currentWorkspaceId}/settings`);
              setIsOpen(false);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-notion-bg-hover text-left"
            style={{ fontSize: "14px", color: "var(--text-secondary)" }}
          >
            <Settings size={16} />
            <span>설정</span>
          </button>

          {/* Leave Workspace (non-owner, or owner with other owners) */}
          {currentRole !== "OWNER" && (
            <button
              onClick={() => {
                if (confirm("이 워크스페이스에서 나가시겠습니까?")) {
                  leaveWorkspace.mutate({ workspaceId: currentWorkspaceId });
                }
              }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-notion-bg-hover text-left"
              style={{ fontSize: "14px", color: "var(--text-secondary)" }}
            >
              <DoorOpen size={16} />
              <span>워크스페이스 나가기</span>
            </button>
          )}

          {/* Delete Workspace (owner only) */}
          {currentRole === "OWNER" && (
            showDelete ? (
              <div className="px-3 py-2">
                <p className="text-xs mb-2" style={{ color: "#e74c3c" }}>
                  삭제하려면 워크스페이스 이름을 입력하세요:
                  <strong> {currentWs?.workspace.name}</strong>
                </p>
                <input
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder="워크스페이스 이름 입력"
                  className="w-full rounded border px-2 py-1 text-sm mb-2"
                  style={{ borderColor: "#e74c3c", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Escape") { setShowDelete(false); setDeleteConfirm(""); } }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowDelete(false); setDeleteConfirm(""); }}
                    className="flex-1 text-xs py-1 rounded hover:bg-notion-bg-hover"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    취소
                  </button>
                  <button
                    onClick={() => deleteWorkspace.mutate({ id: currentWorkspaceId })}
                    disabled={deleteConfirm !== currentWs?.workspace.name || deleteWorkspace.isPending}
                    className="flex-1 text-xs py-1 rounded text-white disabled:opacity-50"
                    style={{ backgroundColor: "#e74c3c" }}
                  >
                    {deleteWorkspace.isPending ? "삭제 중..." : "삭제"}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowDelete(true)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-notion-bg-hover text-left"
                style={{ fontSize: "14px", color: "#e74c3c" }}
              >
                <Trash2 size={16} />
                <span>워크스페이스 삭제</span>
              </button>
            )
          )}

          <div className="mx-2 my-1" style={{ height: "1px", backgroundColor: "var(--border-divider)" }} />

          {/* Logout */}
          <button
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-notion-bg-hover text-left"
            style={{ fontSize: "14px", color: "var(--text-secondary)" }}
            onClick={async () => {
              const toastId = addToast({
                type: "info",
                title: "로그아웃 중",
                message: "현재 세션을 안전하게 종료하고 있습니다.",
                loading: true,
                progress: 40,
                persistent: true,
              });
              try {
                await logoutMutation.mutateAsync();
                updateToast(toastId, {
                  type: "success",
                  title: "로그아웃 완료",
                  message: "로그인 화면으로 이동합니다.",
                  loading: false,
                  progress: 100,
                  persistent: false,
                });
              } catch {
                updateToast(toastId, {
                  type: "warning",
                  title: "로그아웃 처리 중 경고",
                  message: "서버 응답은 불안정했지만, 로그인 화면으로 이동합니다.",
                  loading: false,
                  progress: 100,
                  persistent: false,
                });
              }
              router.push("/login");
              router.refresh();
              setIsOpen(false);
            }}
          >
            <LogOut size={16} />
            <span>로그아웃</span>
          </button>
        </div>
      )}
    </div>
  );
}
