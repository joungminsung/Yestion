"use client";

import { useState, useCallback, useRef } from "react";
import { uploadFile } from "@/lib/upload";

type Props = {
  onImageSelected: (url: string) => void;
  onClose: () => void;
};

export function ImageUpload({ onImageSelected, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<"upload" | "url">("upload");
  const [url, setUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        setError("이미지 파일만 업로드할 수 있습니다.");
        return;
      }
      setError(null);
      setIsUploading(true);
      try {
        const result = await uploadFile(file);
        onImageSelected(result.url);
        onClose();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "업로드에 실패했습니다.",
        );
      }
      setIsUploading(false);
    },
    [onImageSelected, onClose],
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
    onImageSelected(trimmed);
    onClose();
  }, [url, onImageSelected, onClose]);

  return (
    <div className="image-upload-popover">
      {/* Tabs */}
      <div className="image-upload-tabs">
        <button
          className={`image-upload-tab ${activeTab === "upload" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("upload");
            setError(null);
          }}
        >
          업로드
        </button>
        <button
          className={`image-upload-tab ${activeTab === "url" ? "active" : ""}`}
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
          className={`image-upload-dropzone ${dragOver ? "dragover" : ""}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileInput}
            style={{ display: "none" }}
          />
          {isUploading ? (
            <div className="image-upload-loading">
              <div className="image-upload-spinner" />
              <span>업로드 중...</span>
            </div>
          ) : (
            <>
              <div className="image-upload-icon">🖼</div>
              <p className="image-upload-hint">
                클릭하거나 이미지를 드래그하세요
              </p>
              <p className="image-upload-subhint">최대 50MB</p>
            </>
          )}
        </div>
      )}

      {/* URL tab */}
      {activeTab === "url" && (
        <div className="image-upload-url-form">
          <input
            type="text"
            className="image-upload-url-input"
            placeholder="이미지 URL을 붙여넣으세요"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleUrlSubmit();
            }}
            autoFocus
          />
          <button
            className="image-upload-url-submit"
            onClick={handleUrlSubmit}
            disabled={!url.trim()}
          >
            삽입
          </button>
        </div>
      )}

      {/* Error */}
      {error && <p className="image-upload-error">{error}</p>}
    </div>
  );
}
