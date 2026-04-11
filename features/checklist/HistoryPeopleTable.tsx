"use client";

import { useEffect, useState } from "react";

interface Row {
  userId: string;
  name: string;
  runsParticipated: number;
  totalRuns: number;
  totalChecked: number;
  avgPerRun: number;
  lastActive: string;
}

export function HistoryPeopleTable() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/checklist/stats?view=people", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load people"))))
      .then((d: { data: Row[] }) => setRows(d.data))
      .catch((e) => setError(e instanceof Error ? e.message : "Error"));
  }, []);

  if (error) return <div style={{ color: "#dc2626" }}>{error}</div>;
  if (!rows) return <div style={{ color: "var(--color-text-muted)" }}>Loading…</div>;
  if (rows.length === 0)
    return <div style={{ color: "var(--color-text-muted)" }}>No activity yet.</div>;

  return (
    <table style={tableStyle}>
      <thead>
        <tr>
          {["Member", "Runs participated", "Total items checked", "Avg per run", "Last active"].map(
            (h) => (
              <th key={h} style={thStyle}>
                {h}
              </th>
            )
          )}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.userId}>
            <td style={tdStyle}>{r.name}</td>
            <td style={{ ...tdStyle, fontFamily: "monospace" }}>
              {r.runsParticipated} / {r.totalRuns}
            </td>
            <td style={{ ...tdStyle, fontFamily: "monospace" }}>{r.totalChecked}</td>
            <td style={{ ...tdStyle, fontFamily: "monospace" }}>{r.avgPerRun}</td>
            <td style={{ ...tdStyle, fontFamily: "monospace" }}>
              {new Date(r.lastActive).toLocaleDateString("en-US", {
                month: "short",
                day: "2-digit",
              })}
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
