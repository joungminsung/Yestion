import { redirect } from "next/navigation";
import { getServerSession } from "@/server/auth/session";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { CommandPalette } from "@/components/layout/command-palette";
import { QuickNoteButton } from "@/components/layout/quick-note-button";
import { PageTransition } from "@/components/layout/page-transition";
import { AppMotionConfig } from "@/lib/motion/motion-config";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  if (!session) redirect("/login");

  return (
    <div className="flex h-screen" style={{ backgroundColor: "var(--bg-primary)" }}>
      <Sidebar />
      <main id="main-content" role="main" aria-label="페이지 콘텐츠" className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar />
        <AppMotionConfig>
          <PageTransition>{children}</PageTransition>
        </AppMotionConfig>
      </main>
      <CommandPalette />
      <QuickNoteButton />
    </div>
  );
}
