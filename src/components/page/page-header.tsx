"use client";

import { useState } from "react";
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
    const url = window.prompt("커버 이미지 URL을 입력하세요:", page.cover || "");
    if (url !== null) {
      updatePage.mutate({ id: page.id, cover: url || null });
    }
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

        {/* Hover buttons (when icon or cover is missing) */}
        {isHovered && (!page.icon || !page.cover) && (
          <div
            className="flex gap-1"
            style={{
              marginTop: page.icon ? undefined : page.cover ? "12px" : "72px",
              marginBottom: "4px",
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
        <div style={{ marginTop: !page.icon && !isHovered && !page.cover ? "72px" : undefined }}>
          <PageTitle pageId={page.id} initialTitle={page.title || "제목 없음"} />
        </div>
      </div>
    </div>
  );
}
