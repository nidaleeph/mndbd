"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { forwardRef } from "react";

export type ButtonVariant = "primary" | "secondary" | "outline" | "danger" | "ghost" | "icon";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  icon?: ReactNode;
  iconPosition?: "left" | "right";
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] focus:ring-[var(--color-primary)]",
  secondary:
    "bg-[var(--color-soft-blue-bg)] text-[var(--color-text-dark)] hover:bg-blue-100 focus:ring-[var(--color-primary)]",
  outline:
    "border-2 border-[var(--color-primary)] text-[var(--color-primary)] bg-transparent hover:bg-[var(--color-soft-blue-bg)] focus:ring-[var(--color-primary)]",
  danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
  ghost:
    "bg-transparent text-[var(--color-text-dark)] hover:bg-[var(--color-soft-blue-bg)] focus:ring-[var(--color-text-muted)]",
  icon: "p-2 rounded-full bg-transparent text-[var(--color-text-dark)] hover:bg-[var(--color-soft-blue-bg)] focus:ring-[var(--color-primary)]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    loading = false,
    icon,
    iconPosition = "left",
    className = "",
    disabled,
    children,
    ...props
  },
  ref
) {
  const isIconOnly = variant === "icon" || (!children && !!icon);
  const base =
    "inline-flex items-center justify-center gap-2 rounded-[var(--radius)] font-medium transition focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
  const size = isIconOnly ? "p-2" : "px-4 py-2 min-h-[40px] gap-2";
  const classes = `${base} ${size} ${variantClasses[variant]} ${className}`.trim();

  return (
    <button
      ref={ref}
      type="button"
      className={classes}
      disabled={disabled ?? loading}
      aria-busy={loading}
      {...props}
    >
      {loading ? (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden
        />
      ) : icon && iconPosition === "left" ? (
        <span className="shrink-0 [&>svg]:size-4" aria-hidden>
          {icon}
        </span>
      ) : null}
      {children ? <span>{children}</span> : null}
      {!loading && icon && iconPosition === "right" ? (
        <span className="shrink-0 [&>svg]:size-4" aria-hidden>
          {icon}
        </span>
      ) : null}
    </button>
  );
});
