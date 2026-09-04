"use client";

import { AlertTriangle, Inbox, Lock, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { Button } from "./Button";

/**
 * The three non-happy states every data view needs. Kept together so a page
 * cannot accidentally ship one polished state and two afterthoughts.
 */

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-14 text-center",
        className,
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
        {icon ?? <Inbox className="size-5" />}
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-section font-semibold text-neutral-900">{title}</p>
        {description && (
          <p className="max-w-sm text-base text-neutral-500">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({
  title = "Could not load this data",
  description,
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-14 text-center",
        className,
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-full bg-danger-50 text-danger-600">
        <AlertTriangle className="size-5" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-section font-semibold text-neutral-900">{title}</p>
        <p className="max-w-md text-base text-neutral-500">
          {description ??
            "The server did not respond as expected. Check that the pharmacy server is reachable and try again."}
        </p>
      </div>
      {onRetry && (
        <Button
          variant="secondary"
          onClick={onRetry}
          leadingIcon={<RefreshCw className="size-4" />}
        >
          Try again
        </Button>
      )}
    </div>
  );
}

/**
 * Shown when a signed-in user opens a route their role does not permit.
 * A real explanation, not a silent redirect — staff need to know why.
 */
export function ForbiddenState({
  className,
  onGoBack,
}: {
  className?: string;
  onGoBack?: () => void;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-20 text-center",
        className,
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-full bg-warning-50 text-warning-600">
        <Lock className="size-5" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-section font-semibold text-neutral-900">
          You do not have access to this page
        </p>
        <p className="max-w-md text-base text-neutral-500">
          Your role does not include permission for this area. If you need
          access, ask an administrator to review your account.
        </p>
      </div>
      {onGoBack && (
        <Button variant="secondary" onClick={onGoBack}>
          Go back
        </Button>
      )}
    </div>
  );
}
