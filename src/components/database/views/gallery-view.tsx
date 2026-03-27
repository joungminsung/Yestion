"use client";

import { useMemo } from "react";
import { CellRenderer } from "../cell-renderer";
import type { DatabaseData, RowData, ViewConfig } from "@/types/database";

type GalleryViewProps = {
  databaseId: string;
  properties: DatabaseData["properties"];
  rows: RowData[];
  viewConfig: ViewConfig;
  onAddRow: () => void;
  onUpdateRow: (rowId: string, propertyId: string, value: unknown) => void;
  onRowClick: (pageId: string) => void;
};

const MAX_VISIBLE_PROPERTIES = 3;

const CARD_HEIGHTS: Record<string, number> = {
  small: 160,
  medium: 220,
  large: 300,
};

const COVER_HEIGHTS: Record<string, number> = {
  small: 80,
  medium: 120,
  large: 180,
};

export function GalleryView({
  properties,
  rows,
  viewConfig,
  onAddRow,
  onRowClick,
}: GalleryViewProps) {
  const cardSize = viewConfig.galleryCardSize ?? "medium";
  const cardHeight = CARD_HEIGHTS[cardSize];
  const coverHeight = COVER_HEIGHTS[cardSize];

  // Cover property
  const coverPropertyId = viewConfig.galleryCoverProperty;

  // Visible properties excluding title, limited to 3
  const cardProperties = useMemo(() => {
    const visible = viewConfig.visibleProperties
      ? properties.filter(
          (p) =>
            viewConfig.visibleProperties!.includes(p.id) &&
            p.type !== "title",
        )
      : properties.filter((p) => p.isVisible && p.type !== "title");

    return visible
      .sort((a, b) => a.position - b.position)
      .slice(0, MAX_VISIBLE_PROPERTIES);
  }, [properties, viewConfig.visibleProperties]);

  return (
    <div
      className="grid gap-4 p-4"
      style={{
        gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
      }}
    >
      {rows.map((row) => {
        const title = row.page?.title ?? "Untitled";
        const icon = row.page?.icon;
        const rawCoverValue =
          coverPropertyId && coverPropertyId !== "__cover"
            ? (row.values[coverPropertyId] as string | undefined)
            : undefined;
        // Sanitize cover URL to prevent XSS
        const coverValue =
          typeof rawCoverValue === "string" &&
          (rawCoverValue.startsWith("http://") ||
            rawCoverValue.startsWith("https://") ||
            rawCoverValue.startsWith("/"))
            ? rawCoverValue
            : undefined;
        const hasCover = !!coverValue;

        return (
          <div
            key={row.id}
            className="cursor-pointer overflow-hidden rounded-md border shadow-sm transition-shadow hover:shadow-md"
            style={{
              backgroundColor: "var(--bg-primary)",
              borderColor: "var(--border-default)",
              minHeight: cardHeight,
            }}
            onClick={() => onRowClick(row.pageId)}
          >
            {/* Cover image / placeholder */}
            <div
              style={{
                height: coverHeight,
                backgroundColor: hasCover
                  ? undefined
                  : "var(--bg-secondary, #f7f6f3)",
                backgroundImage: hasCover
                  ? `url(${coverValue})`
                  : undefined,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />

            {/* Card body */}
            <div className="p-3">
              {/* Icon + Title */}
              <div className="flex items-center gap-1.5">
                {icon && <span className="shrink-0 text-sm">{icon}</span>}
                <span
                  className="truncate text-sm font-medium"
                  style={{ color: "var(--text-primary)" }}
                >
                  {title}
                </span>
              </div>

              {/* Property values */}
              {cardProperties.length > 0 && (
                <div className="mt-2 flex flex-col gap-1">
                  {cardProperties.map((prop) => {
                    const value = row.values[prop.id];
                    if (
                      value === null ||
                      value === undefined ||
                      value === ""
                    )
                      return null;
                    return (
                      <div
                        key={prop.id}
                        className="text-xs"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        <CellRenderer
                          value={value}
                          type={prop.type}
                          config={prop.config}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* "+ New" card */}
      <button
        onClick={onAddRow}
        className="flex cursor-pointer items-center justify-center overflow-hidden rounded-md border transition-colors hover:bg-[var(--bg-hover)]"
        style={{
          borderColor: "var(--border-default)",
          borderStyle: "dashed",
          minHeight: cardHeight,
          color: "var(--text-secondary)",
        }}
      >
        <div className="flex items-center gap-1 text-sm">
          <span className="text-lg leading-none">+</span>
          <span>New</span>
        </div>
      </button>
    </div>
  );
}
