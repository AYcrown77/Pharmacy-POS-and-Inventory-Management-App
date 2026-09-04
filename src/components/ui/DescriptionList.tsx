import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Label/value pairs for detail views. Values that are genuinely absent render
 * an em dash rather than an empty gap, so a blank field is never mistaken for
 * a rendering fault.
 */

export interface DescriptionItem {
  label: string;
  value: ReactNode;
  /** Spans the full width — for addresses and notes. */
  wide?: boolean;
}

export function DescriptionList({
  items,
  columns = 2,
  className,
}: {
  items: DescriptionItem[];
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "grid gap-x-6 gap-y-4",
        columns === 1 && "grid-cols-1",
        columns === 2 && "grid-cols-1 sm:grid-cols-2",
        columns === 3 && "grid-cols-2 lg:grid-cols-3",
        columns === 4 && "grid-cols-2 lg:grid-cols-4",
        className,
      )}
    >
      {items.map((item) => (
        <div
          key={item.label}
          className={cn("flex min-w-0 flex-col gap-0.5", item.wide && "col-span-full")}
        >
          <dt className="text-micro font-semibold uppercase tracking-wide text-neutral-400">
            {item.label}
          </dt>
          <dd className="text-base text-neutral-900">
            {item.value ?? <span className="text-neutral-300">—</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
