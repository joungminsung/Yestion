"use client";

import { useState, useMemo, useEffect } from "react";
import { X, Search, LayoutTemplate } from "lucide-react";
import { trpc } from "@/server/trpc/client";

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "documents", label: "Documents" },
  { id: "personal", label: "Personal" },
  { id: "team", label: "Team" },
  { id: "project", label: "Project" },
  { id: "engineering", label: "Engineering" },
  { id: "custom", label: "My Templates" },
] as const;

type Props = {
  workspaceId: string;
  onSelect: (template: { name: string; icon?: string; blocks: unknown[] }) => void;
  onClose: () => void;
};

export function TemplateGallery({ workspaceId, onSelect, onClose }: Props) {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [search, setSearch] = useState("");

  const { data: templates, isLoading } = trpc.template.list.useQuery(
    { workspaceId },
    { enabled: !!workspaceId }
  );

  // Seed system templates on first load if none exist
  const seedMutation = trpc.template.seed.useMutation();
  const utils = trpc.useUtils();
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (!seeded && !isLoading && templates && templates.length === 0) {
      setSeeded(true);
      seedMutation.mutate(undefined, {
        onSuccess: () => utils.template.list.invalidate(),
      });
    }
  }, [templates, isLoading, seeded, seedMutation, utils.template.list]);

  const filtered = useMemo(() => {
    if (!templates) return [];
    let list = templates;
    if (selectedCategory !== "all") {
      list = list.filter((t) => t.category === selectedCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.includes(q))
      );
    }
    return list;
  }, [templates, selectedCategory, search]);

  const incrementUsage = trpc.template.incrementUsage.useMutation();

  const handleSelect = (template: NonNullable<typeof templates>[number]) => {
    incrementUsage.mutate({ id: template.id });
    onSelect({
      name: template.name,
      icon: template.icon ?? undefined,
      blocks: template.blocks as unknown[],
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 modal-backdrop-enter"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative rounded-xl shadow-2xl border overflow-hidden modal-content-enter"
        style={{
          width: "min(800px, 90vw)",
          height: "min(600px, 80vh)",
          backgroundColor: "var(--bg-primary)",
          borderColor: "var(--border-default)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: "var(--border-default)" }}
        >
          <div className="flex items-center gap-2">
            <LayoutTemplate size={18} style={{ color: "var(--text-secondary)" }} />
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
              Template Gallery
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-notion-bg-hover"
            style={{ color: "var(--text-tertiary)" }}
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex h-[calc(100%-60px)]">
          {/* Sidebar */}
          <div
            className="w-44 shrink-0 py-3 px-2 border-r overflow-y-auto"
            style={{ borderColor: "var(--border-default)" }}
          >
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className="w-full text-left px-3 py-1.5 rounded text-sm transition-colors"
                style={{
                  color: selectedCategory === cat.id ? "var(--text-primary)" : "var(--text-secondary)",
                  backgroundColor: selectedCategory === cat.id ? "var(--bg-hover)" : undefined,
                  fontWeight: selectedCategory === cat.id ? 500 : 400,
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Search */}
            <div className="px-4 py-3">
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border"
                style={{ borderColor: "var(--border-default)" }}
              >
                <Search size={14} style={{ color: "var(--text-tertiary)" }} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search templates..."
                  className="flex-1 bg-transparent text-sm outline-none"
                  style={{ color: "var(--text-primary)" }}
                  autoFocus
                />
              </div>
            </div>

            {/* Template grid */}
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <span className="text-sm" style={{ color: "var(--text-tertiary)" }}>
                    Loading...
                  </span>
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex items-center justify-center h-32">
                  <span className="text-sm" style={{ color: "var(--text-tertiary)" }}>
                    {search ? "No templates match your search" : "No templates in this category"}
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3 max-md:grid-cols-2 max-sm:grid-cols-1">
                  {filtered.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleSelect(template)}
                      className="text-left p-4 rounded-lg border hover:bg-notion-bg-hover transition-colors group"
                      style={{ borderColor: "var(--border-default)" }}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-2xl shrink-0">
                          {template.icon || "📄"}
                        </span>
                        <div className="min-w-0">
                          <h3
                            className="text-sm font-medium truncate"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {template.name}
                          </h3>
                          {template.description && (
                            <p
                              className="text-xs mt-1 line-clamp-2"
                              style={{ color: "var(--text-tertiary)" }}
                            >
                              {template.description}
                            </p>
                          )}
                          {template.usageCount > 0 && (
                            <span
                              className="text-xs mt-1 inline-block"
                              style={{ color: "var(--text-placeholder)" }}
                            >
                              Used {template.usageCount} times
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
