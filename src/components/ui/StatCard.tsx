import { TrendingDown, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import type { Tone } from "@/lib/status";
import { Skeleton } from "./Skeleton";

/**
 * A single figure with its label and one line of context.
 *
 * Colour is applied sparingly and only when it carries meaning: a card takes
 * an accent when it represents something needing attention AND the value is
 * non-zero. Zero problems is good news and should look calm, not green.
 */

const ACCENTS: Record<Tone, string> = {
  neutral: "",
  primary: "before:bg-primary-600",
  success: "before:bg-success-600",
  warning: "before:bg-warning-500",
  "warning-muted": "before:bg-warning-400",
  danger: "before:bg-danger-500",
  "danger-solid": "before:bg-danger-600",
  info: "before:bg-info-500",
};

const VALUE_TONES: Record<Tone, string> = {
  neutral: "text-neutral-900",
  primary: "text-neutral-900",
  success: "text-neutral-900",
  warning: "text-warning-700",
  "warning-muted": "text-warning-600",
  danger: "text-danger-700",
  "danger-solid": "text-danger-700",
  info: "text-info-700",
};

export interface StatCardProps {
  label: string;
  value: ReactNode;
  /** One short line under the value. */
  context?: ReactNode;
  icon?: ReactNode;
  /** Applied only when `accent` is true, so a healthy zero stays neutral. */
  tone?: Tone;
  accent?: boolean;
  size?: "md" | "sm";
  action?: ReactNode;
  className?: string;
}

export function StatCard({
  label,
  value,
  context,
  icon,
  tone = "neutral",
  accent = false,
  size = "md",
  action,
  className,
}: StatCardProps) {
  const active = accent && tone !== "neutral";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-card",
        // A 3px rail on the leading edge, only when the card matters.
        active &&
          cn(
            "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:content-['']",
            ACCENTS[tone],
          ),
        size === "md" ? "p-4" : "px-3.5 py-3",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-micro font-semibold uppercase tracking-wide text-neutral-400">
          {label}
        </p>
        {icon && (
          <span className="shrink-0 text-neutral-300" aria-hidden>
            {icon}
          </span>
        )}
      </div>

      <p
        className={cn(
          "num mt-1.5 font-semibold tabular-nums",
          size === "md" ? "text-stat" : "text-title",
          active ? VALUE_TONES[tone] : "text-neutral-900",
        )}
      >
        {value}
      </p>

      {context && (
        <div className="mt-1 text-meta text-neutral-500">{context}</div>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Percentage movement against a previous period. */
export function TrendIndicator({
  percent,
  label,
}: {
  percent: number | null;
  label: string;
}) {
  if (percent === null) {
    return <span className="text-neutral-400">No comparison available</span>;
  }

  const rising = percent >= 0;
  const Icon = rising ? TrendingUp : TrendingDown;

  return (
    <span className="inline-flex items-center gap-1">
      <Icon
        className={cn(
          "size-3.5 shrink-0",
          rising ? "text-success-600" : "text-danger-500",
        )}
        aria-hidden
      />
      <span
        className={cn(
          "num font-medium",
          rising ? "text-success-700" : "text-danger-600",
        )}
      >
        {rising ? "+" : "−"}
        {Math.abs(percent).toFixed(1)}%
      </span>
      <span className="text-neutral-500">{label}</span>
    </span>
  );
}

export function StatCardSkeleton({ size = "md" }: { size?: "md" | "sm" }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-neutral-200 bg-white shadow-card",
        size === "md" ? "p-4" : "px-3.5 py-3",
      )}
    >
      <Skeleton className="h-2.5 w-20" />
      <Skeleton className={cn("mt-3", size === "md" ? "h-7 w-28" : "h-5 w-20")} />
      <Skeleton className="mt-2.5 h-3 w-24" />
    </div>
  );
}
