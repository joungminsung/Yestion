"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface UnsplashPhoto {
  id: string;
  urls: {
    raw: string;
    full: string;
    regular: string;
    small: string;
    thumb: string;
  };
  alt_description: string | null;
  user: {
    name: string;
    links: { html: string };
  };
  width: number;
  height: number;
}

interface UnsplashPickerProps {
  onSelect: (url: string) => void;
  onClose: () => void;
}

const UNSPLASH_API = "https://api.unsplash.com";

export function UnsplashPicker({ onSelect, onClose }: UnsplashPickerProps) {
  const accessKey = process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY;
  const [query, setQuery] = useState("");
  const [photos, setPhotos] = useState<UnsplashPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Click outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const searchPhotos = useCallback(
    async (searchQuery: string) => {
      if (!accessKey) return;
      if (!searchQuery.trim()) {
        setPhotos([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `${UNSPLASH_API}/search/photos?query=${encodeURIComponent(searchQuery)}&per_page=20&orientation=landscape`,
          {
            headers: {
              Authorization: `Client-ID ${accessKey}`,
            },
          }
        );

        if (!res.ok) {
          throw new Error(`Unsplash API error: ${res.status}`);
        }

        const data = await res.json();
        setPhotos(data.results || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "검색에 실패했습니다");
        setPhotos([]);
      } finally {
        setLoading(false);
      }
    },
    [accessKey]
  );

  // Load popular photos on mount
  useEffect(() => {
    if (!accessKey) return;

    const loadPopular = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `${UNSPLASH_API}/photos?per_page=20&order_by=popular`,
          {
            headers: { Authorization: `Client-ID ${accessKey}` },
          }
        );
        if (res.ok) {
          const data = await res.json();
          setPhotos(data || []);
        }
      } catch {
        // Silently fail for popular photos
      } finally {
        setLoading(false);
      }
    };

    loadPopular();
  }, [accessKey]);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      searchPhotos(value);
    }, 400);
  };

  const handleSelect = (photo: UnsplashPhoto) => {
    // Use regular size for good quality + reasonable file size
    onSelect(photo.urls.regular);
    // Unsplash guidelines: trigger download endpoint
    if (accessKey) {
      fetch(`${UNSPLASH_API}/photos/${photo.id}/download`, {
        headers: { Authorization: `Client-ID ${accessKey}` },
      }).catch(() => {});
    }
  };

  if (!accessKey) {
    return (
      <div
        ref={ref}
        className="rounded-lg p-6"
        style={{
          backgroundColor: "var(--bg-primary)",
          border: "1px solid var(--border-default)",
          boxShadow: "var(--shadow-popup)",
          width: "420px",
        }}
      >
        <div className="text-center py-4">
          <p className="text-sm mb-2" style={{ color: "var(--text-secondary)" }}>
            Unsplash API 키를 설정해주세요
          </p>
          <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
            환경 변수 <code className="px-1 py-0.5 rounded" style={{ backgroundColor: "var(--bg-tertiary)" }}>NEXT_PUBLIC_UNSPLASH_ACCESS_KEY</code>를 설정하세요
          </p>
        </div>
        <div className="flex justify-end mt-3">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded text-sm hover:bg-notion-bg-hover"
            style={{ color: "var(--text-secondary)" }}
          >
            닫기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="rounded-lg overflow-hidden"
      style={{
        backgroundColor: "var(--bg-primary)",
        border: "1px solid var(--border-default)",
        boxShadow: "var(--shadow-popup)",
        width: "480px",
        maxHeight: "500px",
      }}
    >
      {/* Search input */}
      <div className="p-3" style={{ borderBottom: "1px solid var(--border-default)" }}>
        <input
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="Unsplash에서 이미지 검색..."
          autoFocus
          className="w-full px-3 py-2 rounded text-sm outline-none"
          style={{
            backgroundColor: "var(--bg-secondary)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-default)",
          }}
        />
      </div>

      {/* Content */}
      <div className="overflow-y-auto" style={{ maxHeight: "400px" }}>
        {error && (
          <div className="p-4 text-center">
            <p className="text-sm" style={{ color: "#eb5757" }}>{error}</p>
          </div>
        )}

        {loading && (
          <div className="p-4 text-center">
            <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>검색 중...</p>
          </div>
        )}

        {!loading && !error && photos.length === 0 && query && (
          <div className="p-4 text-center">
            <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>검색 결과가 없습니다</p>
          </div>
        )}

        {photos.length > 0 && (
          <div className="grid grid-cols-3 gap-1 p-2">
            {photos.map((photo) => (
              <button
                key={photo.id}
                onClick={() => handleSelect(photo)}
                className="relative group overflow-hidden rounded"
                style={{ aspectRatio: "3/2" }}
              >
                <img
                  src={photo.urls.small}
                  alt={photo.alt_description || "Unsplash photo"}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-end"
                  style={{
                    background: "linear-gradient(transparent 40%, rgba(0,0,0,0.6))",
                  }}
                >
                  <span className="text-white text-[10px] px-2 pb-1.5 truncate w-full">
                    {photo.user.name}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        className="px-3 py-2 flex items-center justify-between"
        style={{
          borderTop: "1px solid var(--border-default)",
          fontSize: "11px",
          color: "var(--text-tertiary)",
        }}
      >
        <span>Photos by Unsplash</span>
        <button
          onClick={onClose}
          className="px-2 py-1 rounded text-xs hover:bg-notion-bg-hover"
          style={{ color: "var(--text-secondary)" }}
        >
          닫기
        </button>
      </div>
    </div>
  );
}
