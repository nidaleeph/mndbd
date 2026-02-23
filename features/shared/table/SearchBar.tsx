"use client";

import { useState, useEffect, useCallback } from "react";
import { FiSearch } from "react-icons/fi";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  id?: string;
}

/**
 * Debounced search input for table global search.
 * Calls onChange after user stops typing for debounceMs.
 */
export function SearchBar({
  value,
  onChange,
  placeholder = "Search…",
  debounceMs = 200,
  id = "table-search",
}: SearchBarProps) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue);
      }
    }, debounceMs);
    return () => window.clearTimeout(timer);
  }, [localValue, debounceMs, onChange, value]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
  }, []);

  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        Search table
      </label>
      <FiSearch
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--color-text-muted)]"
        aria-hidden
      />
      <input
        id={id}
        type="search"
        role="searchbox"
        value={localValue}
        onChange={handleChange}
        placeholder={placeholder}
        aria-label="Search table"
        className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card-bg)] py-2 pr-3 pl-9 text-sm text-[var(--color-text-dark)] placeholder:text-[var(--color-text-muted)] focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-none"
      />
    </div>
  );
}
