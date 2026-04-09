"use client";

import { useState, useEffect, useRef } from "react";
import { trpc } from "@/server/trpc/client";
import { PageCover } from "./page-cover";
import { PageIconPicker } from "./page-icon-picker";
import { PageTitle } from "@/components/editor/page-title";
import { Smile, ImageIcon } from "lucide-react";

type PageHeaderProps = {
  page: {
    id: string;
    title: string | null;
    icon: string | null;
    cover: string | null;
  };
};

export function PageHeader({ page }: PageHeaderProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showCoverPicker, setShowCoverPicker] = useState(false);

  const utils = trpc.useUtils();
  const updatePage = trpc.page.update.useMutation({
    onSuccess: () => {
      utils.page.get.invalidate({ id: page.id });
      utils.page.list.invalidate();
    },
  });

  const handleIconSelect = (icon: string | null) => {
    updatePage.mutate({ id: page.id, icon });
  };

  const handleChangeCover = () => {
    setShowCoverPicker(true);
  };

  const handleCoverUrlSelect = (url: string) => {
    updatePage.mutate({ id: page.id, cover: url || null });
    setShowCoverPicker(false);
  };

  const handleRemoveCover = () => {
    updatePage.mutate({ id: page.id, cover: null });
  };

  return (
    <div>
      {/* Cover */}
      {page.cover && (
        <PageCover
          cover={page.cover}
          onChangeCover={handleChangeCover}
          onRemoveCover={handleRemoveCover}
        />
      )}

      {/* Cover Picker Modal */}
      {showCoverPicker && (
        <>
          <div
            className="fixed inset-0"
            style={{ zIndex: 90 }}
            onClick={() => setShowCoverPicker(false)}
          />
          <div
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ zIndex: 91 }}
          >
            <div
              className="rounded-lg overflow-hidden"
              style={{
                backgroundColor: "var(--bg-primary)",
                border: "1px solid var(--border-default)",
                boxShadow: "var(--shadow-popup)",
                width: "520px",
              }}
            >
              <CoverPickerTabs
                currentCover={page.cover}
                onSelect={handleCoverUrlSelect}
                onClose={() => setShowCoverPicker(false)}
              />
            </div>
          </div>
        </>
      )}

      {/* Icon + Controls area */}
      <div
        className="relative"
        style={{
          maxWidth: "var(--page-max-width)",
          margin: "0 auto",
          paddingLeft: "var(--page-padding-x)",
          paddingRight: "var(--page-padding-x)",
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Icon */}
        {page.icon && (
          <div className="relative" style={{ marginTop: page.cover ? "-32px" : "72px" }}>
            <button
              onClick={() => setShowIconPicker(true)}
              className="text-6xl cursor-pointer hover:opacity-80 mb-2 block"
              style={{ lineHeight: 1 }}
            >
              {page.icon}
            </button>
            {showIconPicker && (
              <PageIconPicker
                currentIcon={page.icon}
                onSelect={handleIconSelect}
                onClose={() => setShowIconPicker(false)}
              />
            )}
          </div>
        )}

        {/* Hover buttons — always take up space, only show on hover (no layout shift) */}
        {(!page.icon || !page.cover) && (
          <div
            className="flex gap-1 transition-opacity duration-150"
            style={{
              marginTop: page.icon ? undefined : page.cover ? "12px" : "72px",
              marginBottom: "4px",
              opacity: isHovered ? 1 : 0,
              pointerEvents: isHovered ? "auto" : "none",
              height: "28px", // Fixed height to prevent layout shift
            }}
          >
            {!page.icon && (
              <button
                onClick={() => setShowIconPicker(true)}
                className="flex items-center gap-1 px-1.5 py-1 rounded text-xs hover:bg-notion-bg-hover"
                style={{ color: "var(--text-tertiary)" }}
              >
                <Smile size={14} /> 아이콘 추가
              </button>
            )}
            {!page.cover && (
              <button
                onClick={handleChangeCover}
                className="flex items-center gap-1 px-1.5 py-1 rounded text-xs hover:bg-notion-bg-hover"
                style={{ color: "var(--text-tertiary)" }}
              >
                <ImageIcon size={14} /> 커버 추가
              </button>
            )}
          </div>
        )}

        {/* Icon picker when no icon exists yet */}
        {!page.icon && showIconPicker && (
          <div className="relative" style={{ marginTop: page.cover ? "12px" : "0" }}>
            <PageIconPicker
              currentIcon={null}
              onSelect={handleIconSelect}
              onClose={() => setShowIconPicker(false)}
            />
          </div>
        )}

        {/* Title */}
        <div style={{ marginTop: !page.icon && !page.cover ? "72px" : undefined }}>
          <PageTitle pageId={page.id} initialTitle={page.title || "제목 없음"} />
        </div>
      </div>
    </div>
  );
}

/* ── Cover Picker with tabs: URL / Unsplash ── */

function CoverPickerTabs({
  currentCover,
  onSelect,
  onClose,
}: {
  currentCover: string | null;
  onSelect: (url: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"url" | "unsplash">("unsplash");
  const [urlInput, setUrlInput] = useState(currentCover || "");

  return (
    <div>
      {/* Tab bar */}
      <div
        className="flex items-center gap-0 px-3 pt-2"
        style={{ borderBottom: "1px solid var(--border-default)" }}
      >
        <button
          onClick={() => setTab("unsplash")}
          className="px-3 py-2 text-sm relative"
          style={{
            color: tab === "unsplash" ? "var(--text-primary)" : "var(--text-tertiary)",
            fontWeight: tab === "unsplash" ? 500 : 400,
          }}
        >
          Unsplash
          {tab === "unsplash" && (
            <div
              className="absolute bottom-0 left-0 right-0 h-0.5"
              style={{ backgroundColor: "var(--text-primary)" }}
            />
          )}
        </button>
        <button
          onClick={() => setTab("url")}
          className="px-3 py-2 text-sm relative"
          style={{
            color: tab === "url" ? "var(--text-primary)" : "var(--text-tertiary)",
            fontWeight: tab === "url" ? 500 : 400,
          }}
        >
          URL
          {tab === "url" && (
            <div
              className="absolute bottom-0 left-0 right-0 h-0.5"
              style={{ backgroundColor: "var(--text-primary)" }}
            />
          )}
        </button>
      </div>

      {/* Tab content */}
      {tab === "unsplash" && (
        <UnsplashPickerInline onSelect={onSelect} />
      )}

      {tab === "url" && (
        <div className="p-4">
          <div className="flex gap-2">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="이미지 URL을 입력하세요"
              className="flex-1 px-3 py-2 rounded text-sm outline-none"
              style={{
                backgroundColor: "var(--bg-secondary)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-default)",
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && urlInput.trim()) {
                  try {
                    const parsed = new URL(urlInput.trim());
                    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
                      onSelect(urlInput.trim());
                    }
                  } catch {
                    // Invalid URL - ignore
                  }
                }
              }}
            />
            <button
              onClick={() => {
                if (urlInput.trim()) {
                  try {
                    const parsed = new URL(urlInput.trim());
                    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
                      onSelect(urlInput.trim());
                    }
                  } catch {
                    // Invalid URL - ignore
                  }
                }
              }}
              className="px-4 py-2 rounded text-sm font-medium text-white"
              style={{ backgroundColor: "#2383e2" }}
            >
              적용
            </button>
          </div>
          <div className="flex justify-end mt-3">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded text-sm hover:bg-notion-bg-hover"
              style={{ color: "var(--text-secondary)" }}
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Inline Unsplash Picker (no outer container) ── */

interface UnsplashPhoto {
  id: string;
  urls: { regular: string; small: string };
  alt_description: string | null;
  user: { name: string };
}

const UNSPLASH_API = "https://api.unsplash.com";

function UnsplashPickerInline({ onSelect }: { onSelect: (url: string) => void }) {
  const accessKey = process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY;
  const [query, setQuery] = useState("");
  const [photos, setPhotos] = useState<UnsplashPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const abortRef = useRef<AbortController>();

  useEffect(() => {
    if (!accessKey) return;
    const controller = new AbortController();
    setLoading(true);
    fetch(`${UNSPLASH_API}/photos?per_page=18&order_by=popular`, {
      headers: { Authorization: `Client-ID ${accessKey}` },
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((data) => setPhotos(data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [accessKey]);

  const handleSearch = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) return;
    debounceRef.current = setTimeout(async () => {
      if (!accessKey) return;
      // Abort previous search request
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      setLoading(true);
      try {
        const res = await fetch(
          `${UNSPLASH_API}/search/photos?query=${encodeURIComponent(value)}&per_page=18&orientation=landscape`,
          {
            headers: { Authorization: `Client-ID ${accessKey}` },
            signal: abortRef.current.signal,
          }
        );
        const data = await res.json();
        setPhotos(data.results || []);
      } catch {
        // ignore (includes AbortError)
      } finally {
        setLoading(false);
      }
    }, 400);
  };

  if (!accessKey) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm mb-1" style={{ color: "var(--text-secondary)" }}>
          Unsplash API 키를 설정해주세요
        </p>
        <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
          환경 변수 <code className="px-1 py-0.5 rounded" style={{ backgroundColor: "var(--bg-tertiary)" }}>NEXT_PUBLIC_UNSPLASH_ACCESS_KEY</code>
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="p-3" style={{ borderBottom: "1px solid var(--border-default)" }}>
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
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
      <div className="overflow-y-auto" style={{ maxHeight: "300px" }}>
        {loading && (
          <div className="p-4 text-center">
            <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>검색 중...</p>
          </div>
        )}
        {!loading && photos.length > 0 && (
          <div className="grid grid-cols-3 gap-1 p-2">
            {photos.map((photo) => (
              <button
                key={photo.id}
                onClick={() => {
                  onSelect(photo.urls.regular);
                  if (accessKey) {
                    fetch(`${UNSPLASH_API}/photos/${photo.id}/download`, {
                      headers: { Authorization: `Client-ID ${accessKey}` },
                    }).catch(() => {});
                  }
                }}
                className="relative group overflow-hidden rounded"
                style={{ aspectRatio: "3/2" }}
              >
                <img
                  src={photo.urls.small}
                  alt={photo.alt_description || ""}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-end"
                  style={{ background: "linear-gradient(transparent 40%, rgba(0,0,0,0.6))" }}
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
      <div className="px-3 py-1.5 text-right" style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>
        Photos by Unsplash
      </div>
    </div>
  );
}
