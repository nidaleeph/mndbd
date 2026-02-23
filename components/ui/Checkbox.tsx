"use client";

import { forwardRef, useId } from "react";

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  error?: string;
  id?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, error, id: idProp, className = "", ...props },
  ref
) {
  const generatedId = useId();
  const id = idProp ?? props.name ?? `checkbox-${generatedId.replace(/:/g, "")}`;
  const hasError = Boolean(error);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <input
          ref={ref}
          type="checkbox"
          id={id}
          aria-invalid={hasError}
          aria-describedby={hasError ? `${id}-error` : undefined}
          className={`h-4 w-4 rounded border-gray-300 text-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-1 ${hasError ? "border-red-500" : ""} ${className} `.trim()}
          {...props}
        />
        <label
          htmlFor={id}
          className="cursor-pointer text-sm font-medium text-[var(--color-text-dark)]"
        >
          {label}
        </label>
      </div>
      {hasError && (
        <p id={`${id}-error`} className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
});
