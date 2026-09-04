"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Shared shell for the dashboard's list panels.
 *
 * Every panel resolves its own four states here, so no panel can ship with a
 * polished loaded view and an afterthought for the rest.
 */
export function DashboardPanel({
  title,
  description,
  href,
  linkLabel = "View all",
  isLoading,
  isError,
  onRetry,
  isEmpty,
  emptyTitle,
  emptyDescription,
  emptyIcon,
  skeletonRows = 5,
  children,
  className,
}: {
  title: string;
  description?: string;
  href?: string;
  linkLabel?: string;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: ReactNode;
  skeletonRows?: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader
        title={title}
        description={description}
        actions={
          href && (
            <Link
              href={href}
              className="inline-flex items-center gap-1 rounded-sm text-meta font-medium text-primary-700 hover:text-primary-800 hover:underline"
            >
              {linkLabel}
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          )
        }
      />

      {isError ? (
        <ErrorState onRetry={onRetry} className="py-10" />
      ) : isLoading ? (
        <div className="flex flex-col gap-3 p-4">
          {Array.from({ length: skeletonRows }, (_, index) => (
            <div key={index} className="flex items-center gap-3">
              <Skeleton className="h-3.5 flex-1" />
              <Skeleton className="h-3.5 w-16" />
            </div>
          ))}
        </div>
      ) : isEmpty ? (
        <EmptyState
          icon={emptyIcon}
          title={emptyTitle ?? "Nothing to show"}
          description={emptyDescription}
          className="py-10"
        />
      ) : (
        children
      )}
    </Card>
  );
}

/** Consistent row for the dashboard list panels. */
export function PanelRow({
  href,
  children,
  className,
}: {
  href?: string;
  children: ReactNode;
  className?: string;
}) {
  const content = (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-2.5 text-base",
        href && "transition-colors hover:bg-primary-50/40",
        className,
      )}
    >
      {children}
    </div>
  );

  if (!href) return <div className="border-b border-neutral-100 last:border-b-0">{content}</div>;

  return (
    <Link
      href={href}
      className="block border-b border-neutral-100 last:border-b-0"
    >
      {content}
    </Link>
  );
}
