"use client";

import type { HTMLAttributes } from "react";

export type BadgeVariant = "default" | "success" | "warning" | "danger" | "info";

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-[var(--color-badge-default-bg)] text-[var(--color-badge-default-text)]",
  success: "bg-[var(--color-badge-success-bg)] text-[var(--color-badge-success-text)]",
  warning: "bg-[var(--color-badge-warning-bg)] text-[var(--color-badge-warning-text)]",
  danger: "bg-[var(--color-badge-danger-bg)] text-[var(--color-badge-danger-text)]",
  info: "bg-[var(--color-soft-blue-bg)] text-[var(--color-primary)]",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ variant = "default", className = "", ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variantClasses[variant]} ${className}`.trim()}
      {...props}
    />
  );
}
