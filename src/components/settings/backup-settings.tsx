"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useToastStore } from "@/stores/toast";

interface BackupSettingsProps {
  workspaceId: string;
}

export function BackupSettings({ workspaceId }: BackupSettingsProps) {
  const addToast = useToastStore((s) => s.addToast);
  const [downloading, setDownloading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBackup = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`/api/backup?workspaceId=${workspaceId}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "백업 실패");
      }
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

      addToast({ message: "백업 파일이 다운로드되었습니다", type: "success" });
    } catch (err) {
      addToast({ message: err instanceof Error ? err.message : "백업에 실패했습니다", type: "error" });
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
    try {
      const text = await selectedFile.text();
      const data = JSON.parse(text);

      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, data }),
      });

      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || "복원 실패");
      }

      addToast({ message: "데이터가 복원되었습니다. 페이지를 새로고침합니다.", type: "success" });
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      addToast({ message: err instanceof Error ? err.message : "복원에 실패했습니다", type: "error" });
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
