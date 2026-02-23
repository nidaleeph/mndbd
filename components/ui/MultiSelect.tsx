"use client";

import { useId } from "react";
import type { SelectOption } from "./Select";

export interface MultiSelectProps {
  label: string;
  options: SelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  name?: string;
  error?: string;
  id?: string;
}

/**
 * Multi-select component using checkboxes.
 * Used for selecting multiple ministries for a user.
 */
export function MultiSelect({
  label,
  options,
  value,
  onChange,
  name,
  error,
  id: idProp,
}: MultiSelectProps) {
  const generatedId = useId();
  const id = idProp ?? name ?? `multiselect-${generatedId.replace(/:/g, "")}`;
  const hasError = Boolean(error);

  const handleToggle = (optValue: string) => {
    if (value.includes(optValue)) {
      onChange(value.filter((v) => v !== optValue));
    } else {
      onChange([...value, optValue]);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-[var(--color-text-dark)]">
        {label}
      </label>
      <div
        id={id}
        role="group"
        aria-labelledby={`${id}-label`}
        className={`max-h-48 overflow-y-auto rounded-[var(--radius)] border px-3 py-2 ${
          hasError ? "border-red-500" : "border-gray-300"
        }`}
      >
        {options.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">No ministries available</p>
        ) : (
          <ul className="space-y-2" role="listbox" aria-multiselectable>
            {options.map((opt) => (
              <li key={opt.value} role="option" aria-selected={value.includes(opt.value)}>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={value.includes(opt.value)}
                    onChange={() => handleToggle(opt.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleToggle(opt.value);
                      }
                    }}
                    className="rounded border-gray-300"
                    aria-label={`Select ${opt.label}`}
                  />
                  <span>{opt.label}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
      {hasError && (
        <p id={`${id}-error`} className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
