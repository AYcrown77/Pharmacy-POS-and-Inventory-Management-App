"use client";

import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";
import { useNow } from "@/hooks/useNow";
import { useServerStatus, type ServerStatus } from "@/hooks/useServerStatus";
import { useTerminal } from "@/hooks/useTerminal";
import { useAuth } from "@/lib/auth/AuthProvider";
import { ROLE_LABELS } from "@/lib/status";
import { Tooltip } from "@/components/ui/Tooltip";
import { titleForRoute } from "./navigation";

export function Topbar({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { terminal } = useTerminal();

  return (
    <header
      data-print-hidden
      className={cn(
        "flex shrink-0 items-center justify-between gap-4 border-b border-neutral-200 bg-white px-4",
        compact ? "h-topbar-compact" : "h-topbar",
      )}
    >
      {/* Chrome, not a heading — the page body owns the document's <h1>. */}
      <p className="truncate text-section font-semibold text-neutral-900">
        {titleForRoute(pathname)}
      </p>

      <div className="flex shrink-0 items-center gap-3">
        <Clock />
        <span className="h-4 w-px bg-neutral-200" aria-hidden />
        <ServerStatusIndicator />
        <span className="h-4 w-px bg-neutral-200" aria-hidden />

        <Tooltip content={`${terminal.name} · ${terminal.location}`}>
          <span className="num rounded-sm bg-neutral-100 px-2 py-1 text-micro font-semibold text-neutral-600">
            {terminal.shortName}
          </span>
        </Tooltip>

        {user && (
          <span className="hidden items-center gap-2 md:flex">
            <span className="flex flex-col items-end leading-tight">
              <span className="text-meta font-medium text-neutral-800">
                {user.name}
              </span>
              <span className="text-micro text-neutral-500">
                {ROLE_LABELS[user.role]}
              </span>
            </span>
          </span>
        )}
      </div>
    </header>
  );
}

const STATUS_COPY: Record<
  ServerStatus,
  { label: string; dot: string; text: string; detail: string }
> = {
  connected: {
    label: "Server Connected",
    dot: "bg-success-500",
    text: "text-success-700",
    detail: "The pharmacy server is responding normally.",
  },
  connecting: {
    label: "Connecting…",
    dot: "bg-warning-400 animate-pulse",
    text: "text-warning-700",
    detail: "Contacting the pharmacy server.",
  },
  unreachable: {
    label: "Server Unreachable",
    dot: "bg-danger-500",
    text: "text-danger-700",
    detail:
      "The pharmacy server is not responding. Check the network cable and that the server is powered on.",
  },
};

/**
 * Reports the LAN server only. It never says "No Internet" — this system is
 * designed to run without any internet connection at all.
 */
export function ServerStatusIndicator() {
  const { status } = useServerStatus();
  const copy = STATUS_COPY[status];

  return (
    <Tooltip content={copy.detail}>
      <span
        role="status"
        className={cn("flex items-center gap-1.5 text-meta font-medium", copy.text)}
      >
        <span className={cn("size-2 shrink-0 rounded-full", copy.dot)} aria-hidden />
        <span className="hidden lg:inline">{copy.label}</span>
      </span>
    </Tooltip>
  );
}

function Clock() {
  // Null until hydration — the server cannot know the till's local time.
  const now = useNow();

  if (!now) {
    return <span className="num w-[8.5rem] text-meta text-neutral-500" />;
  }

  return (
    <time
      dateTime={now.toISOString()}
      className="num hidden text-meta text-neutral-500 sm:inline"
    >
      {new Intl.DateTimeFormat("en-GB", {
        weekday: "short",
        day: "2-digit",
        month: "short",
      }).format(now)}
      {" · "}
      {new Intl.DateTimeFormat("en-GB", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(now)}
    </time>
  );
}
