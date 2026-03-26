"use client";

import { useEffect } from "react";
import { shortcutManager } from "@/lib/shortcuts/manager";
import { useSidebarStore } from "@/stores/sidebar";
import { useCommandPaletteStore } from "@/stores/command-palette";
import { useThemeStore } from "@/stores/theme";

export function ShortcutsProvider({ children }: { children: React.ReactNode }) {
  const toggleSidebar = useSidebarStore((s) => s.toggle);
  const togglePalette = useCommandPaletteStore((s) => s.toggle);
  const { theme, setTheme } = useThemeStore();

  useEffect(() => {
    shortcutManager.register({ id: "toggle-sidebar", key: "\\", meta: true, handler: () => toggleSidebar() });
    shortcutManager.register({ id: "command-palette", key: "k", meta: true, handler: () => togglePalette() });
    shortcutManager.register({ id: "search", key: "p", meta: true, handler: () => togglePalette() });
    shortcutManager.register({
      id: "toggle-dark-mode", key: "d", meta: true, shift: true,
      handler: () => { const next = theme === "dark" ? "light" : "dark"; setTheme(next); },
    });

    const handleKeyDown = (e: KeyboardEvent) => shortcutManager.handleKeyDown(e);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      shortcutManager.unregister("toggle-sidebar");
      shortcutManager.unregister("command-palette");
      shortcutManager.unregister("search");
      shortcutManager.unregister("toggle-dark-mode");
    };
  }, [toggleSidebar, togglePalette, theme, setTheme]);

  return <>{children}</>;
}
