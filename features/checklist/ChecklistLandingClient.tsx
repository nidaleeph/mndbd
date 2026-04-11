"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Pusher from "pusher-js";

interface RunSummary {
  id: string;
  weekStart: string;
  startedAt: string;
  startedByName: string | null;
}

interface Activity {
  checkedAt: string;
  checkedByName: string;
  label: string;
}

interface Props {
  canManage: boolean;
  run: RunSummary | null;
  progress: { total: number; complete: number; percent: number };
  avgRecent: number;
  activeMembers: number;
  recentActivity: Activity[];
}

export function ChecklistLandingClient({
  canManage,
  run,
  progress,
  avgRecent,
  activeMembers,
  recentActivity,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to the public checklist channel so the dashboard stays in sync
  // with check/uncheck, template edits, and run start/close events. On any
  // event we call router.refresh() which re-runs the server component and
  // re-hydrates this client with fresh stats.
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    if (!key || !cluster) return;
    const pusher = new Pusher(key, { cluster });
    const channel = pusher.subscribe("checklist-multimedia");
    const onEvent = () => router.refresh();
    channel.bind("item-checked", onEvent);
    channel.bind("item-unchecked", onEvent);
    channel.bind("template-changed", onEvent);
    channel.bind("run-changed", onEvent);
    return () => {
      channel.unbind_all();
      pusher.unsubscribe("checklist-multimedia");
      pusher.disconnect();
    };
  }, [router]);

  const startRun = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/checklist/runs/start", { method: "POST" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message ?? "Failed to start run");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }, [router]);

  const closeRun = useCallback(async () => {
    if (
      !window.confirm("Close this week's checklist? Unchecked items will be recorded as unchecked.")
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/checklist/runs/close", { method: "POST" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message ?? "Failed to close run");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }, [router]);

  return (
    <div className="p-page">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 24,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "monospace",
              fontSize: 10,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--color-text-muted)",
            }}
          >
            {"// multimedia · checklist"}
          </div>
          <h1 style={{ margin: "4px 0 0", fontSize: 22 }}>Sunday Setup Checklist</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link
            href="/checklist"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: "8px 14px",
              borderRadius: 5,
              border: "1px solid var(--color-border)",
              fontSize: 12,
              fontWeight: 600,
              textDecoration: "none",
              color: "var(--color-text-dark)",
            }}
          >
            View live →
          </Link>
          {canManage && !run ? (
            <button
              type="button"
              onClick={startRun}
              disabled={busy}
              style={{
                padding: "8px 14px",
                borderRadius: 5,
                border: "none",
                background: "var(--color-primary)",
                color: "white",
                fontSize: 12,
                fontWeight: 600,
                cursor: busy ? "not-allowed" : "pointer",
              }}
            >
              Start new week
            </button>
          ) : null}
          {canManage && run ? (
            <button
              type="button"
              onClick={closeRun}
              disabled={busy}
              style={{
                padding: "8px 14px",
                borderRadius: 5,
                border: "1px solid #dc2626",
                background: "transparent",
                color: "#dc2626",
                fontSize: 12,
                fontWeight: 600,
                cursor: busy ? "not-allowed" : "pointer",
              }}
            >
              Close current week
            </button>
          ) : null}
          <Link
            href="/dashboard/multimedia-checklist/template"
            style={{
              padding: "8px 14px",
              borderRadius: 5,
              border: "1px solid var(--color-border)",
              fontSize: 12,
              fontWeight: 600,
              textDecoration: "none",
              color: "var(--color-text-dark)",
            }}
          >
            Edit template
          </Link>
          <Link
            href="/dashboard/multimedia-checklist/history"
            style={{
              padding: "8px 14px",
              borderRadius: 5,
              border: "1px solid var(--color-border)",
              fontSize: 12,
              fontWeight: 600,
              textDecoration: "none",
              color: "var(--color-text-dark)",
            }}
          >
            History
          </Link>
        </div>
      </div>

      {error ? (
        <div
          style={{
            padding: 12,
            background: "#fee2e2",
            border: "1px solid #fca5a5",
            color: "#991b1b",
            borderRadius: 6,
            marginBottom: 18,
          }}
        >
          {error}
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 14,
          marginBottom: 22,
        }}
      >
        <StatCard
          label="Current run"
          value={`${progress.percent}%`}
          caption={`${progress.complete} / ${progress.total} items`}
        />
        <StatCard
          label="Opened"
          value={
            run
              ? new Date(run.startedAt).toLocaleString("en-US", {
                  weekday: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—"
          }
          caption={
            run ? (run.startedByName ? `by ${run.startedByName}` : "by cron") : "no open run"
          }
        />
        <StatCard label="Last 4 weeks avg" value={`${avgRecent}%`} caption="" />
        <StatCard label="Active members" value={String(activeMembers)} caption="checking today" />
      </div>

      <div
        style={{
          background: "var(--color-card-bg)",
          border: "1px solid var(--color-border)",
          borderRadius: 8,
          padding: 18,
          marginBottom: 14,
        }}
      >
        <h3 style={{ margin: "0 0 12px", fontSize: 14 }}>Live progress</h3>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: "monospace",
            fontSize: 12,
            marginBottom: 6,
          }}
        >
          <span>
            {progress.complete} of {progress.total} complete
          </span>
          <span>{progress.percent}%</span>
        </div>
        <div
          style={{
            height: 10,
            background: "var(--color-border)",
            borderRadius: 5,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progress.percent}%`,
              background: "linear-gradient(90deg, #22d3ee, #4ade80)",
              transition: "width 0.3s",
            }}
          />
        </div>
      </div>

      <div
        style={{
          background: "var(--color-card-bg)",
          border: "1px solid var(--color-border)",
          borderRadius: 8,
          padding: 18,
        }}
      >
        <h3 style={{ margin: "0 0 12px", fontSize: 14 }}>Recent activity</h3>
        {recentActivity.length === 0 ? (
          <div style={{ color: "var(--color-text-muted)", fontSize: 13 }}>No activity yet.</div>
        ) : (
          <div style={{ fontFamily: "monospace", fontSize: 12, lineHeight: 1.9 }}>
            {recentActivity.map((a, idx) => (
              <div key={`${a.checkedAt}-${idx}`}>
                {new Date(a.checkedAt).toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                · <span style={{ color: "var(--color-text-dark)" }}>{a.label}</span> ·{" "}
                {a.checkedByName}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, caption }: { label: string; value: string; caption: string }) {
  return (
    <div
      style={{
        background: "var(--color-card-bg)",
        border: "1px solid var(--color-border)",
        padding: "14px 16px",
        borderRadius: 8,
      }}
    >
      <div
        style={{
          fontFamily: "monospace",
          fontSize: 9,
          color: "var(--color-text-muted)",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
      {caption ? (
        <div
          style={{
            fontSize: 10,
            color: "var(--color-text-muted)",
            fontFamily: "monospace",
            marginTop: 4,
          }}
        >
          {caption}
        </div>
      ) : null}
    </div>
  );
}
