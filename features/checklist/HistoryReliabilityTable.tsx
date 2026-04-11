"use client";

import { useEffect, useState } from "react";

interface Row {
  itemId: string;
  category: string;
  label: string;
  timesChecked: number;
  timesMissed: number;
  missRate: number;
}

function pctColor(pct: number): string {
  if (pct === 0) return "#16a34a";
  if (pct <= 15) return "#ca8a04";
  return "#dc2626";
}

export function HistoryReliabilityTable() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/checklist/stats?view=reliability", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load reliability"))))
      .then((d: { data: Row[] }) => setRows(d.data))
      .catch((e) => setError(e instanceof Error ? e.message : "Error"));
  }, []);

  if (error) return <div style={{ color: "#dc2626" }}>{error}</div>;
  if (!rows) return <div style={{ color: "var(--color-text-muted)" }}>Loading…</div>;
  if (rows.length === 0)
    return <div style={{ color: "var(--color-text-muted)" }}>No items yet.</div>;

  return (
    <table style={tableStyle}>
      <thead>
        <tr>
          {["Category", "Item", "Times checked", "Times missed", "Miss rate"].map((h) => (
            <th key={h} style={thStyle}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.itemId}>
            <td style={{ ...tdStyle, fontFamily: "monospace" }}>{r.category}</td>
            <td style={tdStyle}>{r.label}</td>
            <td style={{ ...tdStyle, fontFamily: "monospace" }}>{r.timesChecked}</td>
            <td style={{ ...tdStyle, fontFamily: "monospace" }}>{r.timesMissed}</td>
            <td style={{ ...tdStyle, color: pctColor(r.missRate), fontFamily: "monospace" }}>
              {r.missRate}%
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  background: "var(--color-card-bg)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  overflow: "hidden",
  fontSize: 12,
};
const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 14px",
  background: "var(--color-soft-blue-bg)",
  fontFamily: "monospace",
  fontSize: 10,
  color: "var(--color-text-muted)",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  borderBottom: "1px solid var(--color-border)",
};
const tdStyle: React.CSSProperties = {
  padding: "11px 14px",
  borderTop: "1px solid var(--color-border)",
  color: "var(--color-text-dark)",
};
