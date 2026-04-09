"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useToastStore } from "@/stores/toast";

interface BackupSettingsProps {
  workspaceId: string;
}

type OperationFeedback = {
  title: string;
  detail: string;
  progress: number;
  tone: "info" | "success" | "error";
};

export function BackupSettings({ workspaceId }: BackupSettingsProps) {
  const addToast = useToastStore((s) => s.addToast);
  const updateToast = useToastStore((s) => s.updateToast);
  const [downloading, setDownloading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [operationFeedback, setOperationFeedback] = useState<OperationFeedback | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBackup = async () => {
    setDownloading(true);
    const toastId = addToast({
      type: "info",
      title: "백업 준비 중",
      message: "워크스페이스 데이터를 수집하고 있습니다.",
      loading: true,
      progress: 15,
      persistent: true,
    });
    setOperationFeedback({
      title: "백업 파일을 준비하고 있습니다",
      detail: "워크스페이스의 페이지, 블록, 데이터베이스를 수집하고 있습니다.",
      progress: 15,
      tone: "info",
    });

    try {
      const res = await fetch(`/api/backup?workspaceId=${workspaceId}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "백업 실패");
      }

      updateToast(toastId, {
        message: "백업 파일을 만들고 있습니다.",
        progress: 62,
      });
      setOperationFeedback({
        title: "백업 파일을 생성하고 있습니다",
        detail: "다운로드할 수 있도록 JSON 파일을 준비하고 있습니다.",
        progress: 62,
        tone: "info",
      });

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition");
      const filenameMatch = disposition?.match(/filename="([^"]+)"/);
      const filename = filenameMatch ? decodeURIComponent(filenameMatch[1]!) : "backup.json";

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      updateToast(toastId, {
        type: "success",
        title: "백업 다운로드 완료",
        message: `${filename} 파일이 준비되었습니다.`,
        loading: false,
        progress: 100,
        persistent: false,
        duration: 3000,
      });
      setOperationFeedback({
        title: "백업 파일 다운로드 완료",
        detail: `${filename} 파일을 내려받았습니다. 필요하면 안전한 위치에 보관해주세요.`,
        progress: 100,
        tone: "success",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "백업에 실패했습니다";
      updateToast(toastId, {
        type: "error",
        title: "백업 실패",
        message,
        loading: false,
        progress: 100,
        persistent: false,
      });
      setOperationFeedback({
        title: "백업에 실패했습니다",
        detail: message,
        progress: 100,
        tone: "error",
      });
    } finally {
      setDownloading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setConfirmRestore(true);
    }
  };

  const handleRestore = async () => {
    if (!selectedFile) return;

    setRestoring(true);
    const toastId = addToast({
      type: "warning",
      title: "복원 준비 중",
      message: "백업 파일을 검증하고 있습니다.",
      loading: true,
      progress: 12,
      persistent: true,
    });
    setOperationFeedback({
      title: "복원을 준비하고 있습니다",
      detail: "선택한 백업 파일의 형식과 내용을 확인하고 있습니다.",
      progress: 12,
      tone: "info",
    });

    try {
      const text = await selectedFile.text();
      const data = JSON.parse(text);

      updateToast(toastId, {
        message: "백업 데이터를 서버로 업로드하고 있습니다.",
        progress: 48,
      });
      setOperationFeedback({
        title: "백업 데이터를 업로드하고 있습니다",
        detail: "현재 워크스페이스를 선택한 백업 상태로 교체하기 위해 서버에 전송 중입니다.",
        progress: 48,
        tone: "info",
      });

      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, data }),
      });

      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || "복원 실패");
      }

      updateToast(toastId, {
        type: "success",
        title: "복원 완료",
        message: "데이터를 복원했고, 최신 상태를 반영하기 위해 페이지를 새로고침합니다.",
        loading: false,
        progress: 100,
        persistent: false,
        duration: 3500,
      });
      setOperationFeedback({
        title: "복원이 완료되었습니다",
        detail: "변경 사항을 반영하기 위해 잠시 후 페이지를 새로고침합니다.",
        progress: 100,
        tone: "success",
      });
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      const message =
        err instanceof SyntaxError
          ? "백업 파일 형식이 올바르지 않습니다. JSON 파일인지 확인해주세요."
          : err instanceof Error
            ? err.message
            : "복원에 실패했습니다";
      updateToast(toastId, {
        type: "error",
        title: "복원 실패",
        message,
        loading: false,
        progress: 100,
        persistent: false,
      });
      setOperationFeedback({
        title: "복원에 실패했습니다",
        detail: message,
        progress: 100,
        tone: "error",
      });
    } finally {
      setRestoring(false);
      setConfirmRestore(false);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
        데이터 백업 및 복원
      </h2>
      <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
        워크스페이스의 모든 데이터를 JSON 파일로 백업하거나, 백업 파일에서 복원할 수 있습니다.
      </p>

      {operationFeedback && (
        <div
          className="mb-6 rounded-lg border px-4 py-3"
          style={{
            borderColor:
              operationFeedback.tone === "error"
                ? "rgba(224, 62, 62, 0.2)"
                : operationFeedback.tone === "success"
                  ? "rgba(34, 197, 94, 0.2)"
                  : "rgba(35, 131, 226, 0.18)",
            backgroundColor:
              operationFeedback.tone === "error"
                ? "rgba(224, 62, 62, 0.05)"
                : operationFeedback.tone === "success"
                  ? "rgba(34, 197, 94, 0.05)"
                  : "rgba(35, 131, 226, 0.05)",
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                {operationFeedback.title}
              </p>
              <p className="mt-1 text-xs leading-5" style={{ color: "var(--text-secondary)" }}>
                {operationFeedback.detail}
              </p>
            </div>
            <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
              {Math.round(operationFeedback.progress)}%
            </span>
          </div>
          <div
            className="mt-3 h-1.5 overflow-hidden rounded-full"
            style={{ backgroundColor: "var(--bg-tertiary)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.max(0, Math.min(100, operationFeedback.progress))}%`,
                backgroundColor:
                  operationFeedback.tone === "error"
                    ? "#e03e3e"
                    : operationFeedback.tone === "success"
                      ? "#22c55e"
                      : "#2383e2",
              }}
            />
          </div>
        </div>
      )}

      {/* Backup section */}
      <section className="mb-8">
        <h3 className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>
          데이터 백업
        </h3>
        <p className="text-xs mb-3" style={{ color: "var(--text-tertiary)" }}>
          모든 페이지, 블록, 데이터베이스, 뷰 데이터를 JSON 파일로 내보냅니다.
        </p>
        <Button
          onClick={handleBackup}
          disabled={downloading}
          size="md"
        >
          {downloading ? "다운로드 중..." : "📦 데이터 백업"}
        </Button>
      </section>

      {/* Restore section */}
      <section className="mb-8">
        <h3 className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>
          복원
        </h3>

        <div
          className="p-4 rounded-lg mb-4"
          style={{ backgroundColor: "rgba(235,87,87,0.05)", border: "1px solid rgba(235,87,87,0.2)" }}
        >
          <p className="text-sm font-medium mb-1" style={{ color: "#eb5757" }}>
            주의: 데이터 덮어쓰기
          </p>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            복원 시 현재 워크스페이스의 모든 페이지, 블록, 데이터베이스 데이터가 삭제되고 백업 파일의 데이터로 대체됩니다. 이 작업은 되돌릴 수 없으므로 먼저 현재 데이터를 백업해주세요.
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileSelect}
          className="hidden"
        />

        {!confirmRestore ? (
          <Button
            onClick={() => fileInputRef.current?.click()}
            size="md"
            variant="ghost"
          >
            📂 백업 파일 선택
          </Button>
        ) : (
          <div
            className="p-4 rounded-lg"
            style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-default)" }}
          >
            <p className="text-sm mb-1" style={{ color: "var(--text-primary)" }}>
              선택된 파일: <span className="font-medium">{selectedFile?.name}</span>
            </p>
            <p className="text-xs mb-3" style={{ color: "#eb5757" }}>
              정말로 이 백업 파일로 복원하시겠습니까? 현재 데이터가 모두 삭제됩니다.
            </p>
            <div className="flex gap-2">
              <Button
                onClick={handleRestore}
                disabled={restoring}
                size="md"
                className="!bg-[#eb5757] !text-white hover:!opacity-90"
              >
                {restoring ? "복원 중..." : "복원 실행"}
              </Button>
              <Button
                onClick={() => {
                  setConfirmRestore(false);
                  setSelectedFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                size="md"
                variant="ghost"
              >
                취소
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
