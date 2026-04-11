# Manila Time Display & Sunday-of-Current-Week Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the multimedia checklist's "upcoming Sunday" calculation so it returns the current Sunday when today is Sunday, and force every UI date display in the app to render in Asia/Manila timezone regardless of viewer location.

**Architecture:** Two coordinated changes — (1) a 1-line semantic fix in `lib/checklist.ts` plus a function rename, and (2) a new centralized `lib/dates.ts` formatting helper file paired with a mechanical sweep of 27 source files that currently call `toLocaleString` / `toLocaleDateString` / `toLocaleTimeString` without timezone awareness.

**Tech Stack:** TypeScript strict, Next.js 16 App Router, `Intl.DateTimeFormat` (universal in Node 18+ and modern browsers), no new dependencies.

**Source spec:** [docs/superpowers/specs/2026-04-12-manila-time-display-and-sunday-fix-design.md](../specs/2026-04-12-manila-time-display-and-sunday-fix-design.md) — canonical reference.

---

## Codebase conventions

### No test runner

There is no test runner configured. Verification is `npm run check` (type-check + lint + format:check) plus manual eyeballing of representative pages. Do not invent `npm test`. Do not write unit tests.

### No auto-commits

Per [CLAUDE.md](../../../CLAUDE.md), **never run `git commit`, `git push`, or create PRs**. At every "commit" step:

1. Run `git status` to show changed files
2. Report the prepared commit message verbatim
3. **Stop and wait** for the user to commit manually

### Windows bash shell

Working directory: `d:/Jonathan Codes 2/mndbd`. Use forward slashes. `/dev/null` not `NUL`.

### DB state warning

The Neon dev DB may currently be missing tables (from an earlier interrupted reset). Tasks 1–4 do NOT require a working DB — they're pure code changes. If verification needs a working DB at the end, run `npm run db:refresh` (with the user's explicit consent for the dangerous-action env var).

---

## File structure — what changes

### New file

- `lib/dates.ts` — six exported formatting helpers, all hardcoding `timeZone: "Asia/Manila"`

### Modified — Sunday fix (3 files)

- `lib/checklist.ts` — replace logic in `computeUpcomingSundayManila` and rename it to `computeCurrentWeekSundayManila`
- `app/api/checklist/runs/start/route.ts` — update import and call site
- `app/api/cron/checklist-reset/route.ts` — update import and call site

### Modified — display sweep (27 files)

**Client components (15):**

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

**Server pages (5):**

- `app/page.tsx`
- `app/(dashboard)/dashboard/page.tsx`
- `app/(dashboard)/dashboard/lineup/[id]/page.tsx`
- `app/(dashboard)/dashboard/forms/arf/[id]/page.tsx`
- `app/(dashboard)/dashboard/forms/prf/[id]/page.tsx`

**Server-side API routes / text generation (7):**

- `app/api/forms/arf/[id]/pdf/route.ts`
- `app/api/forms/prf/[id]/pdf/route.ts`
- `app/api/cron/reminders/route.ts`
- `app/api/cron/checklist-reset/route.ts`
- `app/api/checklist/runs/close/route.ts`
- `app/api/lineup/[id]/instruments/route.ts`
- `app/api/lineup/[id]/singers/route.ts`

### Doc update

- `CLAUDE.md` — add a one-line code-convention note forbidding raw `toLocaleString` outside `lib/dates.ts`

---

## Task breakdown (5 tasks)

1. **Task 1** — Sunday fix in `lib/checklist.ts` + function rename + update 2 call sites
2. **Task 2** — Create `lib/dates.ts` with six formatting helpers
3. **Task 3** — Sweep all 27 files (replace inline `toLocaleString*` with helpers)
4. **Task 4** — Update `CLAUDE.md` with the date-formatting convention note
5. **Task 5** — Final verification (`npm run check` + spot-check pages in browser)

---

## Task 1: Sunday-of-current-week fix

**Files:**

- Modify: `lib/checklist.ts`
- Modify: `app/api/checklist/runs/start/route.ts`
- Modify: `app/api/cron/checklist-reset/route.ts`

- [ ] **Step 1: Replace the function body in `lib/checklist.ts`**

Open `lib/checklist.ts`. Find `computeUpcomingSundayManila` (around line 55). Replace the entire function with:

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
  const parts = getManilaParts(now);
  // Build a Date from the Manila wall-clock via UTC so system TZ doesn't matter.
  const manilaMidnightUtc = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0));
  const day = manilaMidnightUtc.getUTCDay(); // 0 = Sunday
  // "Sunday of the current week":
  //   - If today is Sunday → 0 days
  //   - If today is Mon–Sat → 1..6 days to upcoming Sunday
  const daysToAdd = day === 0 ? 0 : 7 - day;
  // Start from Manila midnight-today, add days, then convert to UTC instant.
  const targetUtcWallClock = new Date(manilaMidnightUtc);
  targetUtcWallClock.setUTCDate(targetUtcWallClock.getUTCDate() + daysToAdd);
  // targetUtcWallClock holds the Manila wall-clock values as if they were UTC.
  // The actual UTC instant for Manila 00:00 is wallClock - 8h.
  return new Date(
    targetUtcWallClock.getTime() - getManilaOffsetMinutes(targetUtcWallClock) * 60 * 1000
  );
}
```

Note: function name changed from `computeUpcomingSundayManila` to `computeCurrentWeekSundayManila`. The body is mostly the same but the `if/else` for `daysToAdd` is replaced with the single ternary.

- [ ] **Step 2: Update `app/api/checklist/runs/start/route.ts`**

Find the import:

```ts
import { getMultimediaMinistryId, computeUpcomingSundayManila } from "@/lib/checklist";
```

Replace with:

```ts
import { getMultimediaMinistryId, computeCurrentWeekSundayManila } from "@/lib/checklist";
```

Then find the call site (one occurrence):

```ts
const weekStart = computeUpcomingSundayManila();
```

Replace with:

```ts
const weekStart = computeCurrentWeekSundayManila();
```

- [ ] **Step 3: Update `app/api/cron/checklist-reset/route.ts`**

Find the import:

```ts
import {
  getMultimediaMinistryId,
  computeUpcomingSundayManila,
  startOfTodayManila,
} from "@/lib/checklist";
```

Replace with:

```ts
import {
  getMultimediaMinistryId,
  computeCurrentWeekSundayManila,
  startOfTodayManila,
} from "@/lib/checklist";
```

Then find the call site (one occurrence):

```ts
const upcoming = computeCurrentWeekSundayManila();
```

(Or whatever variable it's assigned to — preserve the existing variable name.)

The cron's behavior is unchanged: on Monday `day === 1`, so `daysToAdd = 6`, target is next Sunday. Same as before. The only behavior that changes is the manual button on Sunday.

- [ ] **Step 4: Grep for any remaining references**

```bash
grep -rn "computeUpcomingSundayManila" app/ lib/ features/ components/
```

Expected: zero hits. If anything remains, fix it.

- [ ] **Step 5: Type-check + lint**

```bash
npm run type-check && npm run lint
```

Expected: zero errors related to this rename. (Other errors may exist if the DB is broken — those are unrelated to this task.)

- [ ] **Step 6: Prepare commit (do not run)**

Run `git status --short` and report this commit message:

```
fix(checklist): use current week's Sunday when today is Sunday

The "Start new week" button used to advance to next Sunday even when
today was Sunday, leaving today's run uncreated. Now: if today is
Sunday (any time of day), use today; otherwise use the upcoming Sunday.
Cron behavior is unchanged (Monday 03:00 still creates next Sunday's
run, 6 days away).

Renames computeUpcomingSundayManila → computeCurrentWeekSundayManila to
match the new semantics. Updates the 2 call sites.
```

Stop for user review.

---

## Task 2: Create `lib/dates.ts` helpers

**Files:**

- Create: `lib/dates.ts`

- [ ] **Step 1: Create the file**

Create `lib/dates.ts` with exactly this content:

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

- [ ] **Step 2: Sanity-check via inline script**

```bash
npx tsx -e "const m = require('./lib/dates'); const d = new Date('2026-04-12T01:30:00.000Z'); console.log('date:', m.formatManilaDate(d)); console.log('long:', m.formatManilaLongDate(d)); console.log('time:', m.formatManilaTime(d)); console.log('datetime:', m.formatManilaDateTime(d)); console.log('weekday:', m.formatManilaWeekdayDateTime(d)); console.log('relative:', m.formatManilaRelative(new Date(Date.now() - 2*60*60*1000)));"
```

Expected output (the input UTC time `2026-04-12T01:30:00.000Z` is `2026-04-12 09:30 Asia/Manila`):

```
date: Apr 12, 2026
long: Sunday, April 12, 2026
time: 09:30 AM
datetime: Apr 12, 2026 · 09:30 AM
weekday: Sun, Apr 12 · 09:30 AM
relative: 2 hours ago
```

If outputs don't match exactly, the formats need adjusting before the sweep — fix and re-verify before moving on.

- [ ] **Step 3: Type-check + lint**

```bash
npm run type-check && npm run lint
```

Expected: clean for `lib/dates.ts` itself.

- [ ] **Step 4: Prepare commit**

```
feat(dates): add lib/dates.ts Manila timezone formatting helpers

Six exported helpers (formatManilaDate, formatManilaLongDate,
formatManilaTime, formatManilaDateTime, formatManilaWeekdayDateTime,
formatManilaRelative) all hardcoding timeZone: "Asia/Manila".
Use these everywhere we render a date so the timezone is impossible
to forget.
```

Stop for user review.

---

## Task 3: Sweep — replace inline toLocaleString with helpers

**Files:** 27 files listed in the file structure section above.

This task is the bulk of the work. Mechanical sweep — same pattern in every file.

### The sweep pattern

For each file:

1. Add an import at the top:

```ts
import {
  formatManilaDate,
  formatManilaLongDate,
  formatManilaTime,
  formatManilaDateTime,
  formatManilaWeekdayDateTime,
  formatManilaRelative,
} from "@/lib/dates";
```

(Only import the helpers actually used in that file.)

2. Find every `.toLocaleDateString(`, `.toLocaleTimeString(`, `.toLocaleString(` call. Replace with the appropriate helper per the table below.

3. Delete any `formatTime` / `formatDateLabel` / `formatHHMM` local helper functions in the file that wrapped the now-replaced calls — they're redundant. Update their call sites to use the new helper directly.

### Replacement table

| Existing inline pattern                                                                                                                                                                        | Replace with                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })`                                                                                                            | `formatManilaDate(value)`            |
| `.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })`                                                                                            | `formatManilaLongDate(value)`        |
| `.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })`                                                                                                                         | `formatManilaTime(value)`            |
| `.toLocaleString("en-US", { weekday: "short", hour: "2-digit", minute: "2-digit" })`                                                                                                           | `formatManilaWeekdayDateTime(value)` |
| `.toLocaleString("en-US", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" })`                                                                                             | `formatManilaDateTime(value)`        |
| Any other custom format that doesn't fit → keep the inline call but **add `timeZone: "Asia/Manila"` to the options object**. Document with a comment: `// custom format — not in lib/dates.ts` | (inline + timezone)                  |

### Per-file sweep checklist

- [ ] **Step 1: `features/arf/ARFTableClient.tsx`** — apply pattern
- [ ] **Step 2: `features/prf/PRFTableClient.tsx`** — apply pattern
- [ ] **Step 3: `features/lineup/LineupTableClient.tsx`** — apply pattern
- [ ] **Step 4: `features/prayer/PrayerTableClient.tsx`** — apply pattern
- [ ] **Step 5: `features/users/UsersTableClient.tsx`** — apply pattern. The "Submitted" column on the Pending tab should use `formatManilaRelative` (currently shows absolute time). Confirm with the user before changing semantics if you're unsure.
- [ ] **Step 6: `features/notifications/NotificationsTableClient.tsx`** — apply pattern
- [ ] **Step 7: `features/calendar/CalendarView.tsx`** — apply pattern. Calendar grid rendering may have multiple date format calls.
- [ ] **Step 8: `features/checklist/HistoryRunsTable.tsx`** — apply pattern
- [ ] **Step 9: `features/checklist/HistoryPeopleTable.tsx`** — apply pattern
- [ ] **Step 10: `features/checklist/RunDrillDown.tsx`** — apply pattern. The page header date uses `formatManilaLongDate`; item check timestamps use `formatManilaTime`.
- [ ] **Step 11: `features/checklist/ChecklistPublicClient.tsx`** — apply pattern. Delete the local `formatHHMM` and `formatDateLabel` helpers; replace with `formatManilaTime` and `formatManilaLongDate`.
- [ ] **Step 12: `features/checklist/ChecklistLandingClient.tsx`** — apply pattern. The "Opened" stat card uses `formatManilaWeekdayDateTime`; the recent activity timestamps use `formatManilaTime`.
- [ ] **Step 13: `components/ApprovalHistoryTimeline.tsx`** — apply pattern
- [ ] **Step 14: `components/ui/NotificationItem.tsx`** — apply pattern. Notification timestamps use `formatManilaDateTime` or `formatManilaRelative` depending on the existing display.
- [ ] **Step 15: `app/(dashboard)/dashboard/lineup/[id]/LineupDetailClient.tsx`** — apply pattern
- [ ] **Step 16: `app/page.tsx`** — apply pattern (if it has any date display; if not, skip)
- [ ] **Step 17: `app/(dashboard)/dashboard/page.tsx`** — apply pattern
- [ ] **Step 18: `app/(dashboard)/dashboard/lineup/[id]/page.tsx`** — apply pattern
- [ ] **Step 19: `app/(dashboard)/dashboard/forms/arf/[id]/page.tsx`** — apply pattern
- [ ] **Step 20: `app/(dashboard)/dashboard/forms/prf/[id]/page.tsx`** — apply pattern
- [ ] **Step 21: `app/api/forms/arf/[id]/pdf/route.ts`** — apply pattern. PDF generation runs server-side; the helper still works (Intl.DateTimeFormat is universal).
- [ ] **Step 22: `app/api/forms/prf/[id]/pdf/route.ts`** — apply pattern
- [ ] **Step 23: `app/api/cron/reminders/route.ts`** — apply pattern. Email body strings use `formatManilaDateTime`.
- [ ] **Step 24: `app/api/cron/checklist-reset/route.ts`** — apply pattern. The notification body's `dateLabel` uses `formatManilaDate`.
- [ ] **Step 25: `app/api/checklist/runs/close/route.ts`** — apply pattern. Same `dateLabel` usage.
- [ ] **Step 26: `app/api/lineup/[id]/instruments/route.ts`** — apply pattern (notification body)
- [ ] **Step 27: `app/api/lineup/[id]/singers/route.ts`** — apply pattern (notification body)

### Verification after the sweep

- [ ] **Step 28: Final grep — confirm no inline toLocaleString calls remain**

```bash
grep -rn "toLocaleString\|toLocaleDateString\|toLocaleTimeString" app/ features/ components/ lib/ --include="*.ts" --include="*.tsx"
```

Expected: only one hit, in `lib/dates.ts` itself (where the helpers wrap the underlying API). Anything else is a missed file — go back and fix.

If a hit shows up in `lib/dates.ts` is fine; that's the helper file by design.

- [ ] **Step 29: Type-check + lint + format**

```bash
npm run check
```

Expected: clean for everything related to this sweep.

- [ ] **Step 30: Prepare commit**

```
refactor: replace inline toLocaleString with lib/dates helpers (27 files)

Sweep every client component, server page, and server-side API route
that previously called toLocaleString / toLocaleDateString /
toLocaleTimeString directly. Each call is now routed through the
formatManila* helpers from lib/dates.ts so the timezone is impossible
to forget. Format conventions standardized across the app.
```

Stop for user review.

---

## Task 4: Add code-convention note to CLAUDE.md

**Files:**

- Modify: `CLAUDE.md`

- [ ] **Step 1: Read the existing "Code conventions" section**

Open `CLAUDE.md` and find the section starting with `## Code conventions`. There's a list of bullets covering TypeScript strict, React Compiler, path aliases, Prettier, styling, etc.

- [ ] **Step 2: Append a new bullet about date formatting**

After the existing bullets in the "Code conventions" section (or at a sensible location near the styling/conventions block), add:

```markdown
- **Date formatting**: never call `toLocaleString` / `toLocaleDateString` / `toLocaleTimeString` directly. Use the helpers in [lib/dates.ts](lib/dates.ts) (`formatManilaDate`, `formatManilaTime`, `formatManilaDateTime`, etc.) which hardcode `timeZone: "Asia/Manila"`. The DB stores UTC; these helpers convert to Manila wall-clock time at the display layer. Adding a raw `toLocaleString` call anywhere outside `lib/dates.ts` is a bug — it'll render in the viewer's browser timezone, not Manila.
```

- [ ] **Step 3: Verify**

```bash
grep -n "lib/dates" CLAUDE.md
```

Expected: at least one match in the new bullet.

- [ ] **Step 4: Prepare commit**

```
docs(CLAUDE): forbid raw toLocaleString outside lib/dates.ts

Code-convention note added to the "Code conventions" section: every
date display must go through the formatManila* helpers in lib/dates.ts
so the Asia/Manila timezone is impossible to forget.
```

Stop for user review.

---

## Task 5: Final verification

**Files:** None modified — verification gate.

- [ ] **Step 1: `npm run check` — fully clean**

```bash
npm run check
```

Expected: zero errors across type-check, lint, and format. If errors remain, they're stragglers from Tasks 1–3 that need fixing before this task can pass.

- [ ] **Step 2: Verify the helper math via inline script (from a fresh process)**

```bash
npx tsx -e "const {formatManilaDate, formatManilaTime, formatManilaLongDate, formatManilaDateTime, formatManilaWeekdayDateTime, formatManilaRelative} = require('./lib/dates'); const utcMidnight = new Date('2026-04-12T16:00:00.000Z'); console.log('weekStart instant:', utcMidnight.toISOString()); console.log('formatManilaDate:', formatManilaDate(utcMidnight)); console.log('formatManilaLongDate:', formatManilaLongDate(utcMidnight)); const morning = new Date('2026-04-12T01:30:00.000Z'); console.log('formatManilaTime (morning):', formatManilaTime(morning)); console.log('formatManilaDateTime:', formatManilaDateTime(morning)); console.log('formatManilaWeekdayDateTime:', formatManilaWeekdayDateTime(morning));"
```

Expected:

```
weekStart instant: 2026-04-12T16:00:00.000Z
formatManilaDate: Apr 13, 2026
formatManilaLongDate: Monday, April 13, 2026
formatManilaTime (morning): 09:30 AM
formatManilaDateTime: Apr 12, 2026 · 09:30 AM
formatManilaWeekdayDateTime: Sun, Apr 12 · 09:30 AM
```

Note: `2026-04-12T16:00:00Z` is `2026-04-13 00:00 Manila` (Monday) — verifying that the helper correctly translates a UTC instant to Manila wall-clock. The morning instant `2026-04-12T01:30:00Z` is `2026-04-12 09:30 Manila` (Sunday).

- [ ] **Step 3: Verify the Sunday function via inline script**

```bash
npx tsx -e "const {computeCurrentWeekSundayManila} = require('./lib/checklist'); function test(utcStr, label) { const r = computeCurrentWeekSundayManila(new Date(utcStr)); console.log(label, '->', r.toISOString(), '(Manila:', new Date(r.toLocaleString('en-US',{timeZone:'Asia/Manila'})).toString().slice(0,15), ')'); } test('2026-04-11T16:00:00.000Z', 'Sun 00:00 Manila'); test('2026-04-12T01:30:00.000Z', 'Sun 09:30 Manila'); test('2026-04-12T15:59:00.000Z', 'Sun 23:59 Manila'); test('2026-04-12T16:00:00.000Z', 'Mon 00:00 Manila'); test('2026-04-12T19:00:00.000Z', 'Mon 03:00 Manila (cron)'); test('2026-04-11T15:59:00.000Z', 'Sat 23:59 Manila');"
```

Expected:

- `Sun 00:00 Manila` → returns `2026-04-11T16:00:00.000Z` (today, Sun Apr 12 Manila)
- `Sun 09:30 Manila` → returns `2026-04-11T16:00:00.000Z` (today, Sun Apr 12 Manila)
- `Sun 23:59 Manila` → returns `2026-04-11T16:00:00.000Z` (today, Sun Apr 12 Manila)
- `Mon 00:00 Manila` → returns `2026-04-18T16:00:00.000Z` (next Sun, Apr 19 Manila)
- `Mon 03:00 Manila (cron)` → returns `2026-04-18T16:00:00.000Z` (next Sun, Apr 19 Manila)
- `Sat 23:59 Manila` → returns `2026-04-11T16:00:00.000Z` (tomorrow, Sun Apr 12 Manila)

If any output doesn't match, Task 1 has a bug — go back and fix.

- [ ] **Step 4: If the dev DB is broken, optionally run db:refresh**

The Neon dev DB may have no tables from an earlier interrupted reset. To run the manual browser walkthrough below, you need a working DB. If `npm run dev` errors with "Ministry table doesn't exist" or similar, run:

```bash
PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="Final verification reset" npx prisma migrate reset --force --skip-seed && npm run db:seed
```

This is a destructive action on the dev DB — only run with explicit user confirmation. Skip this step if the DB is already healthy.

- [ ] **Step 5: Manual browser walkthrough**

Start the dev server:

```bash
npm run dev
```

Use `run_in_background: true`. Poll until ready, then sign in as admin.

Test scenarios:

**A. Sunday fix verification:**

1. Navigate to `/dashboard/multimedia-checklist`
2. If a run is already open, click "Close current week" first
3. Click "Start new week"
4. Verify the new run's `weekStart` field matches today's date (when today is Sunday in Manila)
5. The displayed date in the dashboard hero card should be today, not next Sunday

**B. Manila display verification:**

1. Open browser devtools → Console
2. Check the system timezone with `Intl.DateTimeFormat().resolvedOptions().timeZone` (note what it is for reference)
3. Navigate to these pages and confirm the displayed timestamps are in Manila wall-clock time:
   - `/checklist` (public) — item check timestamps
   - `/dashboard/multimedia-checklist` — recent activity, "Opened" stat card
   - `/dashboard/multimedia-checklist/history` — runs table date column
   - `/dashboard/multimedia-checklist/history/[runId]` — drill-down date header and check timestamps
   - `/dashboard/users?tab=pending` — submitted timestamps (should be relative now if Step 5 of Task 3 was applied)
   - `/dashboard/forms/arf` — list dates
   - `/dashboard/notifications` — notification timestamps
   - `/dashboard/lineup` — event dates
   - `/dashboard/calendar` — calendar grid

**C. Timezone-shift smoke test:**

1. Temporarily change your OS timezone to e.g. America/New_York (or use a browser extension to fake it)
2. Hard-refresh `/dashboard/multimedia-checklist`
3. Verify the displayed timestamps did NOT shift backward by ~13 hours — they should still be in Manila time
4. Restore your OS timezone

- [ ] **Step 6: Stop the dev server**

If you started it with `run_in_background: true`, stop it via TaskStop on the bash task ID.

- [ ] **Step 7: Final report**

Produce a short report listing:

- Type-check + lint + format result
- Helper script outputs (Steps 2 + 3)
- Sunday fix browser verification (pass/fail)
- Manila display verification (pass/fail per surface)
- Timezone-shift smoke test result

If any verification fails, do NOT mark the plan complete — create a follow-up task and report.

- [ ] **Step 8: Prepare final commit (only if anything was tweaked during verification)**

```
chore(verify): final fixups from Manila time + Sunday fix dry-run
```

If nothing was tweaked, report "No changes from verification" and stop.

---

## Self-review checklist (for the executing agent)

Before declaring the plan complete:

- [ ] Spec coverage: §3 Sunday fix → Task 1; §4 helpers → Tasks 2 + 3; §4.5 lint guard → Task 4; §5 verification → Task 5
- [ ] No placeholders in any code block
- [ ] Helper names consistent across tasks: `formatManilaDate`, `formatManilaLongDate`, `formatManilaTime`, `formatManilaDateTime`, `formatManilaWeekdayDateTime`, `formatManilaRelative`
- [ ] Function rename consistent: `computeUpcomingSundayManila` → `computeCurrentWeekSundayManila` everywhere it appears (Tasks 1 + 5)
- [ ] All 27 sweep files listed in Task 3
- [ ] Every commit step says "stop for user review" — no task runs `git commit` directly
