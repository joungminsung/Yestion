"use client";

import { useState, useCallback, useEffect } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { FileUpload } from "./file-upload";
import { Film } from "lucide-react";

export function VideoNodeView({ node, updateAttributes }: NodeViewProps) {
  const src = node.attrs.src as string;
  const title = (node.attrs.title as string) || "";

  const [showUpload, setShowUpload] = useState(!src);

  useEffect(() => {
    if (!src) setShowUpload(true);
  }, [src]);

  const handleFileSelected = useCallback(
    (result: { url: string; name: string }) => {
      updateAttributes({ src: result.url, title: result.name });
      setShowUpload(false);
    },
    [updateAttributes],
  );

  if (!src) {
    return (
      <NodeViewWrapper>
        {showUpload ? (
          <FileUpload
            accept="video/*"
            label="동영상 파일 (MP4, WebM 등)"
            icon={<Film size={24} />}
            onFileSelected={handleFileSelected}
            onClose={() => setShowUpload(false)}
          />
        ) : (
          <div
            className="notion-media-placeholder"
            onClick={() => setShowUpload(true)}
          >
            <span className="notion-media-placeholder-icon"><Film size={24} /></span>
            <span>동영상을 추가하려면 클릭하세요</span>
          </div>
        )}
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper>
      <div className="notion-video-block">
        <video
          src={src}
          title={title}
          controls
          preload="metadata"
          style={{ width: "100%", maxWidth: "100%", borderRadius: 4 }}
        />
      </div>
    </NodeViewWrapper>
  );
}
