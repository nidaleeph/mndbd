"use client";

import type { HTMLAttributes } from "react";

export interface SectionProps extends HTMLAttributes<HTMLElement> {
  title?: string;
}

export function Section({ title, className = "", children, ...props }: SectionProps) {
  return (
    <section className={`mb-8 ${className}`.trim()} {...props}>
      {title ? (
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-text-dark)]">{title}</h2>
      ) : null}
      {children}
    </section>
  );
}
