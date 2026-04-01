"use client";

import { useEffect } from "react";
import { addRecentPage } from "./sidebar-recent";

export function TrackRecentPage({ pageId }: { pageId: string }) {
  useEffect(() => {
    addRecentPage(pageId);
  }, [pageId]);
  return null;
}
