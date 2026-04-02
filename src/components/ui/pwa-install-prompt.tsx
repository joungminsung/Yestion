"use client";

import { useEffect, useState, useCallback } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already dismissed in this session
    if (sessionStorage.getItem("pwa-install-dismissed")) {
      setDismissed(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show after a brief delay so it doesn't feel jarring
      setTimeout(() => setShowPrompt(true), 3000);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setShowPrompt(false);
    setDismissed(true);
    sessionStorage.setItem("pwa-install-dismissed", "1");
  }, []);

  if (!showPrompt || dismissed) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-lg shadow-lg border px-4 py-3 max-w-sm animate-in slide-in-from-bottom-4"
      style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--border-default)" }}
    >
      <div
        className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: "#2383e215" }}
      >
        <Download size={20} style={{ color: "#2383e2" }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          앱으로 설치
        </p>
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          더 빠른 접근과 오프라인 지원을 위해 설치하세요.
        </p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={handleInstall}
          className="px-3 py-1.5 rounded-md text-xs font-medium"
          style={{ backgroundColor: "#2383e2", color: "white" }}
        >
          설치
        </button>
        <button onClick={handleDismiss} className="p-1 rounded" style={{ color: "var(--text-secondary)" }}>
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
