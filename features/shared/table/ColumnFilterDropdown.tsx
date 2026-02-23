"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { FiFilter } from "react-icons/fi";

interface ColumnFilterDropdownProps {
  columnId: string;
  columnLabel: string;
  options: string[];
  selectedValues: string[];
  onSelectionChange: (columnId: string, values: string[]) => void;
  /** Optional: format display value (e.g. capitalize status) */
  formatOption?: (value: string) => string;
}

/**
 * Multi-select dropdown for column filtering.
 * Shows checkboxes; row matches if ANY selected value matches.
 * Uses fixed positioning (portal) like FormActionsCell so the dropdown
 * does not extend the table layout.
 */
export function ColumnFilterDropdown({
  columnId,
  columnLabel,
  options,
  selectedValues,
  onSelectionChange,
  formatOption = (v) => v,
}: ColumnFilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    const target = e.target as Node;
    if (containerRef.current && !containerRef.current.contains(target)) {
      if ((target as Element).closest?.("[data-column-filter-dropdown]")) return;
      setIsOpen(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [handleClickOutside]);

  useEffect(() => {
    if (isOpen && triggerRef.current && typeof document !== "undefined") {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownRect({
        top: rect.bottom + 4,
        left: rect.left,
      });
    } else {
      setDropdownRect(null);
    }
  }, [isOpen]);

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleToggle();
      }
    },
    [handleToggle]
  );

  const handleCheckboxChange = useCallback(
    (option: string, checked: boolean) => {
      const next = checked
        ? [...selectedValues, option]
        : selectedValues.filter((v) => v !== option);
      onSelectionChange(columnId, next);
    },
    [columnId, selectedValues, onSelectionChange]
  );

  const activeCount = selectedValues.length;
  const hasActiveFilter = activeCount > 0;

  const dropdownPanel =
    isOpen &&
    dropdownRect &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        data-column-filter-dropdown
        role="listbox"
        aria-multiselectable
        aria-label={`Filter options for ${columnLabel}`}
        className="fixed z-50 min-w-[160px] rounded border border-[var(--color-border)] bg-[var(--color-card-bg)] py-2 shadow-lg"
        style={{ top: dropdownRect.top, left: dropdownRect.left }}
      >
        {options.length === 0 ? (
          <p className="px-4 py-2 text-sm text-[var(--color-text-muted)]">No options</p>
        ) : (
          <ul className="max-h-[240px] overflow-y-auto">
            {options.map((option) => {
              const checked = selectedValues.includes(option);
              const optionId = `${columnId}-filter-${option.replace(/\s/g, "-")}`;
              return (
                <li key={option} role="option" aria-selected={checked}>
                  <label
                    htmlFor={optionId}
                    className="flex cursor-pointer items-center gap-2 px-4 py-2 text-sm text-[var(--color-text-dark)] hover:bg-[var(--color-soft-blue-bg)]"
                  >
                    <input
                      id={optionId}
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => handleCheckboxChange(option, e.target.checked)}
                      className="rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                    />
                    {formatOption(option)}
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>,
      document.body
    );

  return (
    <div ref={containerRef} className="relative inline-block shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Filter by ${columnLabel}${hasActiveFilter ? ` (${activeCount} selected)` : ""}`}
        className={`inline-flex items-center justify-center rounded p-1 text-[var(--color-text-dark)] hover:bg-[var(--color-soft-blue-bg)] focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-none ${hasActiveFilter ? "text-[var(--color-primary)]" : ""}`}
      >
        <FiFilter className="size-4 shrink-0" aria-hidden />
        {hasActiveFilter && (
          <span className="text-xs font-medium" aria-hidden>
            {activeCount}
          </span>
        )}
      </button>
      {dropdownPanel}
    </div>
  );
}
