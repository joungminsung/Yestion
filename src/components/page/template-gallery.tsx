// src/components/page/template-gallery.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Search, LayoutTemplate, Star, Copy, Trash2 } from "lucide-react";
import { trpc } from "@/server/trpc/client";

const CATEGORIES = [
  { id: "all", label: "전체", labelEn: "All" },
  { id: "documents", label: "문서", labelEn: "Documents" },
  { id: "personal", label: "개인", labelEn: "Personal" },
  { id: "team", label: "팀", labelEn: "Team" },
  { id: "project", label: "프로젝트", labelEn: "Project" },
  { id: "engineering", label: "엔지니어링", labelEn: "Engineering" },
  { id: "education", label: "교육", labelEn: "Education" },
  { id: "marketing", label: "마케팅", labelEn: "Marketing" },
  { id: "custom", label: "내 템플릿", labelEn: "My Templates" },
] as const;

type TemplateData = {
  id: string;
  name: string;
  nameKo?: string | null;
  description?: string | null;
  descriptionKo?: string | null;
  icon?: string | null;
  coverImage?: string | null;
  category: string;
  blocks: unknown;
  tags: string[];
  usageCount: number;
  isDefault: boolean;
  creatorId?: string | null;
};

type Props = {
  workspaceId: string;
  onSelect: (template: { name: string; icon?: string; blocks: unknown[] }) => void;
  onClose: () => void;
};

export function TemplateGallery({ workspaceId, onSelect, onClose }: Props) {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [previewTemplate, setPreviewTemplate] = useState<TemplateData | null>(null);

  const { data, isLoading } = trpc.template.list.useQuery(
    { workspaceId, category: selectedCategory === "all" ? undefined : selectedCategory, search: search || undefined },
    { enabled: !!workspaceId }
  );

  const templates = data?.templates ?? [];

  // Seed system templates on first load if none exist
  const seedMutation = trpc.template.seed.useMutation();
  const incrementUsage = trpc.template.incrementUsage.useMutation();
  const deleteMutation = trpc.template.delete.useMutation();
  const duplicateMutation = trpc.template.duplicate.useMutation();
  const utils = trpc.useUtils();
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (!seeded && !isLoading && templates.length === 0) {
      setSeeded(true);
      seedMutation.mutate(undefined, {
        onSuccess: () => utils.template.list.invalidate(),
      });
    }
  }, [templates, isLoading, seeded, seedMutation, utils.template.list]);

  const handleSelect = useCallback(
    (template: TemplateData) => {
      incrementUsage.mutate({ id: template.id });
      onSelect({
        name: template.nameKo || template.name,
        icon: template.icon || undefined,
        blocks: (Array.isArray(template.blocks) ? template.blocks : []) as unknown[],
      });
    },
    [incrementUsage, onSelect]
  );

  const handleDuplicate = useCallback(
    (template: TemplateData) => {
      duplicateMutation.mutate(
        { id: template.id, workspaceId },
        { onSuccess: () => utils.template.list.invalidate() }
      );
    },
    [duplicateMutation, workspaceId, utils.template.list]
  );

  const handleDelete = useCallback(
    (template: TemplateData) => {
      if (template.isDefault) return;
      deleteMutation.mutate(
        { id: template.id },
        { onSuccess: () => utils.template.list.invalidate() }
      );
    },
    [deleteMutation, utils.template.list]
  );

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (previewTemplate) setPreviewTemplate(null);
        else onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose, previewTemplate]);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: "var(--z-modal)" }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Gallery */}
      <div
        className="relative w-full max-w-4xl max-h-[85vh] rounded-xl border shadow-2xl flex flex-col overflow-hidden"
        style={{
          backgroundColor: "var(--bg-primary)",
          borderColor: "var(--border-default)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b shrink-0"
          style={{ borderColor: "var(--border-default)" }}
        >
          <div className="flex items-center gap-2">
            <LayoutTemplate size={20} style={{ color: "var(--text-secondary)" }} />
            <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
              템플릿
            </h2>
            <span className="text-sm" style={{ color: "var(--text-tertiary)" }}>
              {templates.length}개
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-notion-bg-hover">
            <X size={18} style={{ color: "var(--text-tertiary)" }} />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Sidebar categories */}
          <div
            className="w-48 shrink-0 border-r py-3 overflow-y-auto"
            style={{ borderColor: "var(--border-default)" }}
          >
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className="w-full text-left px-4 py-1.5 text-sm transition-colors"
                style={{
                  color: selectedCategory === cat.id ? "#2383e2" : "var(--text-secondary)",
                  backgroundColor: selectedCategory === cat.id ? "rgba(35, 131, 226, 0.08)" : "transparent",
                  fontWeight: selectedCategory === cat.id ? 600 : 400,
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Main content */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Search */}
            <div className="px-4 py-3 border-b shrink-0" style={{ borderColor: "var(--border-divider)" }}>
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--text-placeholder)" }}
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="템플릿 검색..."
                  className="w-full pl-9 pr-3 py-2 text-sm border rounded-md outline-none focus:ring-1 focus:ring-[#2383e2]"
                  style={{
                    backgroundColor: "var(--bg-primary)",
                    borderColor: "var(--border-default)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto p-4">
              {isLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="rounded-lg border animate-pulse"
                      style={{
                        borderColor: "var(--border-default)",
                        height: 180,
                        backgroundColor: "var(--bg-tertiary)",
                      }}
                    />
                  ))}
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center py-12" style={{ color: "var(--text-tertiary)" }}>
                  {search ? "검색 결과가 없습니다" : "템플릿이 없습니다"}
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className="group rounded-lg border cursor-pointer hover:shadow-md transition-shadow overflow-hidden"
                      style={{ borderColor: "var(--border-default)" }}
                    >
                      {/* Cover / Icon area */}
                      <div
                        className="h-24 flex items-center justify-center relative"
                        style={{ backgroundColor: "var(--bg-secondary)" }}
                        onClick={() => setPreviewTemplate(template as TemplateData)}
                      >
                        <span className="text-4xl">{template.icon || "📄"}</span>
                        {/* Hover actions */}
                        <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDuplicate(template as TemplateData);
                            }}
                            className="p-1 rounded bg-white/80 hover:bg-white shadow-sm"
                            title="복제"
                          >
                            <Copy size={12} />
                          </button>
                          {!template.isDefault && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(template as TemplateData);
                              }}
                              className="p-1 rounded bg-white/80 hover:bg-white shadow-sm"
                              title="삭제"
                              style={{ color: "#e03e3e" }}
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Info */}
                      <div
                        className="p-3"
                        onClick={() => handleSelect(template as TemplateData)}
                      >
                        <div
                          className="font-medium text-sm truncate"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {template.nameKo || template.name}
                        </div>
                        <div
                          className="text-xs mt-0.5 line-clamp-2"
                          style={{ color: "var(--text-tertiary)" }}
                        >
                          {template.descriptionKo || template.description || ""}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded"
                            style={{
                              backgroundColor: "var(--bg-tertiary)",
                              color: "var(--text-tertiary)",
                            }}
                          >
                            {template.category}
                          </span>
                          {template.usageCount > 0 && (
                            <span
                              className="text-[10px] flex items-center gap-0.5"
                              style={{ color: "var(--text-tertiary)" }}
                            >
                              <Star size={8} />
                              {template.usageCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {previewTemplate && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ zIndex: "calc(var(--z-modal) + 1)" }}
        >
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setPreviewTemplate(null)}
          />
          <div
            className="relative w-full max-w-2xl max-h-[80vh] rounded-xl border shadow-2xl flex flex-col overflow-hidden"
            style={{
              backgroundColor: "var(--bg-primary)",
              borderColor: "var(--border-default)",
            }}
          >
            <div
              className="flex items-center justify-between px-6 py-4 border-b shrink-0"
              style={{ borderColor: "var(--border-default)" }}
            >
              <div className="flex items-center gap-2">
                <span className="text-2xl">{previewTemplate.icon || "📄"}</span>
                <div>
                  <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>
                    {previewTemplate.nameKo || previewTemplate.name}
                  </h3>
                  <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                    {previewTemplate.descriptionKo || previewTemplate.description}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPreviewTemplate(null)}
                className="p-1.5 rounded hover:bg-notion-bg-hover"
              >
                <X size={18} style={{ color: "var(--text-tertiary)" }} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {/* Render a simple preview of the blocks */}
              {(Array.isArray(previewTemplate.blocks)
                ? previewTemplate.blocks
                : []
              ).map((block: Record<string, unknown>, i: number) => (
                <div key={i} className="mb-2">
                  {block.type === "heading" && (
                    <div
                      className="font-semibold"
                      style={{
                        fontSize:
                          (block.attrs as Record<string, number>)?.level === 1
                            ? "1.5em"
                            : (block.attrs as Record<string, number>)?.level === 2
                              ? "1.25em"
                              : "1.1em",
                        color: "var(--text-primary)",
                      }}
                    >
                      {(
                        (block.content as { text?: string }[]) || []
                      )
                        .map((c) => c.text || "")
                        .join("")}
                    </div>
                  )}
                  {block.type === "paragraph" && (
                    <div className="text-sm" style={{ color: "var(--text-secondary)", minHeight: 20 }}>
                      {(
                        (block.content as { text?: string }[]) || []
                      )
                        .map((c) => c.text || "")
                        .join("") || " "}
                    </div>
                  )}
                  {(block.type === "bulletList" || block.type === "taskList" || block.type === "orderedList") && (
                    <div className="text-sm ml-4" style={{ color: "var(--text-secondary)" }}>
                      {block.type === "bulletList" && "- (list items)"}
                      {block.type === "taskList" && "[ ] (task items)"}
                      {block.type === "orderedList" && "1. (numbered items)"}
                    </div>
                  )}
                  {block.type === "horizontalRule" && (
                    <hr style={{ borderColor: "var(--border-default)" }} />
                  )}
                </div>
              ))}
            </div>

            <div
              className="flex justify-end gap-2 px-6 py-3 border-t shrink-0"
              style={{ borderColor: "var(--border-default)" }}
            >
              <button
                onClick={() => setPreviewTemplate(null)}
                className="px-4 py-2 text-sm rounded-md hover:bg-notion-bg-hover"
                style={{ color: "var(--text-secondary)" }}
              >
                취소
              </button>
              <button
                onClick={() => {
                  handleSelect(previewTemplate);
                  setPreviewTemplate(null);
                }}
                className="px-4 py-2 text-sm rounded-md text-white"
                style={{ backgroundColor: "#2383e2" }}
              >
                이 템플릿 사용
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
