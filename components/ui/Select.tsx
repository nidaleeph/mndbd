"use client";

import { forwardRef, useId, useState, useRef, useEffect, useImperativeHandle } from "react";
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
}

/**
 * Custom Select with a div-based dropdown so option text is always visible
 * (dark text on white), including in dark mode where native <option> can be unreadable.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, options, error, id: idProp, value, className = "", onChange, ...props },
  ref
) {
  const generatedId = useId();
  const id = idProp ?? props.name ?? `select-${generatedId.replace(/:/g, "")}`;
  const hasError = Boolean(error);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);

  useImperativeHandle(ref, () => selectRef.current as HTMLSelectElement);

  const selectedOption = value ? options.find((o) => o.value === value) : null;
  const displayLabel = selectedOption ? selectedOption.label : "Select...";

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

  function handleSelect(opt: SelectOption) {
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
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") setOpen(false);
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen((prev) => !prev);
    }
  }

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
        <option value="">Select...</option>
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
          onClick={() => setOpen((prev) => !prev)}
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
          <ul
            role="listbox"
            aria-labelledby={`${id}-label`}
            className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-[var(--radius)] border border-gray-200 bg-white py-1 shadow-lg"
            style={{ backgroundColor: "#ffffff" }}
          >
            <li
              role="option"
              aria-selected={!value}
              className="cursor-pointer px-3 py-2 hover:bg-[#eaf4ff]"
              style={{ color: "#1f2937" }}
              onClick={() => handleSelect({ value: "", label: "Select..." })}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleSelect({ value: "", label: "Select..." });
                }
              }}
            >
              Select...
            </li>
            {options.map((opt) => (
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
});
