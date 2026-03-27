"use client";

import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { trpc } from "@/server/trpc/client";
import superjson from "superjson";
import { ToastContainer } from "@/components/ui/toast-container";
import { ShortcutsProvider } from "@/components/shortcuts-provider";
import { ScrollToTop } from "@/components/ui/scroll-to-top";
import { ShortcutsHelpModal } from "@/components/shortcuts-help-modal";
import { QuickActions } from "@/components/quick-actions";
import { useToastStore } from "@/stores/toast";

function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const addToast = useToastStore((s) => s.addToast);

  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => {
      setIsOffline(false);
      addToast({ message: "다시 연결됨", type: "success" });
    };
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [addToast]);

  if (!isOffline) return null;
  return (
    <div
      className="fixed top-0 left-0 right-0 z-[999] px-4 py-2 text-center text-sm"
      style={{
        backgroundColor: "var(--color-yellow-bg, #fef3c7)",
        color: "var(--color-orange, #d97706)",
      }}
    >
      오프라인 상태입니다. 연결이 복원되면 자동으로 동기화됩니다.
    </div>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          mutations: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onError: (error: any) => {
              const message = error?.message || "요청에 실패했습니다";
              useToastStore.getState().addToast({ message, type: "error" });
            },
          },
          queries: {
            retry: 1,
            staleTime: 30000,
          },
        },
      })
  );
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: "/api/trpc",
          transformer: superjson,
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <OfflineBanner />
        <ShortcutsProvider>{children}</ShortcutsProvider>
        <ToastContainer />
        <ScrollToTop />
        <ShortcutsHelpModal />
        <QuickActions />
      </QueryClientProvider>
    </trpc.Provider>
  );
}
