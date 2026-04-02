// src/components/page/template-edit-dialog.tsx
"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { trpc } from "@/server/trpc/client";

type Props = {
  templateId: string;
  onClose: () => void;
  onSaved: () => void;
};

const CATEGORY_OPTIONS = [
  { value: "documents", label: "문서" },
  { value: "personal", label: "개인" },
  { value: "team", label: "팀" },
  { value: "project", label: "프로젝트" },
  { value: "engineering", label: "엔지니어링" },
  { value: "education", label: "교육" },
  { value: "marketing", label: "마케팅" },
  { value: "custom", label: "사용자 정의" },
];

export function TemplateEditDialog({ templateId, onClose, onSaved }: Props) {
  const { data: template, isLoading } = trpc.template.getById.useQuery(
    { id: templateId },
    { enabled: !!templateId }
  );

  const [name, setName] = useState("");
  const [nameKo, setNameKo] = useState("");
  const [description, setDescription] = useState("");
  const [descriptionKo, setDescriptionKo] = useState("");
  const [icon, setIcon] = useState("");
  const [category, setCategory] = useState("custom");
  const [tags, setTags] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  useEffect(() => {
    if (template) {
      setName(template.name);
      setNameKo(template.nameKo || "");
      setDescription(template.description || "");
      setDescriptionKo(template.descriptionKo || "");
      setIcon(template.icon || "");
      setCategory(template.category);
      setTags(template.tags.join(", "));
      setIsPublic(template.isPublic);
    }
  }, [template]);

  const updateMutation = trpc.template.update.useMutation({
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      id: templateId,
      name,
      nameKo: nameKo || undefined,
      description: description || undefined,
      descriptionKo: descriptionKo || undefined,
      icon: icon || undefined,
      category: category as "documents" | "personal" | "team" | "project" | "engineering" | "education" | "marketing" | "custom",
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      isPublic,
    });
  };

  if (isLoading) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: "var(--z-modal)" }}
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative w-full max-w-md rounded-xl border shadow-2xl"
        style={{
          backgroundColor: "var(--bg-primary)",
          borderColor: "var(--border-default)",
        }}
      >
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: "var(--border-default)" }}
        >
          <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>
            템플릿 편집
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-notion-bg-hover">
            <X size={16} style={{ color: "var(--text-tertiary)" }} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
              아이콘
            </label>
            <input
              type="text"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="📝"
              className="w-16 px-2 py-1.5 text-lg border rounded outline-none text-center"
              style={{
                borderColor: "var(--border-default)",
                backgroundColor: "var(--bg-primary)",
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                Name (EN)
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border rounded outline-none"
                style={{
                  borderColor: "var(--border-default)",
                  backgroundColor: "var(--bg-primary)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                이름 (KO)
              </label>
              <input
                type="text"
                value={nameKo}
                onChange={(e) => setNameKo(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border rounded outline-none"
                style={{
                  borderColor: "var(--border-default)",
                  backgroundColor: "var(--bg-primary)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                Description (EN)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full px-2 py-1.5 text-sm border rounded outline-none resize-none"
                style={{
                  borderColor: "var(--border-default)",
                  backgroundColor: "var(--bg-primary)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                설명 (KO)
              </label>
              <textarea
                value={descriptionKo}
                onChange={(e) => setDescriptionKo(e.target.value)}
                rows={2}
                className="w-full px-2 py-1.5 text-sm border rounded outline-none resize-none"
                style={{
                  borderColor: "var(--border-default)",
                  backgroundColor: "var(--bg-primary)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
              카테고리
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-2 py-1.5 text-sm border rounded outline-none"
              style={{
                borderColor: "var(--border-default)",
                backgroundColor: "var(--bg-primary)",
                color: "var(--text-primary)",
              }}
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
              태그 (쉼표로 구분)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="tag1, tag2, tag3"
              className="w-full px-2 py-1.5 text-sm border rounded outline-none"
              style={{
                borderColor: "var(--border-default)",
                backgroundColor: "var(--bg-primary)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
              워크스페이스에 공개
            </span>
          </label>
        </div>

        <div
          className="flex justify-end gap-2 px-5 py-3 border-t"
          style={{ borderColor: "var(--border-default)" }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-md hover:bg-notion-bg-hover"
            style={{ color: "var(--text-secondary)" }}
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || updateMutation.isPending}
            className="px-4 py-2 text-sm rounded-md text-white disabled:opacity-50"
            style={{ backgroundColor: "#2383e2" }}
          >
            {updateMutation.isPending ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
