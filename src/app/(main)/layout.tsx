import { redirect } from "next/navigation";
import { getServerSession } from "@/server/auth/session";
import { Sidebar } from "@/components/layout/sidebar";
import { CommandPalette } from "@/components/layout/command-palette";
import { PWAInstallPrompt } from "@/components/ui/pwa-install-prompt";
import { RouteAwareMainContent } from "@/components/layout/route-aware-main-content";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  if (!session) redirect("/login");

  return (
    <div className="flex flex-col h-screen" style={{ backgroundColor: "var(--bg-primary)" }}>
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <RouteAwareMainContent>{children}</RouteAwareMainContent>
        <CommandPalette />
      </div>
      <PWAInstallPrompt />
    </div>
  );
}
