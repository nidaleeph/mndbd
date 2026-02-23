"use client";

import type { HTMLAttributes } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Optional card title rendered at top */
  title?: string;
}

export function Card({ title, className = "", children, ...props }: CardProps) {
  return (
    <div
      className={`p-card rounded-[var(--radius-lg)] bg-[var(--color-card-bg)] shadow-[var(--shadow-card)] ${className}`.trim()}
      {...props}
    >
      {title ? (
        <h3 className="mb-4 text-lg font-semibold text-[var(--color-text-dark)]">{title}</h3>
      ) : null}
      {children}
    </div>
  );
}
