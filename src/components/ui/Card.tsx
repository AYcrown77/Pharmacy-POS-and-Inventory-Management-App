import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg border border-neutral-200 bg-white shadow-card",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 border-b border-neutral-200 px-4 py-3",
        className,
      )}
    >
      <div className="min-w-0 flex flex-col gap-0.5">
        <h2 className="truncate text-section font-semibold text-neutral-900">
          {title}
        </h2>
        {description && (
          <p className="text-meta text-neutral-500">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("p-4", className)}>{children}</div>;
}

export function CardFooter({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-2 border-t border-neutral-200 bg-neutral-50 px-4 py-3",
        className,
      )}
    >
      {children}
    </div>
  );
}
