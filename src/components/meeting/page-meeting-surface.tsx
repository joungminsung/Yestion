"use client";

import { MeetingLiveView } from "./meeting-live-view";

export function PageMeetingSurface({ pageId }: { pageId: string }) {
  return (
    <div className="mb-6">
      <MeetingLiveView pageId={pageId} variant="inline" hideWhenDisabled />
    </div>
  );
}
