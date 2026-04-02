import { redirect } from "next/navigation";
import { getServerSession } from "@/server/auth/session";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { CommandPalette } from "@/components/layout/command-palette";
import { QuickNoteButton } from "@/components/layout/quick-note-button";
import { PageTransition } from "@/components/layout/page-transition";
import { AppMotionConfig } from "@/lib/motion/motion-config";
import { TabBar } from "@/components/layout/tab-bar";
import { SplitView } from "@/components/layout/split-view";
import { OfflineBanner } from "@/components/ui/offline-banner";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  if (!session) redirect("/login");

  return (
    <div className="flex flex-col h-screen" style={{ backgroundColor: "var(--bg-primary)" }}>
      <OfflineBanner />
      <div className="flex flex-1 min-h-0">
      <Sidebar />
      <main id="main-content" role="main" aria-label="페이지 콘텐츠" className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar />
        <TabBar />
        <div className="flex-1 overflow-y-auto">
          <SplitView>
            <AppMotionConfig>
              <PageTransition>{children}</PageTransition>
            </AppMotionConfig>
          </SplitView>
        </div>
      </main>
      <CommandPalette />
      <QuickNoteButton />
      </div>
    </div>
  );
}
