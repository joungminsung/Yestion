"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/server/trpc/client";
import { useToastStore } from "@/stores/toast";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";

interface SessionItem {
  id: string;
  isCurrent: boolean;
  createdAt: string;
  expiresAt: string;
  tokenPreview: string;
}

export function SessionManagement() {
  const addToast = useToastStore((s) => s.addToast);
  const [confirmRevokeAll, setConfirmRevokeAll] = useState(false);

  const { data: sessions, refetch } = trpc.session.list.useQuery() as {
    data: SessionItem[] | undefined;
    refetch: () => void;
  };

  const revoke = trpc.session.revoke.useMutation({
    onSuccess: () => {
      addToast({ message: "세션이 종료되었습니다", type: "success" });
      refetch();
    },
    onError: () => {
      addToast({ message: "세션 종료에 실패했습니다", type: "error" });
    },
  });

  const revokeAll = trpc.session.revokeAll.useMutation({
    onSuccess: () => {
      addToast({ message: "다른 모든 세션이 종료되었습니다", type: "success" });
      setConfirmRevokeAll(false);
      refetch();
    },
    onError: () => {
      addToast({ message: "세션 종료에 실패했습니다", type: "error" });
    },
  });

  return (
    <div>
      <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
        세션 관리
      </h2>
      <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
        현재 로그인된 세션 목록입니다. 의심스러운 세션이 있다면 종료해주세요.
      </p>

      {/* Session list */}
      <div className="space-y-3 mb-6">
        {sessions?.map((session) => (
          <div
            key={session.id}
            className="flex items-center justify-between p-4 rounded-lg"
            style={{
              backgroundColor: "var(--bg-secondary)",
              border: session.isCurrent
                ? "1px solid var(--color-blue)"
                : "1px solid var(--border-default)",
            }}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  세션 {session.tokenPreview}
                </span>
                {session.isCurrent && (
                  <span
                    className="px-2 py-0.5 rounded text-[11px] font-medium"
                    style={{
                      backgroundColor: "var(--color-blue-bg)",
                      color: "var(--color-blue)",
                    }}
                  >
                    현재 세션
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-tertiary)" }}>
                <span>
                  생성: {formatDistanceToNow(new Date(session.createdAt), { addSuffix: true, locale: ko })}
                </span>
                <span>
                  만료: {new Date(session.expiresAt).toLocaleDateString("ko-KR")}
                </span>
              </div>
            </div>

            {!session.isCurrent && (
              <button
                onClick={() => revoke.mutate({ sessionId: session.id })}
                disabled={revoke.isPending}
                className="px-3 py-1.5 rounded text-xs font-medium hover:opacity-80"
                style={{
                  color: "#eb5757",
                  backgroundColor: "rgba(235,87,87,0.1)",
                }}
              >
                종료
              </button>
            )}
          </div>
        ))}

        {!sessions?.length && (
          <div className="text-center py-8">
            <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
              세션 정보를 불러오는 중...
            </p>
          </div>
        )}
      </div>

      {/* Revoke all button */}
      {sessions && sessions.length > 1 && (
        <div
          className="p-4 rounded-lg"
          style={{ backgroundColor: "rgba(235,87,87,0.05)", border: "1px solid rgba(235,87,87,0.2)" }}
        >
          {!confirmRevokeAll ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  다른 모든 기기 로그아웃
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                  현재 세션을 제외한 모든 세션을 종료합니다
                </p>
              </div>
              <Button
                onClick={() => setConfirmRevokeAll(true)}
                size="md"
                className="!bg-[#eb5757] !text-white hover:!opacity-90"
              >
                모두 로그아웃
              </Button>
            </div>
          ) : (
            <div>
              <p className="text-sm font-medium mb-3" style={{ color: "#eb5757" }}>
                정말로 다른 모든 기기에서 로그아웃하시겠습니까?
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={() => revokeAll.mutate()}
                  disabled={revokeAll.isPending}
                  size="md"
                  className="!bg-[#eb5757] !text-white hover:!opacity-90"
                >
                  {revokeAll.isPending ? "처리 중..." : "확인"}
                </Button>
                <Button
                  onClick={() => setConfirmRevokeAll(false)}
                  size="md"
                  variant="ghost"
                >
                  취소
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
