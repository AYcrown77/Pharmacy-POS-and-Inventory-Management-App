"use client";

import type { ReactNode } from "react";

import { TooltipProvider } from "@/components/ui/Tooltip";
import { ToastProvider } from "@/components/ui/Toast";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { QueryProvider } from "@/lib/query/QueryProvider";

/**
 * Client providers, mounted once at the root.
 *
 * Order matters: Auth depends on Query (the session is itself a query), and
 * everything below may raise a toast.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <AuthProvider>
        <TooltipProvider delayDuration={300} skipDelayDuration={200}>
          <ToastProvider>{children}</ToastProvider>
        </TooltipProvider>
      </AuthProvider>
    </QueryProvider>
  );
}
