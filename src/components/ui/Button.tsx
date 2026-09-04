"use client";

import { Slot, Slottable } from "@radix-ui/react-slot";
import { Loader2 } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

import { cn } from "@/lib/cn";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "subtle";

export type ButtonSize = "sm" | "md" | "lg" | "xl";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-primary-700 text-white hover:bg-primary-800 active:bg-primary-900 disabled:bg-primary-700",
  secondary:
    "bg-white text-neutral-800 ring-1 ring-inset ring-neutral-300 hover:bg-neutral-50 active:bg-neutral-100",
  ghost:
    "bg-transparent text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200",
  danger:
    "bg-danger-600 text-white hover:bg-danger-700 active:bg-danger-800 disabled:bg-danger-600",
  subtle:
    "bg-neutral-100 text-neutral-800 hover:bg-neutral-200 active:bg-neutral-300",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-control-sm px-2.5 text-sm gap-1.5",
  md: "h-control px-3.5 text-base gap-2",
  lg: "h-control-lg px-5 text-base gap-2",
  xl: "h-control-xl px-6 text-section font-semibold gap-2.5",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and blocks interaction. */
  loading?: boolean;
  /** Render as the single child element instead of a <button> (e.g. a Link). */
  asChild?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "secondary",
      size = "md",
      loading = false,
      asChild = false,
      leadingIcon,
      trailingIcon,
      fullWidth = false,
      className,
      children,
      disabled,
      type,
      ...props
    },
    ref,
  ) {
    const buttonClass = cn(
      "inline-flex shrink-0 select-none items-center justify-center rounded-md font-medium",
      "transition-colors duration-100",
      "disabled:cursor-not-allowed disabled:opacity-55",
      fullWidth && "w-full",
      VARIANTS[variant],
      SIZES[size],
      className,
    );

    const leading = loading ? (
      <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
    ) : (
      leadingIcon
    );

    if (asChild) {
      // Slot merges onto exactly one element child, so the icons are marked
      // as siblings of a `Slottable` — Radix then renders them *inside* the
      // slotted element (typically a Next `<Link>`).
      return (
        <Slot
          ref={ref}
          aria-busy={loading || undefined}
          className={buttonClass}
          {...props}
        >
          {leading}
          <Slottable>{children}</Slottable>
          {!loading && trailingIcon}
        </Slot>
      );
    }

    return (
      <button
        ref={ref}
        // A button inside a form defaults to submit; that surprises people, so
        // be explicit unless the caller asks otherwise.
        type={type ?? "button"}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={buttonClass}
        {...props}
      >
        {leading}
        {children}
        {!loading && trailingIcon}
      </button>
    );
  },
);

export interface IconButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: Exclude<ButtonSize, "xl">;
  /** Required — icon-only controls must still be announced. */
  label: string;
}

const ICON_SIZES: Record<Exclude<ButtonSize, "xl">, string> = {
  sm: "size-8",
  md: "size-control",
  lg: "size-control-lg",
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    { variant = "ghost", size = "md", label, className, children, ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type="button"
        aria-label={label}
        title={label}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-md",
          "transition-colors duration-100",
          "disabled:cursor-not-allowed disabled:opacity-55",
          VARIANTS[variant],
          ICON_SIZES[size],
          className,
        )}
        {...props}
      >
        {children}
      </button>
    );
  },
);
