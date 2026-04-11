"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import Pusher from "pusher-js";
import { CelebrationOverlay } from "./CelebrationOverlay";
import { formatManilaLongDate, formatManilaTime } from "@/lib/dates";

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

interface Template {
  id: string;
  categories: Category[];
}

interface Run {
  id: string;
  weekStart: string | Date;
  startedAt: string | Date;
  closedAt: string | Date | null;
}

interface Check {
  id: string;
  itemId: string;
  checkedById: string;
  checkedByName: string;
  checkedAt: string;
}

interface Props {
  template: Template | null;
  run: Run | null;
  initialChecks: Check[];
  canCheck: boolean;
  currentUserId: string | null;
  currentUserName: string | null;
}

function categoryTag(name: string): string {
  const first = name.split(/[—\-–:]/)[0]?.trim() ?? name;
  return first.toUpperCase().slice(0, 6);
}

export function ChecklistPublicClient({
  template,
  run,
  initialChecks,
  canCheck,
  currentUserId,
  currentUserName,
}: Props) {
  const [liveTemplate, setLiveTemplate] = useState(template);
  const [liveRun, setLiveRun] = useState(run);
  const [checks, setChecks] = useState<Check[]>(initialChecks);
  const pendingRef = useRef<Set<string>>(new Set());

  const checksByItem = useMemo(() => {
    const map = new Map<string, Check>();
    for (const c of checks) map.set(c.itemId, c);
    return map;
  }, [checks]);

  const allItems = useMemo(
    () => liveTemplate?.categories.flatMap((c) => c.items) ?? [],
    [liveTemplate]
  );
  const total = allItems.length;
  const complete = allItems.filter((i) => checksByItem.has(i.id)).length;
  const percent = total === 0 ? 0 : Math.round((complete / total) * 100);
  const is100 = total > 0 && complete === total;

  const refetchCurrent = useCallback(async () => {
    try {
      const res = await fetch("/api/checklist/current", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        template: Template | null;
        run: Run | null;
        checks: Check[];
      };
      setLiveTemplate(data.template);
      setLiveRun(data.run);
      setChecks(data.checks);
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    if (!key || !cluster) return;
    const pusher = new Pusher(key, { cluster });
    const channel = pusher.subscribe("checklist-multimedia");

    channel.bind(
      "item-checked",
      (payload: {
        itemId: string;
        checkedById: string;
        checkedByName: string;
        checkedAt: string;
      }) => {
        if (pendingRef.current.has(`check:${payload.itemId}`)) return;
        setChecks((prev) => {
          const others = prev.filter((c) => c.itemId !== payload.itemId);
          return [
            ...others,
            {
              id: `remote-${payload.itemId}`,
              itemId: payload.itemId,
              checkedById: payload.checkedById,
              checkedByName: payload.checkedByName,
              checkedAt: payload.checkedAt,
            },
          ];
        });
      }
    );

    channel.bind("item-unchecked", (payload: { itemId: string }) => {
      if (pendingRef.current.has(`uncheck:${payload.itemId}`)) return;
      setChecks((prev) => prev.filter((c) => c.itemId !== payload.itemId));
    });

    channel.bind("template-changed", () => {
      refetchCurrent();
    });
    channel.bind("run-changed", () => {
      refetchCurrent();
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe("checklist-multimedia");
      pusher.disconnect();
    };
  }, [refetchCurrent]);

  const toggle = useCallback(
    async (itemId: string) => {
      if (!canCheck || !liveRun) return;
      const isChecked = checksByItem.has(itemId);

      if (isChecked) {
        pendingRef.current.add(`uncheck:${itemId}`);
        setChecks((prev) => prev.filter((c) => c.itemId !== itemId));
        try {
          const res = await fetch(`/api/checklist/items/${itemId}/check`, { method: "DELETE" });
          if (!res.ok) throw new Error("uncheck failed");
        } catch {
          setChecks((prev) => [
            ...prev,
            {
              id: `local-${itemId}`,
              itemId,
              checkedById: currentUserId ?? "",
              checkedByName: currentUserName ?? "you",
              checkedAt: new Date().toISOString(),
            },
          ]);
        } finally {
          pendingRef.current.delete(`uncheck:${itemId}`);
        }
      } else {
        pendingRef.current.add(`check:${itemId}`);
        const optimistic: Check = {
          id: `local-${itemId}`,
          itemId,
          checkedById: currentUserId ?? "",
          checkedByName: currentUserName ?? "you",
          checkedAt: new Date().toISOString(),
        };
        setChecks((prev) => [...prev.filter((c) => c.itemId !== itemId), optimistic]);
        try {
          const res = await fetch(`/api/checklist/items/${itemId}/check`, { method: "POST" });
          if (!res.ok) throw new Error("check failed");
        } catch {
          setChecks((prev) => prev.filter((c) => c.itemId !== itemId));
        } finally {
          pendingRef.current.delete(`check:${itemId}`);
        }
      }
    },
    [canCheck, liveRun, checksByItem, currentUserId, currentUserName]
  );

  if (!liveTemplate || !liveRun) {
    return (
      <div className="checklist-root">
        <ChecklistHeader currentUserName={currentUserName} canCheck={canCheck} />
        <div className="cl-container">
          <div className="cl-topbar">
            <div className="cl-brand">
              {"// multimedia.checklist "}
              <span>&middot; sunday service</span>
            </div>
            <div className="cl-status">
              <span className="cl-status-dot"></span>NO RUN
            </div>
          </div>
          <div className="cl-empty">
            No active checklist this week. The Multimedia head will open it for the upcoming Sunday.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={canCheck ? "checklist-root can-check" : "checklist-root"}>
      <ChecklistHeader currentUserName={currentUserName} canCheck={canCheck} />
      <div className="cl-container">
        <div className="cl-topbar">
          <div className="cl-brand">
            {"// multimedia.checklist "}
            <span>&middot; sunday service</span>
          </div>
          <div className="cl-status">
            <span className="cl-status-dot"></span>LIVE
          </div>
        </div>

        {canCheck && currentUserName ? (
          <div className="cl-signed-banner">
            SIGNED IN AS {currentUserName.toUpperCase()} &middot; MULTIMEDIA &middot; CAN CHECK
            ITEMS
          </div>
        ) : null}

        <div className="cl-hero">
          <h1>Sunday Setup Checklist</h1>
          <div className="cl-date">{formatManilaLongDate(liveRun.weekStart)}</div>
          <div className="cl-progress-row">
            <div className="cl-count">
              {complete} of {total} complete
            </div>
            <div className="cl-pct">{percent}%</div>
          </div>
          <div className="cl-progress-bar">
            <div className="cl-progress-fill" style={{ width: `${percent}%` }}></div>
          </div>
        </div>

        {liveTemplate.categories.map((cat) => {
          const catComplete = cat.items.filter((i) => checksByItem.has(i.id)).length;
          return (
            <div key={cat.id} className="cl-category">
              <div className="cl-cat-header">
                <span className="cl-cat-tag">[ {categoryTag(cat.name)} ]</span>
                <span className="cl-cat-title">{cat.name}</span>
                <span className="cl-cat-count">
                  {catComplete} / {cat.items.length}
                </span>
              </div>
              <div className="cl-items">
                {cat.items.map((item) => {
                  const check = checksByItem.get(item.id);
                  const isDone = Boolean(check);
                  return (
                    <div key={item.id} className={isDone ? "cl-item done" : "cl-item"}>
                      {canCheck ? (
                        <button
                          type="button"
                          className={isDone ? "cl-check done" : "cl-check"}
                          onClick={() => toggle(item.id)}
                          aria-label={isDone ? `Uncheck ${item.label}` : `Check ${item.label}`}
                        >
                          {isDone ? "✓" : ""}
                        </button>
                      ) : (
                        <div
                          className={isDone ? "cl-check done" : "cl-check"}
                          aria-label={isDone ? `${item.label} checked` : `${item.label} unchecked`}
                        >
                          {isDone ? "✓" : ""}
                        </div>
                      )}
                      <div className="cl-item-label">{item.label}</div>
                      <div className="cl-item-meta">
                        {check
                          ? `${check.checkedById === currentUserId ? "you" : check.checkedByName} · ${formatManilaTime(check.checkedAt)}`
                          : "—"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        <CelebrationOverlay runId={liveRun.id} active={is100} />
      </div>
    </div>
  );
}

// ============================================================================
// ChecklistHeader — top navigation bar shown above the public checklist page.
// Anonymous: minimal brand + Sign in link.
// Logged in: brand + user dropdown (Dashboard / My profile / Sign out).
// ============================================================================

function ChecklistHeader({
  currentUserName,
  canCheck,
}: {
  currentUserName: string | null;
  canCheck: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const initials = currentUserName
    ? currentUserName
        .split(/\s+/)
        .map((part) => part[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?";

  return (
    <header className="cl-header">
      <div className="cl-header-inner">
        <Link href="/checklist" className="cl-header-brand">
          <span className="cl-header-brand-prefix">{"//"}</span>
          <span className="cl-header-brand-name">Multimedia Checklist</span>
        </Link>

        {currentUserName ? (
          <div className="cl-user-menu" ref={ref}>
            <button
              type="button"
              className="cl-user-trigger"
              onClick={() => setOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={open}
            >
              <span className="cl-user-avatar" aria-hidden>
                {initials}
              </span>
              <span className="cl-user-name">{currentUserName}</span>
              <span className="cl-user-caret" aria-hidden>
                ▾
              </span>
            </button>
            {open ? (
              <div className="cl-user-dropdown" role="menu">
                <div className="cl-user-dropdown-meta">
                  Signed in{canCheck ? " · Multimedia" : ""}
                </div>
                <Link
                  href="/dashboard"
                  className="cl-user-dropdown-item"
                  onClick={() => setOpen(false)}
                  role="menuitem"
                >
                  Dashboard
                </Link>
                <Link
                  href="/dashboard/profile"
                  className="cl-user-dropdown-item"
                  onClick={() => setOpen(false)}
                  role="menuitem"
                >
                  My profile
                </Link>
                <button
                  type="button"
                  className="cl-user-dropdown-item cl-user-dropdown-signout"
                  onClick={() => {
                    setOpen(false);
                    signOut({ callbackUrl: "/login" });
                  }}
                  role="menuitem"
                >
                  Sign out
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <Link href="/login?callbackUrl=/checklist" className="cl-header-signin">
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
