"use client";

import { useEffect, useState } from "react";
import { HistoryRunsTable } from "./HistoryRunsTable";
import { HistoryTrendsCharts } from "./HistoryTrendsCharts";
import { HistoryReliabilityTable } from "./HistoryReliabilityTable";
import { HistoryPeopleTable } from "./HistoryPeopleTable";

type Tab = "runs" | "trends" | "reliability" | "people";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "runs", label: "Runs" },
  { id: "trends", label: "Trends" },
  { id: "reliability", label: "Item reliability" },
  { id: "people", label: "People" },
];

interface Props {
  activeTab: Tab;
}

export function HistoryTabs({ activeTab }: Props) {
  const [tab, setTab] = useState<Tab>(activeTab);

  useEffect(() => {
    setTab(activeTab);
  }, [activeTab]);

  return (
    <div className="p-page">
      <div style={{ marginBottom: 18 }}>
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 10,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--color-text-muted)",
          }}
        >
          {"// checklist · history"}
        </div>
        <h1 style={{ margin: "4px 0 0", fontSize: 22 }}>Run History</h1>
      </div>

      <div
        style={{
          display: "flex",
          gap: 2,
          borderBottom: "1px solid var(--color-border)",
          marginBottom: 18,
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              const url = new URL(window.location.href);
              url.searchParams.set("tab", t.id);
              window.history.replaceState({}, "", url.toString());
            }}
            style={{
              padding: "10px 16px",
              fontSize: 12,
              fontFamily: "monospace",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: tab === t.id ? "var(--color-primary)" : "var(--color-text-muted)",
              background: "transparent",
              border: "none",
              borderBottom:
                tab === t.id ? "2px solid var(--color-primary)" : "2px solid transparent",
              cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "runs" ? <HistoryRunsTable /> : null}
      {tab === "trends" ? <HistoryTrendsCharts /> : null}
      {tab === "reliability" ? <HistoryReliabilityTable /> : null}
      {tab === "people" ? <HistoryPeopleTable /> : null}
    </div>
  );
}
