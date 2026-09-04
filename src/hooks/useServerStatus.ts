"use client";

import { useQuery } from "@tanstack/react-query";

import { healthKeys } from "@/lib/query/keys";
import { systemService } from "@/services/system.service";

export type ServerStatus = "connected" | "connecting" | "unreachable";

/**
 * Reachability of the pharmacy server.
 *
 * Note what this deliberately does NOT do: consult `navigator.onLine`. That
 * reports internet connectivity, which is irrelevant here — the system is
 * designed to run with no internet at all. The only question that matters is
 * whether the local server answers.
 */
export function useServerStatus(): {
  status: ServerStatus;
  lastCheckedAt: number | null;
} {
  const { isSuccess, isError, isLoading, dataUpdatedAt } = useQuery({
    queryKey: healthKeys.server(),
    queryFn: () => systemService.health(),
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    retry: 1,
    staleTime: 0,
    gcTime: 0,
  });

  const status: ServerStatus = isError
    ? "unreachable"
    : isSuccess
      ? "connected"
      : isLoading
        ? "connecting"
        : "connecting";

  return {
    status,
    lastCheckedAt: dataUpdatedAt || null,
  };
}
