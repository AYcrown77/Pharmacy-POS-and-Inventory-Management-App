import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import type { Tone } from "@/lib/status";

/**
 * Badges always carry a word, never colour alone — the accessibility rule
 * from the brief, and the reason status stays readable in a photocopy.
 */

const TONES: Record<Tone, string> = {
  neutral: "bg-neutral-100 text-neutral-700 ring-neutral-200",
  primary: "bg-primary-50 text-primary-800 ring-primary-200",
  success: "bg-success-50 text-success-800 ring-success-200",
  warning: "bg-warning-50 text-warning-800 ring-warning-200",
  "warning-muted": "bg-white text-warning-700 ring-warning-300",
  danger: "bg-danger-50 text-danger-700 ring-danger-200",
  "danger-solid": "bg-danger-600 text-white ring-danger-700",
  info: "bg-info-50 text-info-700 ring-info-200",
};

const DOT_TONES: Record<Tone, string> = {
  neutral: "bg-neutral-400",
  primary: "bg-primary-600",
  success: "bg-success-600",
  warning: "bg-warning-500",
  "warning-muted": "bg-warning-400",
  danger: "bg-danger-500",
  "danger-solid": "bg-white",
  info: "bg-info-500",
};

export interface BadgeProps {
  tone?: Tone;
  size?: "sm" | "md";
  /** Adds a leading status dot — useful in dense tables. */
  dot?: boolean;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Badge({
  tone = "neutral",
  size = "md",
  dot = false,
  icon,
  className,
  children,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm font-medium ring-1 ring-inset",
        size === "sm" ? "px-1.5 py-0.5 text-micro" : "px-2 py-0.5 text-meta",
        TONES[tone],
        className,
      )}
    >
      {dot && (
        <span
          className={cn("size-1.5 shrink-0 rounded-full", DOT_TONES[tone])}
          aria-hidden
        />
      )}
      {icon}
      {children}
    </span>
  );
}

/** A bare coloured dot with an accessible label, for the tightest columns. */
export function StatusDot({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn("size-2 shrink-0 rounded-full", DOT_TONES[tone])}
        aria-hidden
      />
      <span className="text-meta text-neutral-600">{label}</span>
    </span>
  );
}
