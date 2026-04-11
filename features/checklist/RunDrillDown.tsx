import { formatManilaLongDate, formatManilaTime } from "@/lib/dates";

interface DrillItem {
  id: string;
  label: string;
  categoryNameSnapshot: string;
  checkedBy: string | null;
  checkedAt: string | null;
}
interface DrillCategory {
  id: string;
  name: string;
  items: DrillItem[];
}

interface Props {
  weekStart: string;
  startedAt: string;
  closedAt: string | null;
  startedBy: string | null;
  closedBy: string | null;
  categories: DrillCategory[];
}

export function RunDrillDown({
  weekStart,
  startedAt,
  closedAt,
  startedBy,
  closedBy,
  categories,
}: Props) {
  const allItems = categories.flatMap((c) => c.items);
  const total = allItems.length;
  const complete = allItems.filter((i) => i.checkedAt !== null).length;
  const percent = total === 0 ? 0 : Math.round((complete / total) * 100);

  return (
    <div className="p-page">
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 10,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--color-text-muted)",
          }}
        >
          {"// history · drill-down"}
        </div>
        <h1 style={{ margin: "4px 0 0", fontSize: 22 }}>{formatManilaLongDate(weekStart)}</h1>
        <div style={{ color: "var(--color-text-muted)", fontSize: 13, marginTop: 6 }}>
          {complete} of {total} items complete · {percent}%
        </div>
        <div
          style={{
            display: "flex",
            gap: 20,
            fontSize: 11,
            color: "var(--color-text-muted)",
            fontFamily: "monospace",
            marginTop: 10,
          }}
        >
          <span>
            OPENED BY{" "}
            <strong style={{ color: "var(--color-text-dark)" }}>{startedBy ?? "cron"}</strong> ·{" "}
            {formatManilaTime(startedAt)}
          </span>
          <span>
            CLOSED BY{" "}
            <strong style={{ color: "var(--color-text-dark)" }}>
              {closedAt ? (closedBy ?? "cron") : "still open"}
            </strong>
            {closedAt ? ` · ${formatManilaTime(closedAt)}` : ""}
          </span>
        </div>
      </div>

      {categories.map((cat) => (
        <div key={cat.id} style={{ marginBottom: 22 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--color-text-dark)",
              marginBottom: 10,
            }}
          >
            {cat.name}
          </div>
          <div
            style={{
              background: "var(--color-card-bg)",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            {cat.items.map((item, idx) => {
              const done = item.checkedAt !== null;
              return (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "10px 16px",
                    borderTop: idx === 0 ? "none" : "1px solid var(--color-border)",
                    fontSize: 12,
                  }}
                >
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      border: `1.5px solid ${done ? "#16a34a" : "#dc2626"}`,
                      background: done ? "#16a34a" : "rgba(248,113,113,0.1)",
                      color: done ? "white" : "#dc2626",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      flexShrink: 0,
                    }}
                  >
                    {done ? "✓" : "×"}
                  </div>
                  <div
                    style={{
                      flex: 1,
                      color: done ? "var(--color-text-dark)" : "var(--color-text-muted)",
                    }}
                  >
                    {item.label}
                  </div>
                  <div
                    style={{
                      fontFamily: "monospace",
                      fontSize: 10,
                      color: done ? "var(--color-text-muted)" : "#dc2626",
                    }}
                  >
                    {done && item.checkedBy
                      ? `${item.checkedBy} · ${formatManilaTime(item.checkedAt!)}`
                      : "never checked"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
