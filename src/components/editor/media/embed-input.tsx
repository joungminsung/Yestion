"use client";

import { useState, useCallback, type ReactNode } from "react";
import { getEmbedInfo } from "../extensions/embed-block";
import {
  Play, Diamond, CodeXml, Square, MapPin,
  MessageCircle, GitBranch, Link as LinkIcon, X,
} from "lucide-react";

type Props = {
  onEmbed: (url: string, provider: string, embedUrl: string) => void;
  onClose: () => void;
};

const PROVIDER_ICONS: Record<string, ReactNode> = {
  YouTube: <Play size={14} />,
  Vimeo: <Play size={14} />,
  Figma: <Diamond size={14} />,
  CodePen: <CodeXml size={14} />,
  CodeSandbox: <Square size={14} />,
  "Google Maps": <MapPin size={14} />,
  Twitter: <MessageCircle size={14} />,
  "GitHub Gist": <GitBranch size={14} />,
};

export function EmbedInput({ onEmbed, onClose }: Props) {
  const [url, setUrl] = useState("");
  const [detectedProvider, setDetectedProvider] = useState<string | null>(null);

  const handleUrlChange = useCallback((value: string) => {
    setUrl(value);
    const info = getEmbedInfo(value.trim());
    setDetectedProvider(info ? info.provider : null);
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = url.trim();
    if (!trimmed) return;

    try {
      new URL(trimmed);
    } catch {
      return;
    }

    const info = getEmbedInfo(trimmed);
    if (info) {
      onEmbed(trimmed, info.provider, info.embedUrl);
    } else {
      onEmbed(trimmed, "일반", trimmed);
    }
  }, [url, onEmbed]);

  return (
    <div className="embed-input-popover">
      <div className="embed-input-header">
        <span className="embed-input-title">임베드</span>
        <button className="embed-input-close" onClick={onClose} title="닫기"><X size={14} /></button>
      </div>
      <div className="embed-input-body">
        <div className="embed-input-field">
          <input
            type="text"
            className="embed-input-url"
            placeholder="URL을 붙여넣으세요"
            value={url}
            onChange={(e) => handleUrlChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
              if (e.key === "Escape") onClose();
            }}
            autoFocus
          />
        </div>
        {detectedProvider && (
          <div className="embed-input-provider">
            <span className="embed-input-provider-icon">
              {PROVIDER_ICONS[detectedProvider] || <LinkIcon size={14} />}
            </span>
            <span className="embed-input-provider-name">{detectedProvider}</span>
          </div>
        )}
        <p className="embed-input-hint">
          YouTube, Vimeo, Figma, CodePen, CodeSandbox, Google Maps 등을 지원합니다.
        </p>
        <button
          className="embed-input-submit"
          onClick={handleSubmit}
          disabled={!url.trim()}
        >
          임베드
        </button>
      </div>
    </div>
  );
}
