"use client";

import {
  QueryClient,
  QueryClientProvider,
  type QueryClientConfig,
} from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { ApiError } from "@/lib/api/http";

/**
 * Defaults tuned for a till, not a content site.
 *
 * `refetchOnWindowFocus` is off deliberately: a cashier tabbing to the receipt
 * printer dialog and back must not trigger a refetch storm mid-sale. Views
 * that genuinely need fresher data (dashboard, inventory) shorten their own
 * `staleTime`.
 */
const queryConfig: QueryClientConfig = {
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Never retry a refusal — the answer will not change.
        if (error instanceof ApiError) {
          if (error.isUnauthorized || error.isForbidden) return false;
          if (error.status >= 400 && error.status < 500) return false;
        }
        return failureCount < 1;
      },
    },
    mutations: {
      // Writes are never retried automatically: a duplicated sale is far
      // worse than an error the cashier can act on.
      retry: false,
    },
  },
};

export function QueryProvider({ children }: { children: ReactNode }) {
  // Created once per browser session — never at module scope, which would
  // share a cache across requests during server rendering.
  const [queryClient] = useState(() => new QueryClient(queryConfig));

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
