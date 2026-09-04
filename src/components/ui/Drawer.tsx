"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { useReturnFocus } from "@/hooks/useReturnFocus";

/**
 * A side panel for detail that would interrupt too much as a modal — an audit
 * entry read while scanning the list, for instance.
 *
 * Built on Radix Dialog, so it inherits the focus trap, restore-on-close and
 * Escape handling a hand-rolled panel usually forgets.
 */
export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  footer,
  width = "md",
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  footer?: ReactNode;
  width?: "sm" | "md" | "lg";
  children: ReactNode;
}) {
  useReturnFocus(open);

  const widthClass = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-xl",
  }[width];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-neutral-950/30" />
        <Dialog.Content
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white shadow-overlay focus:outline-none",
            widthClass,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-neutral-200 px-5 py-3.5">
            <div className="flex min-w-0 flex-col gap-0.5">
              <Dialog.Title className="text-section font-semibold text-neutral-900">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="text-meta text-neutral-500">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close
              aria-label="Close"
              className="-mr-1 -mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
            >
              <X className="size-4" />
            </Dialog.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {children}
          </div>

          {footer && (
            <div className="flex items-center justify-end gap-2 border-t border-neutral-200 bg-neutral-50 px-5 py-3">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

