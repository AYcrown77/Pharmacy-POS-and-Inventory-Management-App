import { Loader2 } from "lucide-react";

import { cn } from "@/lib/cn";

export function Spinner({
  className,
  label,
}: {
  className?: string;
  /** Announce the wait when the spinner is the only indication of it. */
  label?: string;
}) {
  return (
    <>
      <Loader2
        className={cn("size-4 animate-spin text-neutral-400", className)}
        aria-hidden
      />
      {label && (
        <span className="sr-only" role="status">
          {label}
        </span>
      )}
    </>
  );
}
