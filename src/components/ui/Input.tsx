"use client";

import { Search, X } from "lucide-react";
import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";

import { cn } from "@/lib/cn";

/** Shared field chrome so every control lines up at the same height. */
export const fieldBaseClass = cn(
  "w-full rounded-md bg-white text-neutral-900",
  "ring-1 ring-inset ring-neutral-300 placeholder:text-neutral-400",
  "transition-shadow duration-100",
  "hover:ring-neutral-400",
  "focus:outline-none focus:ring-2 focus:ring-primary-500",
  "disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-500",
  "aria-[invalid=true]:ring-danger-400 aria-[invalid=true]:focus:ring-danger-500",
);

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  /** Rendered inside the field, before the text. */
  leadingIcon?: ReactNode;
  /** Rendered inside the field, after the text (e.g. a unit or clear button). */
  trailingSlot?: ReactNode;
  inputSize?: "sm" | "md" | "lg";
}

const INPUT_SIZES = {
  sm: "h-control-sm text-sm",
  md: "h-control text-base",
  lg: "h-control-lg text-section",
} as const;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    invalid,
    leadingIcon,
    trailingSlot,
    inputSize = "md",
    className,
    ...props
  },
  ref,
) {
  const field = (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        fieldBaseClass,
        INPUT_SIZES[inputSize],
        "px-3",
        leadingIcon && "pl-9",
        trailingSlot && "pr-9",
        className,
      )}
      {...props}
    />
  );

  if (!leadingIcon && !trailingSlot) return field;

  return (
    <div className="relative w-full">
      {leadingIcon && (
        <span
          className="pointer-events-none absolute inset-y-0 left-0 flex w-9 items-center justify-center text-neutral-400"
          aria-hidden
        >
          {leadingIcon}
        </span>
      )}
      {field}
      {trailingSlot && (
        <span className="absolute inset-y-0 right-0 flex w-9 items-center justify-center">
          {trailingSlot}
        </span>
      )}
    </div>
  );
});

export interface SearchInputProps extends Omit<InputProps, "leadingIcon"> {
  onClear?: () => void;
}

/** A text input pre-wired for search, with a clear affordance when filled. */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  function SearchInput({ onClear, value, ...props }, ref) {
    const hasValue = typeof value === "string" && value.length > 0;

    return (
      <Input
        ref={ref}
        type="search"
        value={value}
        leadingIcon={<Search className="size-4" />}
        trailingSlot={
          hasValue && onClear ? (
            <button
              type="button"
              onClick={onClear}
              aria-label="Clear search"
              className="flex size-5 items-center justify-center rounded-sm text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
            >
              <X className="size-3.5" />
            </button>
          ) : undefined
        }
        className="[&::-webkit-search-cancel-button]:appearance-none"
        {...props}
      />
    );
  },
);

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ invalid, className, rows = 3, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        rows={rows}
        aria-invalid={invalid || undefined}
        className={cn(fieldBaseClass, "resize-y px-3 py-2 text-base", className)}
        {...props}
      />
    );
  },
);

/**
 * Native `<select>`, styled to match. Deliberately native: it is keyboard
 * friendly, weightless, and the OS picker is faster for staff than a custom
 * listbox. Radix Select is reserved for the few places needing rich options.
 */
export interface NativeSelectProps
  extends InputHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
  selectSize?: "sm" | "md";
  children: ReactNode;
}

export const NativeSelect = forwardRef<HTMLSelectElement, NativeSelectProps>(
  function NativeSelect(
    { invalid, selectSize = "md", className, children, ...props },
    ref,
  ) {
    return (
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          fieldBaseClass,
          selectSize === "sm"
            ? "h-control-sm text-sm"
            : "h-control text-base",
          "cursor-pointer appearance-none bg-no-repeat px-3 pr-8",
          // Chevron drawn as a background image so no wrapper element is needed.
          "bg-[length:16px] bg-[position:right_0.625rem_center]",
          "bg-[image:url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2024%2024%22%20stroke-width%3D%222%22%20stroke%3D%22%236e7784%22%3E%3Cpath%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20d%3D%22m6%209%206%206%206-6%22/%3E%3C/svg%3E')]",
          className,
        )}
        {...props}
      >
        {children}
      </select>
    );
  },
);
