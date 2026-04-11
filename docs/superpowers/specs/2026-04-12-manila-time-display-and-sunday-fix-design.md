# Manila Time Display & Sunday-of-Current-Week Fix — Design Spec

**Date:** 2026-04-12
**Status:** Approved in brainstorming, pending implementation plan
**Scope:** Two related fixes — (1) the multimedia checklist's "upcoming Sunday" calculation skips the current Sunday; (2) every UI date display uses the viewer's browser timezone instead of Manila. Both rolled into one cohesive spec because they both touch Manila timezone semantics.

---

## 1. Goal

The church operates entirely in Asia/Manila. Two user-facing problems make that fact invisible:

1. **The "Start new week" button on `/dashboard/multimedia-checklist` creates a run for the _next_ Sunday even when today is Sunday.** Today is Sunday April 12 in Manila; clicking the button should create the run for _today_ (April 12), not next Sunday (April 19). This is the recovery path when cron failed (e.g., right after a DB reset) and it should produce the obvious result.

2. **Every UI that displays a date renders it in the viewer's browser timezone**, not Manila. A volunteer in Manila sees Manila time (correct by accident); an admin viewing the dashboard from a US trip sees US time (confusing). The DB always stores UTC (correct); the display layer is where we need to force Manila.

Both fixed in one shipment. The Sunday fix is one line of logic; the display fix is a centralized helper file plus a mechanical sweep across 27 files.

---

## 2. Decisions locked during brainstorming

| Decision                         | Choice                                                                                                                                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sunday-of-current-week semantics | If today is Sunday (any time of day) → use today; otherwise → upcoming Sunday (1–6 days away)                                                                                                    |
| Function name                    | Rename `computeUpcomingSundayManila` → `computeCurrentWeekSundayManila` to match new semantics                                                                                                   |
| Cron behavior                    | Unchanged. Monday 03:00 cron always returns next Sunday (6 days), exactly as before                                                                                                              |
| Display fix approach             | Centralized helper file `lib/dates.ts` + sweep 27 call sites                                                                                                                                     |
| Helper function count            | Six: `formatManilaDate`, `formatManilaLongDate`, `formatManilaTime`, `formatManilaDateTime`, `formatManilaWeekdayDateTime`, `formatManilaRelative`                                               |
| Locale                           | `en-US` (matches existing codebase convention; Filipinos read both en-US and en-PH formats)                                                                                                      |
| Format unification               | Yes — sweep is a chance to standardize formats. The six helpers cover every format pattern found in the grep                                                                                     |
| Server-side use                  | The same helpers work in API routes, cron handlers, PDF generators, and notification body formatting (Intl.DateTimeFormat is universal in Node 18+ and modern browsers)                          |
| HTML `<input type="date">`       | **Deferred** — these are browser-local by spec and don't honor `timeZone`. For a Manila-based user the existing behavior is already correct. Edge case for traveling users; revisit if it bites. |

### Assumptions flagged

- **Locale stays `en-US`.** If you ever want `en-PH` formatting (e.g., DD/MM/YYYY ordering), one line in `lib/dates.ts` flips it for the whole app.
- **Six helpers are sufficient.** The grep covered every existing format pattern. New custom formats can be added to `lib/dates.ts`; raw `toLocaleString` calls in feature code are forbidden going forward.
- **No test runner.** Verification is `npm run check` + manual eyeballing of 3–4 representative pages after the sweep. The helpers are pure functions, easy to verify visually.

---

## 3. Sunday-of-current-week fix

### 3.1 The change

In `lib/checklist.ts`, replace lines 60–67 of `computeUpcomingSundayManila`:

```ts
// OLD
let daysToAdd: number;
if (day === 0 && parts.hour === 0 && parts.minute === 0 && parts.second === 0) {
  daysToAdd = 0;
} else {
  daysToAdd = (7 - day) % 7;
  if (daysToAdd === 0) daysToAdd = 7; // today is Sunday but past 00:00 → next Sunday
}
```

with:

```ts
// NEW
// "Sunday of the current week":
//   - If today is Sunday (any time of day) → use today
//   - If today is Mon–Sat → use the upcoming Sunday (1–6 days away)
const daysToAdd = day === 0 ? 0 : 7 - day;
```

### 3.2 Function rename

Rename `computeUpcomingSundayManila` to `computeCurrentWeekSundayManila`. The old name described "upcoming Sunday >= now" semantics; the new name matches the new behavior. Also update the JSDoc:

```ts
/**
 * Compute the Sunday of the current week in Asia/Manila, truncated to 00:00:00.
 * Returns a UTC Date whose wall-clock equivalent in Asia/Manila is Sunday 00:00.
 *
 * Logic:
 *   - If today is Sunday (any time of day) → today
 *   - If today is Mon–Sat → the upcoming Sunday (1–6 days away)
 *
 * Cron usage: cron runs Monday 03:00 Manila and gets the upcoming Sunday
 * (6 days away, the next service day). Manual "Start new week" button on
 * Sunday gets today; on any other day gets the upcoming Sunday.
 */
export function computeCurrentWeekSundayManila(now: Date = new Date()): Date {
  // ... new logic
}
```

### 3.3 Call-site updates

Three files import or call the renamed function:

- `lib/checklist.ts` — the function declaration itself + any internal use
- `app/api/checklist/runs/start/route.ts` — manual "Start new week" handler
- `app/api/cron/checklist-reset/route.ts` — cron handler

Update both the import line and the call site in each file.

### 3.4 Behavior verification table

| Now (Manila wall clock)            | Old result         | New result                          |
| ---------------------------------- | ------------------ | ----------------------------------- |
| Sunday 00:00                       | today              | today (same)                        |
| **Sunday 09:00 (the user's case)** | next Sunday Apr 19 | **today Apr 12 ✓**                  |
| Sunday 23:59                       | next Sunday        | today                               |
| Monday 00:00                       | next Sunday (6d)   | next Sunday (6d)                    |
| Monday 03:00 (cron)                | next Sunday (6d)   | next Sunday (6d) (cron unchanged ✓) |
| Saturday 23:59                     | tomorrow (Sunday)  | tomorrow (Sunday)                   |

### 3.5 Cron stale-run detection

The cron's "close stale runs" branch checks `run.weekStart < startOfTodayManila()`. Under the new rule, an open run for Sunday Apr 12 has `weekStart = Apr 12 00:00 Manila`. On Monday Apr 13 03:00 cron, `startOfTodayManila = Apr 13 00:00`. `Apr 12 < Apr 13` → close it. ✓ Sunday's run still gets closed by cron Monday morning. **No change to cron logic needed.**

### 3.6 What about manual close on Sunday?

User clicks "Close current week" Sunday afternoon. The `POST /api/checklist/runs/close` route just closes whatever open run exists. The run closes; the next "Start new week" click would re-create the same Sunday's run (since today is still Sunday). That's fine — the unique constraint `(templateId, weekStart)` would actually reject re-creation. So clicking close-then-start on Sunday produces a 409. Acceptable; admin would just leave the closed run alone and the cron will create next week's run on Monday.

---

## 4. Manila display helpers

### 4.1 New file: `lib/dates.ts`

```ts
/**
 * Manila-timezone date formatting helpers.
 *
 * Use these EVERYWHERE we render a date to a user. The DB always stores UTC;
 * these helpers convert to Manila wall-clock time on output. Never call
 * toLocaleString / toLocaleDateString / toLocaleTimeString directly in feature
 * code — use these instead so the timezone is impossible to forget.
 */

const TZ = "Asia/Manila";
const LOCALE = "en-US";

function toDate(value: Date | string): Date {
  return typeof value === "string" ? new Date(value) : value;
}

/** "Apr 12, 2026" — short date for tables, lists, compact displays. */
export function formatManilaDate(value: Date | string): string {
  return toDate(value).toLocaleDateString(LOCALE, {
    timeZone: TZ,
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

/** "Sunday, April 12, 2026" — long date for headlines and important contexts. */
export function formatManilaLongDate(value: Date | string): string {
  return toDate(value).toLocaleDateString(LOCALE, {
    timeZone: TZ,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** "07:30 AM" — 12-hour time only, for timestamps in activity feeds. */
export function formatManilaTime(value: Date | string): string {
  return toDate(value).toLocaleTimeString(LOCALE, {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/** "Apr 12, 2026 · 07:30 AM" — combined date + time for notifications, audit. */
export function formatManilaDateTime(value: Date | string): string {
  return `${formatManilaDate(value)} · ${formatManilaTime(value)}`;
}

/** "Sun, Apr 12 · 07:30 AM" — compact date+time with weekday for stat cards. */
export function formatManilaWeekdayDateTime(value: Date | string): string {
  const d = toDate(value);
  const datePart = d.toLocaleDateString(LOCALE, {
    timeZone: TZ,
    weekday: "short",
    month: "short",
    day: "2-digit",
  });
  const timePart = formatManilaTime(d);
  return `${datePart} · ${timePart}`;
}

/** "2 hours ago", "yesterday", "3 days ago" — relative time for "Submitted X ago". */
export function formatManilaRelative(value: Date | string): string {
  const d = toDate(value);
  const now = Date.now();
  const diffMs = now - d.getTime();
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.round(hr / 24);
  if (day === 1) return "yesterday";
  if (day < 7) return `${day} days ago`;
  // Older than a week — fall through to absolute date
  return formatManilaDate(d);
}
```

### 4.2 Format catalog

| Helper                        | Output                    | Use case                                 |
| ----------------------------- | ------------------------- | ---------------------------------------- |
| `formatManilaDate`            | `Apr 12, 2026`            | Table cells, list rows                   |
| `formatManilaLongDate`        | `Sunday, April 12, 2026`  | Page headers, hero sections              |
| `formatManilaTime`            | `07:30 AM`                | Activity feed timestamps, history detail |
| `formatManilaDateTime`        | `Apr 12, 2026 · 07:30 AM` | Notifications, audit trails, PDFs        |
| `formatManilaWeekdayDateTime` | `Sun, Apr 12 · 07:30 AM`  | Stat cards (e.g. "Opened: Sun 07:30")    |
| `formatManilaRelative`        | `2 hours ago`             | "Submitted X ago" (pending users tab)    |

### 4.3 Sweep — 27 files

Every file currently calling `toLocaleString`, `toLocaleDateString`, or `toLocaleTimeString`. Each gets:

1. New import: `import { formatManila* } from "@/lib/dates";`
2. Replace inline formatting calls with the appropriate helper

**Client components (15 files):**

- `features/arf/ARFTableClient.tsx`
- `features/prf/PRFTableClient.tsx`
- `features/lineup/LineupTableClient.tsx`
- `features/prayer/PrayerTableClient.tsx`
- `features/users/UsersTableClient.tsx`
- `features/notifications/NotificationsTableClient.tsx`
- `features/calendar/CalendarView.tsx`
- `features/checklist/HistoryRunsTable.tsx`
- `features/checklist/HistoryPeopleTable.tsx`
- `features/checklist/RunDrillDown.tsx`
- `features/checklist/ChecklistPublicClient.tsx`
- `features/checklist/ChecklistLandingClient.tsx`
- `components/ApprovalHistoryTimeline.tsx`
- `components/ui/NotificationItem.tsx`
- `app/(dashboard)/dashboard/lineup/[id]/LineupDetailClient.tsx`

**Server pages (5 files):**

- `app/page.tsx` (landing/marketing if any timestamp displayed)
- `app/(dashboard)/dashboard/page.tsx` (dashboard index — recent activity)
- `app/(dashboard)/dashboard/lineup/[id]/page.tsx`
- `app/(dashboard)/dashboard/forms/arf/[id]/page.tsx`
- `app/(dashboard)/dashboard/forms/prf/[id]/page.tsx`

**Server-side API routes / text generation (7 files):**

- `app/api/forms/arf/[id]/pdf/route.ts` (PDF body — `jsPDF`)
- `app/api/forms/prf/[id]/pdf/route.ts` (PDF body — `jsPDF`)
- `app/api/cron/reminders/route.ts` (email body for SendGrid)
- `app/api/cron/checklist-reset/route.ts` (notification body)
- `app/api/checklist/runs/close/route.ts` (notification body)
- `app/api/lineup/[id]/instruments/route.ts` (notification body)
- `app/api/lineup/[id]/singers/route.ts` (notification body)

The helpers work in all three contexts. Node 18+ ships full ICU with `Intl.DateTimeFormat` timezone support.

### 4.4 Mechanical replacement guide

Each existing call site is one of these patterns:

| Existing inline format                                                                              | Replace with                                                                                          |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })`                 | `formatManilaDate(d)`                                                                                 |
| `.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })` | `formatManilaLongDate(d)`                                                                             |
| `.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })`                              | `formatManilaTime(d)`                                                                                 |
| `.toLocaleString("en-US", { ... })` for any combined date+time                                      | `formatManilaDateTime(d)`                                                                             |
| `.toLocaleString("en-US", { weekday: "short", hour: "2-digit", minute: "2-digit" })`                | `formatManilaWeekdayDateTime(d)`                                                                      |
| One-off custom format that doesn't fit any helper                                                   | Add `timeZone: "Asia/Manila"` to the inline call AND leave a `// TODO: consider lib/dates.ts` comment |

The fall-through case should be rare. If it shows up more than 2–3 times during the sweep, that's a signal to add a 7th helper.

### 4.5 Lint guard for future code

Add an ESLint rule (or just a code-review convention documented in CLAUDE.md) forbidding raw `toLocaleString` / `toLocaleDateString` / `toLocaleTimeString` outside `lib/dates.ts` itself. For v1 a CLAUDE.md note is sufficient; the ESLint rule is a follow-up if recurrence happens.

### 4.6 What this does NOT touch

- **HTML `<input type="date">` form inputs.** These don't honor `timeZone` per the HTML spec. They store `YYYY-MM-DD` as a local-interpreted string. For a Manila-based user the existing behavior is already correct. Edge case for traveling users; revisit if it bites.
- **Database `Date` column reads.** Prisma returns `Date` objects which are absolute UTC instants. The display layer is where we apply timezone — at the very last step.
- **ISO strings in API responses.** They stay UTC ISO. The client deserializes with `new Date(iso)` and feeds the result to the helper.
- **JWT/session timestamps.** NextAuth handles these internally.

---

## 5. Verification

No test runner. Verification is `npm run check` + manual eyeballing.

### 5.1 Automated

```bash
npm run check
```

Must pass type-check, lint, and format.

### 5.2 Manual verification — Sunday fix

1. Ensure today is Sunday (or temporarily override the system clock if not). With the DB freshly seeded:
2. Sign in as admin
3. Navigate to `/dashboard/multimedia-checklist`
4. Click "Start new week"
5. Verify the new run's `weekStart` is **today** (the current Sunday), not next Sunday
6. Check the dashboard hero card displays today's date as the run's week
7. Click "Close current week" — verify it closes
8. Click "Start new week" again — verify it's a 409 (run already exists for this week)

### 5.3 Manual verification — Manila display sweep

For each of these surfaces, eyeball that the rendered timestamp matches Manila wall-clock time regardless of where you are:

- `/checklist` (public) — item check timestamps in the right margin
- `/dashboard/multimedia-checklist` — recent activity card, "Opened" stat
- `/dashboard/multimedia-checklist/history` — runs table date column, drill-down timestamps
- `/dashboard/users?tab=pending` — "Submitted" relative time
- `/dashboard/users` — any timestamps in user rows
- `/dashboard/forms/arf` — created/updated dates
- `/dashboard/forms/prf` — same
- `/dashboard/lineup` — event dates
- `/dashboard/calendar` — calendar grid (events should show Manila wall-clock dates)
- `/dashboard/notifications` — notification timestamps
- ARF/PRF PDF — open one and verify the rendered date is Manila

The fastest check: temporarily change your system timezone to e.g. America/New_York and reload `/dashboard/multimedia-checklist`. Manila times should remain Manila — not shift backward 13 hours.

### 5.4 Cron verification

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/checklist-reset
```

On any day, the cron should still create a run for the upcoming Sunday (or do nothing if a run already exists). The cron's behavior is unchanged by this rework — verify by checking the returned `started` field is non-null on the first call and null on the second.

---

## 6. Out of scope / deferred

- **HTML `<input type="date">` standardization.** As §4.6 notes, browser date inputs are local-interpreted and don't honor `timeZone`. A "force Manila" fix would require replacing native date inputs with custom React date pickers — large effort, low value for v1.
- **ESLint rule forbidding raw `toLocaleString`.** Documented as a CLAUDE.md convention for v1; promote to enforced rule if the sweep regresses.
- **`en-PH` locale formatting.** Currently `en-US` everywhere. Switching is a one-line change in `lib/dates.ts` if you want DD/MM/YYYY ordering or other PH conventions.
- **Internationalization beyond Manila.** This whole spec assumes single-timezone deployment. If the church ever serves multiple regions, the helper would take a `timeZone` parameter; for v1, hardcoded.
- **Date math** (e.g., "this week's events", "events between two dates"). The Sunday helper covers the only critical date-math case. Other date-math sites continue to use raw `Date` arithmetic which operates in UTC and is correct.

---

## 7. Out of caution — risks worth knowing

1. **`Intl.DateTimeFormat` requires full ICU.** Node 18+ ships with full ICU by default; modern browsers all have it. If the deployment ever uses a stripped-down Node build (e.g., `--with-intl=small-icu`), Manila timezone resolution would fall back to UTC and produce wrong output. Vercel and standard Node 18+/20+ are fine. Flag for any non-standard deployment.
2. **`formatManilaRelative` uses `Date.now()`** — a moving target. Two consecutive renders 5 seconds apart would produce slightly different "minutes ago" strings. Acceptable for activity feeds; if it ever feels janky, throttle the parent component's re-renders.
3. **PDF rendering is server-side and runs in the deployment timezone.** Adding the helper to PDF routes ensures Manila output regardless of where the function runs. If Vercel's regions ever change or `TZ` env var isn't set, the helper still produces Manila — that's its whole point.
