"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function PageTransition({
  children,
  isChannel,
}: {
  children: ReactNode;
  isChannel?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex-1 min-w-0 min-h-0",
        isChannel
          ? "flex flex-col overflow-hidden"
          : "overflow-x-hidden overflow-y-auto",
      )}
    >
      {children}
    </div>
  );
}
