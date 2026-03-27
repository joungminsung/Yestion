"use client";

import { useState } from "react";
import { trpc } from "@/server/trpc/client";
import { X } from "lucide-react";

type Props = {
  workspaceId: string;
  parentId?: string;
  onSelect: (pageId: string, blocks: TemplateBlock[]) => void;
  onBlank: () => void;
  onClose: () => void;
};

type TemplateBlock = {
  type: string;
  content: string;
};

const BUILT_IN_TEMPLATES = [
  { id: "blank", name: "빈 페이지", icon: "📄", description: "처음부터 시작합니다", blocks: [] as TemplateBlock[] },
  { id: "meeting", name: "회의록", icon: "📝", description: "회의 내용을 정리합니다", blocks: [
    { type: "heading_2", content: "📋 안건" },
    { type: "paragraph", content: "" },
    { type: "heading_2", content: "💬 논의 사항" },
    { type: "paragraph", content: "" },
    { type: "heading_2", content: "✅ 결정 사항" },
    { type: "to_do", content: "" },
    { type: "heading_2", content: "📌 액션 아이템" },
    { type: "to_do", content: "" },
  ]},
  { id: "weekly", name: "주간 계획", icon: "📅", description: "이번 주 할 일을 계획합니다", blocks: [
    { type: "heading_2", content: "🎯 이번 주 목표" },
    { type: "paragraph", content: "" },
    { type: "heading_2", content: "월요일" },
    { type: "to_do", content: "" },
    { type: "heading_2", content: "화요일" },
    { type: "to_do", content: "" },
    { type: "heading_2", content: "수요일" },
    { type: "to_do", content: "" },
    { type: "heading_2", content: "목요일" },
    { type: "to_do", content: "" },
    { type: "heading_2", content: "금요일" },
    { type: "to_do", content: "" },
    { type: "heading_2", content: "📝 회고" },
    { type: "paragraph", content: "" },
  ]},
  { id: "project", name: "프로젝트 계획", icon: "🎯", description: "프로젝트를 구조화합니다", blocks: [
    { type: "heading_2", content: "📌 개요" },
    { type: "paragraph", content: "" },
    { type: "heading_2", content: "🎯 목표" },
    { type: "bulleted_list", content: "" },
    { type: "heading_2", content: "📅 타임라인" },
    { type: "paragraph", content: "" },
    { type: "heading_2", content: "👥 팀" },
    { type: "paragraph", content: "" },
    { type: "heading_2", content: "⚠️ 리스크" },
    { type: "bulleted_list", content: "" },
  ]},
  { id: "todo", name: "할 일 목록", icon: "☑️", description: "할 일을 관리합니다", blocks: [
    { type: "heading_2", content: "오늘 할 일" },
    { type: "to_do", content: "" },
    { type: "to_do", content: "" },
    { type: "to_do", content: "" },
    { type: "heading_2", content: "이번 주" },
    { type: "to_do", content: "" },
    { type: "heading_2", content: "나중에" },
    { type: "to_do", content: "" },
  ]},
];

export function PageTemplatePicker({ workspaceId, parentId, onSelect, onBlank, onClose }: Props) {
  const [isCreating, setIsCreating] = useState(false);
  const createPage = trpc.page.create.useMutation();
  const { data: customTemplates } = trpc.page.listTemplates.useQuery(
    { workspaceId },
    { enabled: !!workspaceId },
  );

  const handleSelectTemplate = async (template: typeof BUILT_IN_TEMPLATES[0]) => {
    if (isCreating) return;
    if (template.id === "blank") {
      onBlank();
      return;
    }

    setIsCreating(true);
    try {
      const page = await createPage.mutateAsync({
        workspaceId,
        parentId,
        title: template.name,
        icon: template.icon,
      });
      onSelect(page.id, template.blocks);
    } catch {
      // error handled by trpc
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelectCustomTemplate = (templateId: string) => {
    onSelect(templateId, []);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0"
        style={{ zIndex: "var(--z-command-palette)", backgroundColor: "rgba(15, 15, 15, 0.6)" }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="fixed left-1/2 -translate-x-1/2 w-full max-w-[640px] rounded-lg overflow-hidden"
        style={{
          top: "max(10vh, 60px)",
          zIndex: "calc(var(--z-command-palette) + 1)",
          backgroundColor: "var(--bg-primary)",
          boxShadow: "var(--shadow-popup)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: "var(--border-default)" }}
        >
          <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)" }}>
            템플릿 선택
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-notion-bg-hover"
            style={{ color: "var(--text-tertiary)" }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Template Grid */}
        <div className="p-5 max-h-[60vh] overflow-y-auto">
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: "repeat(3, 1fr)" }}
          >
            {BUILT_IN_TEMPLATES.map((template) => (
              <button
                key={template.id}
                onClick={() => handleSelectTemplate(template)}
                disabled={isCreating}
                className="flex flex-col items-center gap-2 p-4 rounded-lg border text-center hover:bg-notion-bg-hover transition-colors cursor-pointer"
                style={{
                  borderColor: "var(--border-default)",
                  opacity: isCreating ? 0.6 : 1,
                }}
              >
                <span style={{ fontSize: "28px" }}>{template.icon}</span>
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "var(--text-primary)",
                  }}
                >
                  {template.name}
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    color: "var(--text-tertiary)",
                    lineHeight: "1.4",
                  }}
                >
                  {template.description}
                </span>
              </button>
            ))}
          </div>

          {/* Custom templates */}
          {customTemplates && customTemplates.length > 0 && (
            <>
              <div
                className="mt-5 mb-3"
                style={{
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "var(--text-tertiary)",
                  letterSpacing: "0.02em",
                }}
              >
                내 템플릿
              </div>
              <div
                className="grid gap-3"
                style={{ gridTemplateColumns: "repeat(3, 1fr)" }}
              >
                {customTemplates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleSelectCustomTemplate(template.id)}
                    className="flex flex-col items-center gap-2 p-4 rounded-lg border text-center hover:bg-notion-bg-hover transition-colors cursor-pointer"
                    style={{ borderColor: "var(--border-default)" }}
                  >
                    <span style={{ fontSize: "28px" }}>{template.icon || "📄"}</span>
                    <span
                      style={{
                        fontSize: "13px",
                        fontWeight: 500,
                        color: "var(--text-primary)",
                      }}
                    >
                      {template.title || "제목 없음"}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
