"use client";

import type { ReactNode } from "react";

export function MainContentShell({ children }: { children: ReactNode }) {
  return (
    <main
      id="main-content"
      role="main"
      aria-label="워크스페이스 콘텐츠"
      className="flex min-w-0 flex-1 flex-col overflow-hidden"
    >
      {children}
    </main>
  );
}
