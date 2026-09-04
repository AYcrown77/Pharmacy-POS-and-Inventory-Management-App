"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/ui/States";
import { toErrorMessage } from "@/lib/api/http";

/**
 * Route-level error boundary. Catches anything a feature throws during render
 * so a single broken screen cannot take the whole till down.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // On the pharmacy server this is the only trace of a client crash.
    console.error("Unhandled error in application route:", error);
  }, [error]);

  return (
    <ErrorState
      title="This page could not be displayed"
      description={toErrorMessage(error)}
      onRetry={reset}
    />
  );
}
