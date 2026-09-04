import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export interface Breadcrumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: Breadcrumb[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex items-center gap-1 text-meta text-neutral-500">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1">
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="rounded-sm hover:text-neutral-800 hover:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={cn(isLast && "font-medium text-neutral-700")}
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
              {!isLast && (
                <ChevronRight className="size-3.5 text-neutral-300" aria-hidden />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function PageHeader({
  title,
  titleHidden = false,
  description,
  breadcrumbs,
  actions,
  className,
}: {
  title: string;
  /**
   * Keeps the `<h1>` for screen readers but hides it visually. Use on index
   * pages, where the top bar already names the route — printing the same word
   * twice wastes a line of a screen that has 768px to work with.
   */
  titleHidden?: boolean;
  description?: string;
  breadcrumbs?: Breadcrumb[];
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex flex-col gap-1">
          <h1
            className={cn(
              titleHidden
                ? "sr-only"
                : "text-title font-semibold tracking-tight text-neutral-900",
            )}
          >
            {title}
          </h1>
          {description && (
            <p className="text-base text-neutral-500">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        )}
      </div>
    </div>
  );
}

export function SectionHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("flex items-end justify-between gap-3 pb-1", className)}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 className="text-section font-semibold text-neutral-900">{title}</h2>
        {description && (
          <p className="text-meta text-neutral-500">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

/** Consistent vertical rhythm for every page body. */
export function PageContainer({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-5 p-6", className)}>{children}</div>
  );
}
