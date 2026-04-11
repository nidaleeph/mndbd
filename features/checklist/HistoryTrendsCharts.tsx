"use client";

import { useEffect, useState } from "react";

interface Row {
  runId: string;
  weekStart: string;
  percent: number;
  durationMinutes: number;
}

export function HistoryTrendsCharts() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/checklist/stats?view=trends", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load trends"))))
      .then((d: { data: Row[] }) => setRows(d.data))
      .catch((e) => setError(e instanceof Error ? e.message : "Error"));
  }, []);

  if (error) return <div style={{ color: "#dc2626" }}>{error}</div>;
  if (!rows) return <div style={{ color: "var(--color-text-muted)" }}>Loading…</div>;
  if (rows.length === 0)
    return (
      <div style={{ color: "var(--color-text-muted)" }}>
        Not enough data yet. Come back after a few Sundays.
      </div>
    );

  const width = 600;
  const height = 140;
  const step = rows.length > 1 ? (width - 60) / (rows.length - 1) : 0;
  const completionPoints = rows.map((r, i) => {
    const x = 40 + i * step;
    const y = 20 + (1 - r.percent / 100) * 100;
    return { x, y };
  });
  const completionPath = completionPoints
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`)
    .join(" ");
  const maxDuration = Math.max(10, ...rows.map((r) => r.durationMinutes));

  return (
    <>
      <div style={chartCard}>
        <h4 style={chartTitle}>Completion % · Last {rows.length} runs</h4>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height }}>
          <line x1="0" y1="20" x2={width} y2="20" stroke="#e5e7eb" strokeDasharray="2,4" />
          <line x1="0" y1="70" x2={width} y2="70" stroke="#e5e7eb" strokeDasharray="2,4" />
          <line x1="0" y1="120" x2={width} y2="120" stroke="#e5e7eb" strokeDasharray="2,4" />
          <text x="8" y="16" fill="#6b7280" fontSize="9" fontFamily="monospace">
            100%
          </text>
          <text x="8" y="75" fill="#6b7280" fontSize="9" fontFamily="monospace">
            75%
          </text>
          <text x="8" y="125" fill="#6b7280" fontSize="9" fontFamily="monospace">
            50%
          </text>
          <path
            d={completionPath}
            stroke="#3b82f6"
            strokeWidth="2.5"
            fill="none"
            strokeLinejoin="round"
          />
          {completionPoints.map((p) => (
            <circle key={`${p.x}-${p.y}`} cx={p.x} cy={p.y} r="3" fill="#3b82f6" />
          ))}
        </svg>
      </div>

      <div style={chartCard}>
        <h4 style={chartTitle}>Duration (minutes) · Last {rows.length} runs</h4>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height }}>
          {rows.map((r, i) => {
            const barHeight = (r.durationMinutes / maxDuration) * 100;
            const x = 40 + i * step - 8;
            const y = 120 - barHeight;
            return <rect key={r.runId} x={x} y={y} width={16} height={barHeight} fill="#4ade80" />;
          })}
        </svg>
      </div>
    </>
  );
}

const chartCard: React.CSSProperties = {
  background: "var(--color-card-bg)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  padding: 20,
  marginBottom: 14,
};
const chartTitle: React.CSSProperties = {
  margin: "0 0 16px",
  fontSize: 12,
  color: "var(--color-text-muted)",
  fontFamily: "monospace",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};
