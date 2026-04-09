"use client";

import { MeetingLiveView } from "./meeting-live-view";

export function MeetingPanel({
  pageId,
  onClose,
}: {
  pageId: string;
  onClose: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div
        className="flex items-center justify-between border-b px-4 py-3"
        style={{ borderColor: "var(--border-default)" }}
      >
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          회의 패널
        </h2>
        <button
          onClick={onClose}
          className="rounded-md px-2 py-1 text-xs"
          style={{ color: "var(--text-secondary)" }}
        >
          닫기
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        <MeetingLiveView pageId={pageId} variant="panel" />
      </div>
    </div>
  );
}
