"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/Skeleton";

/**
 * The till is mounted client-only.
 *
 * It restores a cart draft from `sessionStorage` during its first render,
 * which has no server equivalent — rendering it on the server would either
 * crash or hydrate into a mismatch. Skipping SSR also saves work on the
 * budget PCs these terminals run on, and the screen has no SEO value.
 */
const PosTerminal = dynamic(
  () => import("./PosTerminal").then((m) => m.PosTerminal),
  { ssr: false, loading: () => <PosSkeleton /> },
);

export function PosPage() {
  return <PosTerminal />;
}

function PosSkeleton() {
  return (
    <div className="flex h-full min-h-0" role="status" aria-label="Loading the till">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-neutral-200 bg-white px-4 py-3">
          <Skeleton className="h-11 w-full rounded-md" />
        </div>
        <div className="flex-1 p-4">
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
      <div className="w-pos-panel shrink-0 border-l border-neutral-200 bg-white p-4">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="mt-6 h-10 w-full" />
        <Skeleton className="mt-3 h-10 w-full" />
      </div>
    </div>
  );
}
