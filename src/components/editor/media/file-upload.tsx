"use client";

import { useState, useCallback, useRef } from "react";
import { uploadFile } from "@/lib/upload";

type Props = {
  accept: string;
  label: string;
  icon: string;
  onFileSelected: (result: { url: string; name: string; size: number; type: string }) => void;
  onClose: () => void;
};

export function FileUpload({ accept, label, icon, onFileSelected, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<"upload" | "url">("upload");
  const [url, setUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setFileName(file.name);
      setIsUploading(true);
      try {
        const result = await uploadFile(file);
        onFileSelected(result);
        onClose();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "업로드에 실패했습니다.",
        );
      }
      setIsUploading(false);
    },
    [onFileSelected, onClose],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleUrlSubmit = useCallback(() => {
    const trimmed = url.trim();
    if (!trimmed) return;
    try {
      new URL(trimmed);
    } catch {
      setError("유효한 URL을 입력해주세요.");
      return;
    }
    const name = trimmed.split("/").pop() || "file";
    onFileSelected({ url: trimmed, name, size: 0, type: "" });
    onClose();
  }, [url, onFileSelected, onClose]);

  return (
    <div className="file-upload-popover">
      {/* Tabs */}
      <div className="file-upload-tabs">
        <button
          className={`file-upload-tab ${activeTab === "upload" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("upload");
            setError(null);
          }}
        >
          업로드
        </button>
        <button
          className={`file-upload-tab ${activeTab === "url" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("url");
            setError(null);
          }}
        >
          링크
        </button>
      </div>

      {/* Upload tab */}
      {activeTab === "upload" && (
        <div
          className={`file-upload-dropzone ${dragOver ? "dragover" : ""}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            onChange={handleFileInput}
            style={{ display: "none" }}
          />
          {isUploading ? (
            <div className="file-upload-loading">
              <div className="file-upload-spinner" />
              <span>{fileName ? `${fileName} 업로드 중...` : "업로드 중..."}</span>
            </div>
          ) : (
            <>
              <div className="file-upload-icon">{icon}</div>
              <p className="file-upload-hint">
                클릭하거나 파일을 드래그하세요
              </p>
              <p className="file-upload-subhint">{label}</p>
            </>
          )}
        </div>
      )}

      {/* URL tab */}
      {activeTab === "url" && (
        <div className="file-upload-url-form">
          <input
            type="text"
            className="file-upload-url-input"
            placeholder="파일 URL을 붙여넣으세요"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleUrlSubmit();
            }}
            autoFocus
          />
          <button
            className="file-upload-url-submit"
            onClick={handleUrlSubmit}
            disabled={!url.trim()}
          >
            삽입
          </button>
        </div>
      )}

      {/* Error */}
      {error && <p className="file-upload-error">{error}</p>}
    </div>
  );
}
