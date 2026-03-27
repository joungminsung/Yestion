"use client";

import { useState, useCallback, useEffect } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { FileUpload } from "./file-upload";
import { Music } from "lucide-react";

export function AudioNodeView({ node, updateAttributes }: NodeViewProps) {
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
            accept="audio/*"
            label="오디오 파일 (MP3, WAV 등)"
            icon={<Music size={24} />}
            onFileSelected={handleFileSelected}
            onClose={() => setShowUpload(false)}
          />
        ) : (
          <div
            className="notion-media-placeholder"
            onClick={() => setShowUpload(true)}
          >
            <span className="notion-media-placeholder-icon"><Music size={24} /></span>
            <span>오디오를 추가하려면 클릭하세요</span>
          </div>
        )}
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper>
      <div className="notion-audio-block">
        <audio
          src={src}
          title={title}
          controls
          style={{ width: "100%" }}
        />
      </div>
    </NodeViewWrapper>
  );
}
