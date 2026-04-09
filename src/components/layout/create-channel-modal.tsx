"use client";

import { useState } from "react";

type CreateChannelModalProps = {
  scopeLabel: string;
  onClose: () => void;
  onCreate: (input: {
    name: string;
    description?: string;
    type: "text" | "voice";
  }) => void;
};

export function CreateChannelModal({
  scopeLabel,
  onClose,
  onCreate,
}: CreateChannelModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"text" | "voice">("text");

  return (
    <>
      <div className="fixed inset-0 z-[120] bg-black/40" onClick={onClose} />
      <div className="fixed inset-0 z-[121] flex items-center justify-center px-4">
        <div
          className="w-full max-w-md rounded-2xl border p-5 shadow-2xl"
          style={{
            backgroundColor: "var(--bg-primary)",
            borderColor: "var(--border-default)",
          }}
        >
          <div className="mb-4">
            <p className="text-xs uppercase tracking-[0.18em]" style={{ color: "var(--text-tertiary)" }}>
              Collaboration
            </p>
            <h2 className="mt-1 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
              새 채널 만들기
            </h2>
            <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
              {scopeLabel} 안에 텍스트 채널이나 음성방을 추가합니다.
            </p>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm" style={{ color: "var(--text-primary)" }}>
                채널 이름
              </span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="예: 프로젝트-상황공유"
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                style={{
                  borderColor: "var(--border-default)",
                  backgroundColor: "var(--bg-secondary)",
                  color: "var(--text-primary)",
                }}
                autoFocus
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm" style={{ color: "var(--text-primary)" }}>
                설명
              </span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="이 채널에서 어떤 대화를 나눌지 적어주세요"
                rows={3}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                style={{
                  borderColor: "var(--border-default)",
                  backgroundColor: "var(--bg-secondary)",
                  color: "var(--text-primary)",
                  resize: "none",
                }}
              />
            </label>

            <div>
              <span className="mb-1.5 block text-sm" style={{ color: "var(--text-primary)" }}>
                채널 타입
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setType("text")}
                  className="rounded-lg border px-3 py-2 text-left transition-colors"
                  style={{
                    borderColor: type === "text" ? "#2383e2" : "var(--border-default)",
                    backgroundColor: type === "text" ? "rgba(35, 131, 226, 0.08)" : "var(--bg-secondary)",
                    color: "var(--text-primary)",
                  }}
                >
                  <div className="text-sm font-medium">텍스트 채널</div>
                  <div className="mt-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
                    문맥이 남는 대화, 링크, 조사 메모
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setType("voice")}
                  className="rounded-lg border px-3 py-2 text-left transition-colors"
                  style={{
                    borderColor: type === "voice" ? "#2383e2" : "var(--border-default)",
                    backgroundColor: type === "voice" ? "rgba(35, 131, 226, 0.08)" : "var(--bg-secondary)",
                    color: "var(--text-primary)",
                  }}
                >
                  <div className="text-sm font-medium">음성 채널</div>
                  <div className="mt-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
                    음성, 화면공유, 공동 브라우징 허브
                  </div>
                </button>
              </div>
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={onClose}
              className="rounded-lg px-3 py-2 text-sm"
              style={{ color: "var(--text-secondary)" }}
            >
              취소
            </button>
            <button
              onClick={() => {
                const trimmed = name.trim();
                if (!trimmed) return;
                onCreate({
                  name: trimmed,
                  description: description.trim() || undefined,
                  type,
                });
              }}
              className="rounded-lg px-3 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: "#2383e2" }}
            >
              채널 만들기
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
