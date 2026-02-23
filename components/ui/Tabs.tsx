"use client";

import type { ReactNode } from "react";

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  activeId: string;
  onTabChange: (id: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeId, onTabChange, className = "" }: TabsProps) {
  return (
    <div className={className}>
      <div role="tablist" className="flex gap-1 border-b border-gray-200" aria-label="Tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeId === tab.id}
            aria-controls={`tabpanel-${tab.id}`}
            id={`tab-${tab.id}`}
            tabIndex={activeId === tab.id ? 0 : -1}
            onClick={() => onTabChange(tab.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
              activeId === tab.id
                ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-dark)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          id={`tabpanel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${tab.id}`}
          hidden={activeId !== tab.id}
          className="pt-4"
        >
          {activeId === tab.id ? tab.content : null}
        </div>
      ))}
    </div>
  );
}
