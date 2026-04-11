"use client";

import { useEffect, useState } from "react";

interface Row {
  id: string;
  weekStart: string;
  startedAt: string;
  closedAt: string | null;
  startedBy: string | null;
  closedBy: string | null;
  total: number;
  complete: number;
  percent: number;
  midServiceAdds: number;
  durationMs: number;
}

function formatDuration(ms: number): string {
  if (ms <= 0) return "—";
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

function pctColor(pct: number): string {
  if (pct >= 95) return "#16a34a";
  if (pct >= 80) return "#ca8a04";
  return "#dc2626";
}

export function HistoryRunsTable() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/checklist/runs?limit=50", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load runs"))))
      .then((d: { runs: Row[] }) => setRows(d.runs))
      .catch((e) => setError(e instanceof Error ? e.message : "Error"));
  }, []);

  if (error) return <div style={{ color: "#dc2626" }}>{error}</div>;
  if (!rows) return <div style={{ color: "var(--color-text-muted)" }}>Loading…</div>;
  if (rows.length === 0)
    return <div style={{ color: "var(--color-text-muted)" }}>No runs yet.</div>;

  return (
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        background: "var(--color-card-bg)",
        border: "1px solid var(--color-border)",
        borderRadius: 8,
        overflow: "hidden",
        fontSize: 12,
      }}
    >
      <thead>
        <tr>
          {["Date", "Completion", "Opened by", "Closed by", "Duration", "Mid-service adds"].map(
            (h) => (
              <th
                key={h}
                style={{
                  textAlign: "left",
                  padding: "10px 14px",
                  background: "var(--color-soft-blue-bg)",
                  fontFamily: "monospace",
                  fontSize: 10,
                  color: "var(--color-text-muted)",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  borderBottom: "1px solid var(--color-border)",
                }}
              >
                {h}
              </th>
            )
          )}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr
            key={r.id}
            onClick={() => {
              window.location.href = `/dashboard/multimedia-checklist/history/${r.id}`;
            }}
            style={{ cursor: "pointer" }}
          >
            <td style={cellStyle}>
              <span style={{ fontFamily: "monospace" }}>
                {new Date(r.weekStart).toLocaleDateString("en-US", {
                  month: "short",
                  day: "2-digit",
                  year: "numeric",
                })}
              </span>
            </td>
            <td style={{ ...cellStyle, color: pctColor(r.percent), fontFamily: "monospace" }}>
              {r.percent}%
            </td>
            <td style={cellStyle}>{r.startedBy ?? "Cron"}</td>
            <td style={cellStyle}>{r.closedBy ?? (r.closedAt ? "Cron" : "Still open")}</td>
            <td style={{ ...cellStyle, fontFamily: "monospace" }}>
              {formatDuration(r.durationMs)}
            </td>
            <td style={{ ...cellStyle, fontFamily: "monospace" }}>{r.midServiceAdds}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const cellStyle: React.CSSProperties = {
  padding: "11px 14px",
  borderTop: "1px solid var(--color-border)",
  color: "var(--color-text-dark)",
};
