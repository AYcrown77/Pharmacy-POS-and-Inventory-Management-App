"use client";

import { AlertCircle } from "lucide-react";
import { useId, type ReactNode } from "react";

import { cn } from "@/lib/cn";

export interface FormFieldProps {
  label: string;
  /** Guidance shown under the control while it is valid. */
  hint?: string;
  error?: string;
  required?: boolean;
  /** Hides the visual label but keeps it for screen readers. */
  hideLabel?: boolean;
  className?: string;
  /** Receives the ids to wire up label, hint and error associations. */
  children: (ids: {
    id: string;
    "aria-describedby": string | undefined;
    "aria-invalid": true | undefined;
  }) => ReactNode;
}

/**
 * Label + control + hint/error, wired together with the right ARIA.
 *
 * Every form control in the application goes through this, so associations
 * and error announcement cannot be forgotten one field at a time.
 */
export function FormField({
  label,
  hint,
  error,
  required,
  hideLabel,
  className,
  children,
}: FormFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const describedBy =
    [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label
        htmlFor={id}
        className={cn(
          "text-meta font-medium text-neutral-700",
          hideLabel && "sr-only",
        )}
      >
        {label}
        {required && (
          <span className="ml-0.5 text-danger-600" aria-hidden>
            *
          </span>
        )}
        {required && <span className="sr-only"> (required)</span>}
      </label>

      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
      })}

      {error ? (
        <p
          id={errorId}
          role="alert"
          className="flex items-start gap-1 text-meta text-danger-700"
        >
          <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-meta text-neutral-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Groups related fields under a heading, keeping long forms scannable. */
export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-col gap-0.5">
        <h3 className="text-section font-semibold text-neutral-900">{title}</h3>
        {description && (
          <p className="text-meta text-neutral-500">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

/** Standard responsive grid for form fields — two columns on wider screens. */
export function FormGrid({
  columns = 2,
  children,
  className,
}: {
  columns?: 1 | 2 | 3;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-4",
        columns === 1 && "grid-cols-1",
        columns === 2 && "grid-cols-1 sm:grid-cols-2",
        columns === 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
        className,
      )}
    >
      {children}
    </div>
  );
}
