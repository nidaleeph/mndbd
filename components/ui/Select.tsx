"use client";

import {
  forwardRef,
  useId,
  useState,
  useRef,
  useEffect,
  useImperativeHandle,
  useCallback,
  useMemo,
} from "react";
import { FiChevronDown } from "react-icons/fi";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  "onChange"
> {
  label: string;
  options: SelectOption[];
  error?: string;
  id?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  /** When true, shows a search input to filter options */
  searchable?: boolean;
  /** Placeholder for the search input when searchable */
  searchPlaceholder?: string;
  /** Placeholder shown when no value selected (default: "Choose…") */
  placeholder?: string;
}

/**
 * Custom Select with a div-based dropdown so option text is always visible
 * (dark text on white), including in dark mode where native <option> can be unreadable.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    label,
    options,
    error,
    id: idProp,
    value,
    className = "",
    onChange,
    searchable = false,
    searchPlaceholder = "Search…",
    placeholder = "Choose…",
    ...props
  },
  ref
) {
  const generatedId = useId();
  const id = idProp ?? props.name ?? `select-${generatedId.replace(/:/g, "")}`;
  const hasError = Boolean(error);
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => selectRef.current as HTMLSelectElement);

  const selectedOption = value ? options.find((o) => o.value === value) : null;
  const displayLabel = selectedOption ? selectedOption.label : placeholder;

  const filteredOptions = useMemo(() => {
    if (!searchable || !searchQuery.trim()) return options;
    const q = searchQuery.trim().toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, searchable, searchQuery]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  useEffect(() => {
    if (open && searchable) {
      queueMicrotask(() => searchInputRef.current?.focus());
    }
  }, [open, searchable]);

  const handleSelect = useCallback(
    (opt: SelectOption) => {
      if (selectRef.current) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLSelectElement.prototype,
          "value"
        )?.set;
        nativeInputValueSetter?.call(selectRef.current, opt.value);
        selectRef.current.dispatchEvent(new Event("change", { bubbles: true }));
      }
      if (onChange) {
        onChange({ target: selectRef.current } as React.ChangeEvent<HTMLSelectElement>);
      }
      setOpen(false);
    },
    [onChange]
  );

  const handleToggle = useCallback(() => {
    if (!open && searchable) {
      setSearchQuery("");
    }
    setOpen((prev) => !prev);
  }, [open, searchable]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleToggle();
      }
    },
    [handleToggle]
  );

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      setOpen(false);
    }
  }, []);

  return (
    <div className="flex flex-col gap-1" ref={containerRef}>
      <label htmlFor={id} className="text-sm font-medium text-[var(--color-text-dark)]">
        {label}
      </label>
      {/* Hidden native select for form submission and ref */}
      <select
        ref={selectRef}
        id={id}
        name={props.name}
        value={value ?? ""}
        onChange={onChange}
        aria-hidden
        tabIndex={-1}
        className="pointer-events-none absolute h-0 w-0 opacity-0"
        aria-invalid={hasError}
        {...props}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {/* Visible custom dropdown */}
      <div className="relative">
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-labelledby={`${id}-label`}
          id={`${id}-label`}
          onClick={handleToggle}
          onKeyDown={handleKeyDown}
          className={`flex w-full items-center justify-between rounded-[var(--radius)] border bg-[var(--color-card-bg)] px-3 py-2 text-left text-[var(--color-text-dark)] focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-1 focus:outline-none ${hasError ? "border-red-500 text-red-700 focus:ring-red-500" : "border-gray-300"} ${className} `.trim()}
        >
          <span>{displayLabel}</span>
          <FiChevronDown
            className={`size-5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>
        {open && (
          <div
            className="absolute z-50 mt-1 w-full min-w-[200px] rounded-[var(--radius)] border border-gray-200 bg-white py-1 shadow-lg"
            style={{ backgroundColor: "#ffffff" }}
          >
            {searchable && (
              <div className="border-b border-gray-200 px-2 pb-2">
                <label htmlFor={`${id}-search`} className="sr-only">
                  {searchPlaceholder}
                </label>
                <input
                  ref={searchInputRef}
                  id={`${id}-search`}
                  type="text"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onKeyDown={handleSearchKeyDown}
                  placeholder={searchPlaceholder}
                  className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 placeholder:text-gray-500 focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-none"
                  aria-label={searchPlaceholder}
                />
              </div>
            )}
            <ul
              role="listbox"
              aria-labelledby={`${id}-label`}
              className="max-h-60 overflow-auto py-1"
            >
              <li
                role="option"
                aria-selected={!value}
                className="cursor-pointer px-3 py-2 hover:bg-[#eaf4ff]"
                style={{ color: "#1f2937" }}
                onClick={() => handleSelect({ value: "", label: placeholder })}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleSelect({ value: "", label: placeholder });
                  }
                }}
              >
                Unassigned
              </li>
              {filteredOptions.map((opt) => (
                <li
                  key={opt.value}
                  role="option"
                  aria-selected={value === opt.value}
                  className="cursor-pointer px-3 py-2 hover:bg-[#eaf4ff]"
                  style={{ color: "#1f2937" }}
                  onClick={() => handleSelect(opt)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSelect(opt);
                    }
                  }}
                >
                  {opt.label}
                </li>
              ))}
              {searchable && searchQuery.trim() && filteredOptions.length === 0 && (
                <li className="px-3 py-2 text-sm text-[var(--color-text-muted)]">
                  No matches
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
      {hasError && (
        <p id={`${id}-error`} className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
});
