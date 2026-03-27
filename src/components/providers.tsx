"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { trpc } from "@/server/trpc/client";
import superjson from "superjson";
import { ToastContainer } from "@/components/ui/toast-container";
import { ShortcutsProvider } from "@/components/shortcuts-provider";
import { ScrollToTop } from "@/components/ui/scroll-to-top";
import { ShortcutsHelpModal } from "@/components/shortcuts-help-modal";
import { QuickActions } from "@/components/quick-actions";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
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
        <ShortcutsProvider>{children}</ShortcutsProvider>
        <ToastContainer />
        <ScrollToTop />
        <ShortcutsHelpModal />
        <QuickActions />
      </QueryClientProvider>
    </trpc.Provider>
  );
}
