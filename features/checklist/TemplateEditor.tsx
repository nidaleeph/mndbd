"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Item {
  id: string;
  label: string;
  sortOrder: number;
}
interface Category {
  id: string;
  name: string;
  sortOrder: number;
  items: Item[];
}

interface Props {
  initialCategories: Category[];
}

export function TemplateEditor({ initialCategories }: Props) {
  const router = useRouter();
  const [categories, setCategories] = useState(initialCategories);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiCall = useCallback(async (url: string, init: RequestInit): Promise<Response | null> => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        ...init,
        headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message ?? `${init.method ?? "GET"} ${url} failed`);
      }
      return res;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  const addCategory = useCallback(async () => {
    const res = await apiCall("/api/checklist/categories", {
      method: "POST",
      body: JSON.stringify({ name: "New category", sortOrder: categories.length }),
    });
    if (res) router.refresh();
  }, [apiCall, categories.length, router]);

  const renameCategory = useCallback(
    async (id: string, name: string) => {
      setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
      const res = await apiCall(`/api/checklist/categories/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      });
      if (!res) router.refresh();
    },
    [apiCall, router]
  );

  const archiveCategory = useCallback(
    async (id: string) => {
      if (!window.confirm("Archive this category? Its items will also be archived.")) return;
      const res = await apiCall(`/api/checklist/categories/${id}`, { method: "DELETE" });
      if (res) router.refresh();
    },
    [apiCall, router]
  );

  const moveCategory = useCallback(
    async (id: string, direction: -1 | 1) => {
      const idx = categories.findIndex((c) => c.id === id);
      const swapIdx = idx + direction;
      if (idx < 0 || swapIdx < 0 || swapIdx >= categories.length) return;
      const next = [...categories];
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      setCategories(next);
      await Promise.all(
        next.map((c, i) =>
          apiCall(`/api/checklist/categories/${c.id}`, {
            method: "PATCH",
            body: JSON.stringify({ sortOrder: i }),
          })
        )
      );
    },
    [apiCall, categories]
  );

  const addItem = useCallback(
    async (categoryId: string) => {
      const cat = categories.find((c) => c.id === categoryId);
      const res = await apiCall("/api/checklist/items", {
        method: "POST",
        body: JSON.stringify({
          categoryId,
          label: "New item",
          sortOrder: cat?.items.length ?? 0,
        }),
      });
      if (res) router.refresh();
    },
    [apiCall, categories, router]
  );

  const renameItem = useCallback(
    async (categoryId: string, itemId: string, label: string) => {
      setCategories((prev) =>
        prev.map((c) =>
          c.id === categoryId
            ? { ...c, items: c.items.map((i) => (i.id === itemId ? { ...i, label } : i)) }
            : c
        )
      );
      const res = await apiCall(`/api/checklist/items/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify({ label }),
      });
      if (!res) router.refresh();
    },
    [apiCall, router]
  );

  const archiveItem = useCallback(
    async (itemId: string) => {
      if (!window.confirm("Delete this item? History is preserved.")) return;
      const res = await apiCall(`/api/checklist/items/${itemId}`, { method: "DELETE" });
      if (res) router.refresh();
    },
    [apiCall, router]
  );

  const moveItem = useCallback(
    async (categoryId: string, itemId: string, direction: -1 | 1) => {
      const cat = categories.find((c) => c.id === categoryId);
      if (!cat) return;
      const idx = cat.items.findIndex((i) => i.id === itemId);
      const swapIdx = idx + direction;
      if (idx < 0 || swapIdx < 0 || swapIdx >= cat.items.length) return;
      const nextItems = [...cat.items];
      [nextItems[idx], nextItems[swapIdx]] = [nextItems[swapIdx], nextItems[idx]];
      setCategories((prev) =>
        prev.map((c) => (c.id === categoryId ? { ...c, items: nextItems } : c))
      );
      await Promise.all(
        nextItems.map((i, order) =>
          apiCall(`/api/checklist/items/${i.id}`, {
            method: "PATCH",
            body: JSON.stringify({ sortOrder: order }),
          })
        )
      );
    },
    [apiCall, categories]
  );

  return (
    <div className="p-page">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 20,
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
            {"// checklist · template"}
          </div>
          <h1 style={{ margin: "4px 0 0", fontSize: 22 }}>Edit Template</h1>
        </div>
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

      {categories.map((cat) => (
        <div
          key={cat.id}
          style={{
            background: "var(--color-card-bg)",
            border: "1px solid var(--color-border)",
            borderRadius: 8,
            padding: "14px 16px",
            marginBottom: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              paddingBottom: 10,
              borderBottom: "1px solid var(--color-border)",
              marginBottom: 10,
            }}
          >
            <EditableText
              value={cat.name}
              onCommit={(next) => renameCategory(cat.id, next)}
              style={{ flex: 1, fontSize: 14, fontWeight: 600 }}
            />
            <button
              type="button"
              onClick={() => moveCategory(cat.id, -1)}
              disabled={busy}
              aria-label="Move category up"
              style={moveBtnStyle}
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => moveCategory(cat.id, 1)}
              disabled={busy}
              aria-label="Move category down"
              style={moveBtnStyle}
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => archiveCategory(cat.id)}
              disabled={busy}
              style={{ ...moveBtnStyle, borderColor: "#dc2626", color: "#dc2626" }}
            >
              Archive
            </button>
          </div>

          {cat.items.map((item) => (
            <div
              key={item.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 0",
                fontSize: 13,
              }}
            >
              <EditableText
                value={item.label}
                onCommit={(next) => renameItem(cat.id, item.id, next)}
                style={{ flex: 1, color: "var(--color-text-muted)" }}
              />
              <button
                type="button"
                onClick={() => moveItem(cat.id, item.id, -1)}
                disabled={busy}
                aria-label="Move item up"
                style={moveBtnStyle}
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => moveItem(cat.id, item.id, 1)}
                disabled={busy}
                aria-label="Move item down"
                style={moveBtnStyle}
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => archiveItem(item.id)}
                disabled={busy}
                aria-label="Delete item"
                style={{ ...moveBtnStyle, color: "#dc2626" }}
              >
                ×
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={() => addItem(cat.id)}
            disabled={busy}
            style={{
              fontFamily: "monospace",
              fontSize: 11,
              color: "var(--color-primary)",
              background: "transparent",
              border: "1px dashed var(--color-primary)",
              borderRadius: 4,
              padding: "6px 10px",
              cursor: "pointer",
              marginTop: 8,
            }}
          >
            + Add item
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={addCategory}
        disabled={busy}
        style={{
          width: "100%",
          padding: 14,
          border: "1px dashed var(--color-border)",
          background: "transparent",
          color: "var(--color-text-muted)",
          borderRadius: 8,
          cursor: "pointer",
          fontSize: 13,
          marginTop: 4,
        }}
      >
        + Add category
      </button>
    </div>
  );
}

const moveBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--color-border)",
  color: "var(--color-text-dark)",
  borderRadius: 4,
  padding: "4px 8px",
  fontSize: 11,
  cursor: "pointer",
};

function EditableText({
  value,
  onCommit,
  style,
}: {
  value: string;
  onCommit: (next: string) => void;
  style?: React.CSSProperties;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        style={{
          background: "transparent",
          border: "none",
          textAlign: "left",
          cursor: "text",
          padding: 0,
          color: "inherit",
          font: "inherit",
          ...style,
        }}
      >
        {value}
      </button>
    );
  }

  return (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setEditing(false);
        const trimmed = draft.trim();
        if (trimmed && trimmed !== value) onCommit(trimmed);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        } else if (e.key === "Escape") {
          setDraft(value);
          setEditing(false);
        }
      }}
      style={{
        background: "var(--color-card-bg)",
        border: "1px solid var(--color-primary)",
        padding: "4px 8px",
        borderRadius: 4,
        ...style,
      }}
    />
  );
}
