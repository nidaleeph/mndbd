"use client";

import { forwardRef, useId } from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  id?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, id: idProp, className = "", ...props },
  ref
) {
  const generatedId = useId();
  const id = idProp ?? props.name ?? `input-${generatedId.replace(/:/g, "")}`;
  const hasError = Boolean(error);

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-[var(--color-text-dark)]">
        {label}
      </label>
      <input
        ref={ref}
        id={id}
        aria-invalid={hasError}
        aria-describedby={hasError ? `${id}-error` : undefined}
        className={`w-full rounded-[var(--radius)] border px-3 py-2 text-[var(--color-text-dark)] placeholder:text-[var(--color-text-muted)] focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-1 focus:outline-none ${hasError ? "border-red-500 text-red-700 focus:ring-red-500" : "border-gray-300"} ${className} `.trim()}
        {...props}
      />
      {hasError && (
        <p id={`${id}-error`} className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
});
