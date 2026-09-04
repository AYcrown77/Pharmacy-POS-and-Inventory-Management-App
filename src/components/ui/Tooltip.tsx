"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export const TooltipProvider = TooltipPrimitive.Provider;

export function Tooltip({
  content,
  side = "top",
  align = "center",
  delayDuration = 250,
  children,
  className,
}: {
  content: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  delayDuration?: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <TooltipPrimitive.Root delayDuration={delayDuration}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          align={align}
          sideOffset={6}
          className={cn(
            "z-50 max-w-xs rounded-md bg-neutral-900 px-2.5 py-1.5 text-meta text-white shadow-overlay",
            className,
          )}
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-neutral-900" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

/** A styled keyboard hint, e.g. F2 or Ctrl. */
export function KeyHint({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <kbd
      className={cn(
        "num inline-flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-sm border border-neutral-300 bg-neutral-50 px-1 font-sans text-micro font-medium text-neutral-500",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
