"use client";

import { useState, useCallback, useEffect } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { FileUpload } from "./file-upload";
import { Paperclip, FileText } from "lucide-react";

function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileNodeView({ node, updateAttributes }: NodeViewProps) {
  const src = node.attrs.src as string;
  const name = (node.attrs.name as string) || "파일";
  const size = node.attrs.size as number;
  const type = (node.attrs.type as string) || "";

  const [showUpload, setShowUpload] = useState(!src);

  useEffect(() => {
    if (!src) setShowUpload(true);
  }, [src]);

  const handleFileSelected = useCallback(
    (result: { url: string; name: string; size: number; type: string }) => {
      updateAttributes({
        src: result.url,
        name: result.name,
        size: result.size,
        type: result.type,
      });
      setShowUpload(false);
    },
    [updateAttributes],
  );

  if (!src) {
    return (
      <NodeViewWrapper>
        {showUpload ? (
          <FileUpload
            accept="*/*"
            label="모든 파일 형식"
            icon={<Paperclip size={24} />}
            onFileSelected={handleFileSelected}
            onClose={() => setShowUpload(false)}
          />
        ) : (
          <div
            className="notion-media-placeholder"
            onClick={() => setShowUpload(true)}
          >
            <span className="notion-media-placeholder-icon"><Paperclip size={24} /></span>
            <span>파일을 첨부하려면 클릭하세요</span>
          </div>
        )}
      </NodeViewWrapper>
    );
  }

  const sizeLabel = formatFileSize(size);

  return (
    <NodeViewWrapper>
      <div className="notion-file-block">
        <div className="notion-file-icon"><FileText size={20} /></div>
        <div className="notion-file-info">
          <span className="notion-file-name">{name}</span>
          {(sizeLabel || type) && (
            <span className="notion-file-meta">
              {sizeLabel}
              {sizeLabel && type ? " · " : ""}
              {type}
            </span>
          )}
        </div>
        <a
          href={src}
          download={name}
          target="_blank"
          rel="noopener noreferrer"
          className="notion-file-download"
          onClick={(e) => e.stopPropagation()}
        >
          다운로드
        </a>
      </div>
    </NodeViewWrapper>
  );
}
