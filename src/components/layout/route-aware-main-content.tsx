"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { MainContentShell } from "./main-content-shell";
import { Topbar } from "./topbar";
import { TabBar } from "./tab-bar";
import { SplitView } from "./split-view";
import { PageTransition } from "./page-transition";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { AppMotionConfig } from "@/lib/motion/motion-config";

function isChannelRoute(pathname: string) {
  return /^\/[^/]+\/channels\/[^/]+(?:\/|$)/.test(pathname);
}

export function RouteAwareMainContent({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const isChannelSurface = isChannelRoute(pathname);

  return (
    <MainContentShell>
      {!isChannelSurface && <Topbar />}
      {!isChannelSurface && <TabBar />}
      <ErrorBoundary fallbackMessage="페이지를 불러오는 중 문제가 발생했습니다">
        <SplitView>
          <AppMotionConfig>
            <PageTransition isChannel={isChannelSurface}>{children}</PageTransition>
          </AppMotionConfig>
        </SplitView>
      </ErrorBoundary>
    </MainContentShell>
  );
}
