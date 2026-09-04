import { cn } from "@/lib/cn";

/**
 * Loading placeholders shaped like the content they replace, so the layout
 * does not jump when data lands. Never a bare "Loading…".
 */

export function Skeleton({
  className,
  style,
}: {
  className?: string;
  /** For data-shaped dimensions that cannot come from a token. */
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={cn("animate-pulse rounded-sm bg-neutral-200", className)}
      style={style}
      aria-hidden
    />
  );
}

export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          className={cn("h-3.5", index === lines - 1 ? "w-2/3" : "w-full")}
        />
      ))}
    </div>
  );
}

/** Table body placeholder matching the real row height and column count. */
export function SkeletonTable({
  rows = 8,
  columns = 5,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div role="status" aria-label="Loading data">
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div
          key={rowIndex}
          className="flex h-11 items-center gap-4 border-b border-neutral-100 px-4"
        >
          {Array.from({ length: columns }, (_, columnIndex) => (
            <Skeleton
              key={columnIndex}
              className={cn(
                "h-3.5",
                columnIndex === 0 ? "w-[22%]" : "flex-1",
                // Vary the widths a little so it reads as content, not a grid.
                columnIndex % 3 === 2 && "max-w-[80px]",
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonStatCard() {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-card">
      <Skeleton className="h-2.5 w-20" />
      <Skeleton className="mt-3 h-7 w-28" />
      <Skeleton className="mt-2.5 h-3 w-24" />
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-neutral-200 bg-white p-4 shadow-card",
        className,
      )}
    >
      <Skeleton className="h-4 w-40" />
      <SkeletonText className="mt-4" lines={4} />
    </div>
  );
}
