"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle, X } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { useReturnFocus } from "@/hooks/useReturnFocus";
import { Button, type ButtonVariant } from "./Button";

/**
 * Radix Dialog handles focus trapping, restore-on-close, `aria-modal` and the
 * Escape key. Those are the parts that are genuinely hard to get right, and
 * the reason this is the one place a primitive library earns its weight.
 */

const SIZES = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
} as const;

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  size?: keyof typeof SIZES;
  /** Buttons pinned to the bottom bar. */
  footer?: ReactNode;
  /** Hide the × — for flows that must be resolved by an explicit choice. */
  hideCloseButton?: boolean;
  /** Block Escape and outside-click, e.g. while a sale is being processed. */
  dismissible?: boolean;
  children: ReactNode;
  className?: string;
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  size = "md",
  footer,
  hideCloseButton = false,
  dismissible = true,
  children,
  className,
}: ModalProps) {
  useReturnFocus(open);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-neutral-950/40" />
        <Dialog.Content
          onEscapeKeyDown={(event) => !dismissible && event.preventDefault()}
          onPointerDownOutside={(event) =>
            !dismissible && event.preventDefault()
          }
          onInteractOutside={(event) => !dismissible && event.preventDefault()}
          className={cn(
            "fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-3rem)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col",
            "rounded-lg bg-white shadow-overlay focus:outline-none",
            SIZES[size],
            className,
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
            {!hideCloseButton && (
              <Dialog.Close
                aria-label="Close"
                className="-mr-1 -mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
              >
                <X className="size-4" />
              </Dialog.Close>
            )}
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

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** What will happen, in plain language. */
  message: ReactNode;
  /** An extra consequence worth calling out, e.g. the audit-trail notice. */
  warning?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: ButtonVariant;
  loading?: boolean;
  onConfirm: () => void;
}

/**
 * The only confirmation mechanism in the application. `window.confirm` is
 * never used — it cannot be styled, cannot carry a warning, and blocks the UI.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  message,
  warning,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmVariant = "primary",
  loading = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      size="sm"
      dismissible={!loading}
      hideCloseButton={loading}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button variant={confirmVariant} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-base text-neutral-700">
        <div>{message}</div>
        {warning && (
          <div className="flex items-start gap-2 rounded-md bg-warning-50 px-3 py-2.5 text-meta text-warning-800 ring-1 ring-inset ring-warning-200">
            <AlertTriangle className="mt-px size-4 shrink-0" aria-hidden />
            <span>{warning}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}

