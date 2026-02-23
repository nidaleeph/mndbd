"use client";

import type { HTMLAttributes } from "react";

export interface PageContainerProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  /** Optional description below title */
  description?: string;
}

export function PageContainer({
  title,
  description,
  className = "",
  children,
  ...props
}: PageContainerProps) {
  return (
    <div className={`p-page ${className}`.trim()} {...props}>
      {title ? (
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-[var(--color-text-dark)]">{title}</h1>
          {description ? (
            <p className="mt-1 text-[var(--color-text-muted)]">{description}</p>
          ) : null}
        </header>
      ) : null}
      {children}
    </div>
  );
}
