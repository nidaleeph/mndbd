# Multimedia Sunday Checklist — Design Spec

**Date:** 2026-04-11
**Status:** Approved in brainstorming, pending implementation plan
**Scope:** New feature — public-viewable, authenticated-editable Sunday setup checklist for the Multimedia ministry, with per-week run history and five analytics views.

---

## 1. Goal

Give the Multimedia ministry a single page anyone can open (no login) that shows live progress through their Sunday service setup checklist, backed by an authenticated template editor and a history system that captures every Sunday for performance review.

The ministry's problem today: no shared source of truth for "are we ready for service?" and no memory of which items were missed in past weeks. This feature solves both without forcing volunteers to log in before tapping a checkbox on their phone at the sound booth.

---

## 2. Decisions locked during brainstorming

| Decision                           | Choice                                                                                     | Rationale                                                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Viewer access                      | Anonymous public for live checklist; authenticated + admin-scoped for history (hybrid)     | Zero friction at the sound booth; internal data stays internal                                                     |
| Edit model                         | Admin + Multimedia head edit template; any Multimedia member checks items                  | Matches real-world service roles — head builds, team executes                                                      |
| Data shape                         | Single persistent `ChecklistTemplate` + per-week `ChecklistRun` snapshots                  | Stable template, immutable history, clean queries                                                                  |
| Mid-service edits                  | Flow into the live run immediately                                                         | Teams discover missing items mid-service and need to add them on the fly                                           |
| Reset trigger                      | Cron (Mon 03:00 Asia/Manila) + manual "Start new week" button                              | Cron handles forgetfulness, manual button handles prep and edge cases                                              |
| Real-time                          | Pusher broadcast to all viewers (anonymous included)                                       | Public page is worthless if progress lags behind reality                                                           |
| History views                      | All five (runs list, drill-down, trends, item reliability, people)                         | User explicitly requested all                                                                                      |
| Visual direction                   | Tech-Ops Control Room (dark slate + neon cyan)                                             | Fits the multimedia/tech-ops context; public page lives outside dashboard shell so it can have its own personality |
| History access                     | Admin + Multimedia head + any Multimedia member                                            | Transparency for the team, not a management gate                                                                   |
| History dashboard permission split | `canViewChecklistHistory` (member-accessible) ≠ `canManageChecklistRuns` (head/admin-only) | Members see their team's performance; only heads/admins can start/close runs                                       |
| Label rename safety                | Snapshot `labelSnapshot` + `categoryNameSnapshot` on every `ItemCheck` at check time       | Renames don't rewrite history                                                                                      |
| Rate limiting                      | Deferred to post-v1                                                                        | Audience ~50–100 people, no adversary model, Pusher eliminates polling                                             |

### Assumptions flagged

- **Timezone:** Asia/Manila for all "Sunday" rollover logic. Based on Filipino ministry names in the seed (Parakletos, Kaagapay, Kaloob). If wrong, the cron handler is the only place that needs to change.
- **Ministry slug:** `multimedia` (already in `lib/db/seed.ts`). Looked up per-request via a `getMultimediaMinistryId()` helper.
- **Structure:** One master Multimedia checklist with multiple categories (PC1, PC2, Sound Mixer). Not multiple independent checklists. If a future ministry wants a similar feature, `ChecklistTemplate.ministryId` is already unique per ministry — the system generalizes.

---

## 3. Data model

Four new Prisma models. All in `prisma/schema.prisma`; a single new migration.

### 3.1 `ChecklistTemplate`

One row per ministry (uniqueness on `ministryId`). For v1 this is just the Multimedia row.

- `id: String @id @default(cuid())`
- `ministryId: String @unique` — FK to `Ministry`
- `createdAt: DateTime @default(now())`
- `updatedAt: DateTime @updatedAt`
- Relations: `categories: ChecklistCategory[]`, `runs: ChecklistRun[]`

### 3.2 `ChecklistCategory`

Example: "PC1 — Full Setup", "PC2 — Camera & Stream", "Sound Mixer".

- `id: String @id @default(cuid())`
- `templateId: String` — FK
- `name: String`
- `sortOrder: Int`
- `archivedAt: DateTime?` — soft-delete
- `createdAt: DateTime @default(now())`
- `updatedAt: DateTime @updatedAt`
- Relations: `template`, `items: ChecklistItem[]`
- Index: `@@index([templateId, sortOrder])`

### 3.3 `ChecklistItem`

Example: "Open vMix for NDI connections".

- `id: String @id @default(cuid())`
- `categoryId: String` — FK
- `label: String`
- `sortOrder: Int`
- `archivedAt: DateTime?` — soft-delete
- `createdAt: DateTime @default(now())`
- `updatedAt: DateTime @updatedAt`
- Relations: `category`, `checks: ItemCheck[]`
- Index: `@@index([categoryId, sortOrder])`

### 3.4 `ChecklistRun`

One per Sunday. Exactly one row per `(templateId, weekStart)`.

- `id: String @id @default(cuid())`
- `templateId: String` — FK
- `weekStart: DateTime` — the Sunday date (00:00 Asia/Manila) the run belongs to
- `startedAt: DateTime`
- `closedAt: DateTime?` — null while the run is open
- `startedById: String?` — null when cron opened it
- `closedById: String?` — null when cron closed it
- Relations: `template`, `startedBy: User?`, `closedBy: User?`, `checks: ItemCheck[]`
- Unique: `@@unique([templateId, weekStart])`
- Index: `@@index([templateId, closedAt])` — fast "which run is open?" query

### 3.5 `ItemCheck`

Append-style log, one active row per `(runId, itemId)`. Uncheck = delete.

- `id: String @id @default(cuid())`
- `runId: String` — FK
- `itemId: String` — FK
- `checkedById: String` — FK to `User`
- `checkedAt: DateTime @default(now())`
- `labelSnapshot: String` — item label at check time
- `categoryNameSnapshot: String` — category name at check time
- Relations: `run`, `item`, `checkedBy: User`
- Unique: `@@unique([runId, itemId])`
- Index: `@@index([runId])`, `@@index([itemId])`

### 3.6 `User` model addition

No schema changes to `User` needed — existing `id`, `ministryId`, `userMinistries` cover everything. The `getMinistryMemberIds(multimediaMinistryId)` helper already exists in `lib/notificationRecipients.ts`.

### 3.7 Why soft-delete

`archivedAt` on categories and items means template edits don't destroy history. The live-view query filters `archivedAt: null`; history queries (drill-down, reliability, stats) query through `ItemCheck` rows which hold their own snapshots anyway, so they're immune to both deletion and rename.

---

## 4. Permissions

New helpers in `lib/permissions.ts`, all pure functions matching the existing style.

```ts
canViewChecklistHistory(roleSlug, userMinistryIds, multimediaMinistryId): boolean
  // admin OR ministry_head of Multimedia OR any user whose ministryIds includes Multimedia
  // gates: all history pages and /api/checklist/stats and /api/checklist/runs endpoints

canToggleChecklistItem(roleSlug, userMinistryIds, multimediaMinistryId): boolean
  // admin OR any user whose ministryIds includes Multimedia
  // gates: check/uncheck API routes

canEditChecklistTemplate(roleSlug, userMinistryIds, multimediaMinistryId): boolean
  // admin OR ministry_head whose ministryIds includes Multimedia
  // gates: template editor page + category/item CRUD API routes

canManageChecklistRuns(roleSlug, userMinistryIds, multimediaMinistryId): boolean
  // same as canEditChecklistTemplate — admin OR Multimedia ministry_head
  // gates: POST /api/checklist/runs/start, POST /api/checklist/runs/close, and the action buttons on the admin landing
```

### 4.1 Ministry ID lookup

A tiny helper `getMultimediaMinistryId()` lives in `lib/permissions.ts` (or a new `lib/checklist.ts` if it grows). It calls `prisma.ministry.findUnique({ where: { slug: "multimedia" }})` on every request. Intentionally boring — if this ever shows up in profiling, wrap it in Next.js `cache()`. **Do not** env-var the ID.

### 4.2 Public page auth model

The public page at `/checklist` must **not** gate on `getServerSession`. Page renders unconditionally. It calls `getServerSession` separately to decide whether to pass a `canCheck: boolean` prop into the client component. The page must render fine with `session === null`.

---

## 5. Routes

```
app/
├── (public)/
│   └── checklist/
│       ├── layout.tsx      ← minimal standalone layout (own chrome, own theme)
│       └── page.tsx        ← public checklist page (server component)
└── (dashboard)/
    └── dashboard/
        └── multimedia-checklist/
            ├── page.tsx                    ← admin landing
            ├── template/
            │   └── page.tsx                ← template editor
            └── history/
                ├── page.tsx                ← history (tabs: runs, trends, reliability, people)
                └── [runId]/
                    └── page.tsx            ← per-run drill-down
```

### 5.1 Why `app/(public)/`

The route group is currently empty. Creating a public group gives us a clean place for a non-dashboard layout. Future public pages (sermon listings, event signups) sit alongside this one.

### 5.2 Sidebar nav

Add a **"Multimedia Checklist"** entry to `components/layout/Sidebar.tsx`, visible to users whose `roleSlug === "admin"` OR whose `ministryIds` include the Multimedia ministry. Links to `/dashboard/multimedia-checklist`. Non-Multimedia users don't see it.

No public-facing link to `/checklist` in the UI for v1. URL distribution is out-of-band (QR code, group chat).

---

## 6. API surface

All routes under `/api/checklist/*` except the cron endpoint. Every mutating route broadcasts a Pusher event before returning.

| Method   | Path                                                    | Auth                       | Purpose                                                                                                                                     |
| -------- | ------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/api/checklist/current`                                | Public                     | Returns `{ run, template, checks }` for hydration. Public page and admin landing both consume this.                                         |
| `POST`   | `/api/checklist/items/[itemId]/check`                   | `canToggleChecklistItem`   | Upsert an `ItemCheck` row on the current open run. Captures `labelSnapshot` + `categoryNameSnapshot` at write time. Idempotent.             |
| `DELETE` | `/api/checklist/items/[itemId]/check`                   | `canToggleChecklistItem`   | Delete the `ItemCheck` row (uncheck). Idempotent.                                                                                           |
| `POST`   | `/api/checklist/categories`                             | `canEditChecklistTemplate` | Create category. Body: `{ name, sortOrder? }`.                                                                                              |
| `PATCH`  | `/api/checklist/categories/[id]`                        | `canEditChecklistTemplate` | Rename, reorder. Body: `{ name?, sortOrder? }`.                                                                                             |
| `DELETE` | `/api/checklist/categories/[id]`                        | `canEditChecklistTemplate` | Soft-delete (`archivedAt = now()`).                                                                                                         |
| `POST`   | `/api/checklist/items`                                  | `canEditChecklistTemplate` | Create item. Body: `{ categoryId, label, sortOrder? }`.                                                                                     |
| `PATCH`  | `/api/checklist/items/[id]`                             | `canEditChecklistTemplate` | Rename, reorder, reparent. Body: `{ label?, sortOrder?, categoryId? }`.                                                                     |
| `DELETE` | `/api/checklist/items/[id]`                             | `canEditChecklistTemplate` | Soft-delete.                                                                                                                                |
| `POST`   | `/api/checklist/runs/start`                             | `canManageChecklistRuns`   | Manually open a new run for the upcoming Sunday (same `upcomingSunday` computation as the cron). Returns 409 if an open run already exists. |
| `POST`   | `/api/checklist/runs/close`                             | `canManageChecklistRuns`   | Close the current open run. Sets `closedAt = now()` and `closedById = session.userId`. Returns 404 if no open run exists.                   |
| `GET`    | `/api/checklist/runs`                                   | `canViewChecklistHistory`  | Paginated run list for the history page. Query: `?limit=20&cursor=...`.                                                                     |
| `GET`    | `/api/checklist/runs/[id]`                              | `canViewChecklistHistory`  | Single run + all `ItemCheck` rows for drill-down.                                                                                           |
| `GET`    | `/api/checklist/stats?view=trends\|reliability\|people` | `canViewChecklistHistory`  | Aggregated stats for the trends/reliability/people tabs. Single endpoint with a `view` query param.                                         |
| `GET`    | `/api/cron/checklist-reset`                             | `CRON_SECRET` header       | Close stale open runs, open new runs. Idempotent.                                                                                           |

### 6.1 Zod schemas

Create `schemas/checklist.ts` with:

- `checklistCategoryCreateSchema` — `{ name: string (1..80), sortOrder?: int }`
- `checklistCategoryPatchSchema` — `{ name?: string (1..80), sortOrder?: int }`
- `checklistItemCreateSchema` — `{ categoryId: string, label: string (1..200), sortOrder?: int }`
- `checklistItemPatchSchema` — `{ label?: string (1..200), sortOrder?: int, categoryId?: string }`

Every mutating handler `safeParse`s and returns `NextResponse.json({ message }, { status: 400 })` on failure. Matches the existing Zod + NextResponse convention.

### 6.2 Optimistic UI on check/uncheck

The checklist client component flips the checkbox locally on click and fires the API request. If the server returns non-2xx (session expired, user kicked from Multimedia, etc.), the client rolls the local state back and shows a toast. Non-negotiable — the Sunday morning tap-my-phone workflow is worthless if every tap waits 400ms for a round-trip.

---

## 7. Real-time (Pusher)

One channel, public (no auth), shared by every viewer:

```
checklist-multimedia
```

### 7.1 Events

| Event              | Payload                                                                                                                                  | When fired                                                                                                                                                                  |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `item-checked`     | `{ itemId, checkedById, checkedByName, checkedAt }`                                                                                      | After `POST /api/checklist/items/[id]/check`                                                                                                                                |
| `item-unchecked`   | `{ itemId }`                                                                                                                             | After `DELETE /api/checklist/items/[id]/check`                                                                                                                              |
| `template-changed` | `{ kind: "category-added" \| "category-updated" \| "category-archived" \| "item-added" \| "item-updated" \| "item-archived", entityId }` | After any template mutation. Client **refetches** `/api/checklist/current` on this event — does not apply a patch. Template edits are rare, refetch is simpler and correct. |
| `run-changed`      | `{ kind: "started" \| "closed", runId }`                                                                                                 | After manual or cron-driven run start/close. Client refetches `/api/checklist/current`.                                                                                     |

### 7.2 Server-side publish

Publishing goes through a thin wrapper `services/checklistEvents.ts` exposing one function per event:

```ts
publishItemChecked({ itemId, checkedById, checkedByName, checkedAt });
publishItemUnchecked({ itemId });
publishTemplateChanged({ kind, entityId });
publishRunChanged({ kind, runId });
```

Internally each calls `getPusher().trigger("checklist-multimedia", <event>, payload)` from `lib/pusher.ts`. Mutation handlers import the wrapper, not the Pusher client directly — same pattern as `services/notificationService.ts`. This keeps channel name and event name as single points of truth and makes the handlers readable.

No client writes, ever. All Pusher publishing happens server-side so auth and broadcast stay in sync.

### 7.3 Client subscription

- **`/checklist`** — the public page's client component subscribes to `checklist-multimedia` on mount, updates local state on `item-checked` and `item-unchecked`, and refetches `/api/checklist/current` on `template-changed` and `run-changed`.
- **`/dashboard/multimedia-checklist`** — the admin landing also subscribes to the same channel for live stat updates.

---

## 8. Reset mechanism

### 8.1 Cron

Endpoint: `GET /api/cron/checklist-reset`, gated by `CRON_SECRET` header check matching `/api/cron/reminders`.

Logic (idempotent, safe to run at any time any number of times):

1. Compute `upcomingSunday` — the next date (in Asia/Manila) whose day-of-week is Sunday and whose 00:00 timestamp is `>= now()`. If `now()` is Sunday 00:00 exactly, that's today; otherwise it's the next Sunday (Monday morning cron → next Sunday, 6 days away).
2. Load **all** open runs (`closedAt IS NULL`) for the Multimedia template. There should normally be zero or one, but be defensive.
3. For each open run whose `weekStart < startOfTodayManila` (the Sunday it represented has already passed):
   - Set `closedAt = now()`, `closedById = null`.
   - Broadcast `run-changed { kind: "closed", runId }`.
4. After closing stale runs, check if any run already exists for `upcomingSunday` (regardless of `closedAt` state). If not:
   - Insert `{ templateId, weekStart: upcomingSunday, startedAt: now(), startedById: null }`.
   - Broadcast `run-changed { kind: "started", runId }`.
5. If an open run exists whose `weekStart >= startOfTodayManila`, leave it alone — that's a manual-prep run (e.g. head opened Saturday for prep). Cron is a recovery net, not a schedule enforcer.

Schedule: documented as "whoever runs cron hits this Monday 03:00 Asia/Manila". The repo has no wired-up cron runner (`/api/cron/reminders` is in the same state), so operations picks this up when they set up scheduling.

### 8.2 Manual buttons on `/dashboard/multimedia-checklist`

- **"Start new week"** — visible only when no open run exists. Calls `POST /api/checklist/runs/start`. Used Saturday for prep or if the cron missed.
- **"Close current week"** — visible only when an open run exists. Calls `POST /api/checklist/runs/close`. Confirmation prompt warns: "Unchecked items will be recorded as unchecked in history."

---

## 9. Congratulations UX

Triggers when every non-archived item in the current run has an `ItemCheck` row.

### 9.1 Three-stage flow

1. **First hit 100%** — full-screen Framer Motion takeover fades in over the checklist. Big animated checkmark, celebratory headline ("All Systems Ready — to God be the glory"), subtle confetti burst (hand-rolled via Framer Motion's particle primitives — no new dependency). Auto-dismisses after ~4 seconds with a fade-out.
2. **After dismiss / subsequent return to 100%** — collapses to an inline celebration banner at the top of the checklist. The checklist remains visible below. Unchecking removes the banner; re-checking re-shows it.
3. **Per-device state** — the "have I shown the full-screen this run?" flag lives in `localStorage` keyed on `checklist-celebration-${runId}`. Each device gets one full-screen celebration per Sunday. Refresh doesn't re-trigger.

### 9.2 Who sees it

Everyone — including anonymous viewers. The whole point of the public page is shared celebration.

---

## 10. Template editor (`/dashboard/multimedia-checklist/template`)

Single client component `features/checklist/TemplateEditor.tsx`, server-hydrated from the current template.

### 10.1 Interaction model

Inline, no modals:

- Click a category name → it becomes a text input. Blur or Enter commits via `PATCH /api/checklist/categories/[id]`. Escape cancels.
- Click "+ Add item" at the bottom of a category → creates an empty focused input. Blur with empty value discards (no API call); blur with content commits via `POST /api/checklist/items`.
- Drag to reorder → `react-dnd` (already in the stack) with `react-dnd-html5-backend`. On drop, fire a `PATCH` per moved entity to update `sortOrder`. No bulk endpoint for v1.
- Delete (×) → confirmation prompt, then soft-delete. Item disappears from the editor immediately, stays in history.

### 10.2 Optimistic state

Editor holds local state, mutates optimistically, reverts on API failure with a toast. `router.refresh()` after bulk operations (reordering) to reconcile.

### 10.3 Categories for new ministry

For v1, the template editor assumes a template already exists for Multimedia. A one-time seed (in `lib/db/seed.ts` or a new migration data step) creates the empty `ChecklistTemplate` row for the Multimedia ministry if it doesn't exist. Seed also inserts a starter template matching the user's original example (PC1 Full Setup, PC2 Camera & Stream, Sound Mixer) so the feature is usable out of the box.

---

## 11. History page (`/dashboard/multimedia-checklist/history`)

Single page with tab navigation across four views. The fifth view (drill-down) is a separate route.

### 11.1 Runs tab (default)

Paginated server-rendered table. Columns:

- Date (`weekStart`)
- Completion % (`checks.length / active_items.length`)
- Opened by (user name, or "Cron")
- Closed by (user name, or "Cron", or "Still open")
- Duration (`MAX(checkedAt) - MIN(checkedAt)` within the run, or "—" if zero checks)
- Mid-service adds (count of items created after the run's `startedAt`, scoped to this week)

Click a row → `/history/[runId]`.

### 11.2 Drill-down — `/history/[runId]/page.tsx`

Shows the run metadata header (open/close timestamps, opened/closed by, total checks, duration, adds count) and every item rendered category-by-category using **label snapshots** from `ItemCheck`. Items that were never checked render in red with "never checked". The drill-down walks the current template to find items that _should_ have been in the run but have no `ItemCheck` row — those show up as missed with their current label.

### 11.3 Trends tab

Two hand-rolled SVG charts served from `/api/checklist/stats?view=trends`:

- Line chart: completion % over the last 12 runs
- Bar chart: duration (minutes from first check to last check) over the last 12 runs

No charting library. If v2 needs more charts, revisit.

### 11.4 Item reliability tab

Table from `/api/checklist/stats?view=reliability`. Sorted descending by miss rate. Columns: category, item label, times checked, times missed, miss rate %. Scoped to non-archived items over the last 12 runs.

### 11.5 People tab

Table from `/api/checklist/stats?view=people`. Columns: member name, runs participated in, total items checked, avg per run, last active date.

---

## 12. Notifications integration

Uses existing `services/notificationService.ts` + `lib/notificationRecipients.ts` — **no hand-rolled `prisma.notification.create` or Pusher calls inline**.

### 12.1 Template-change notifications

**Only fired while a run is open** (`run.closedAt IS NULL`). Template edits during prep are silent; template edits during service are loud.

- **Recipients:** `getMinistryMemberIds(multimediaMinistryId)` minus the acting editor's own `userId` (exclude actor)
- **Type:** `"checklist-template-changed"`
- **Body:** `"Multimedia checklist template was updated by ${editorName}"`
- **Link:** `/checklist`
- **Debounce:** none in v1 — every mutation during an open run fires a notification. If this turns out to be noisy in practice (adding 5 items = 5 notifications), revisit with a 5-minute editor-session debounce. Deferred to post-v1.

### 12.2 Run-closed notifications

- **Recipients:** `getAdminUserIds()` unioned with the set of users whose role is `ministry_head` and whose `ministryIds` include Multimedia, minus the actor (if any — cron-closed runs have no actor to exclude)
- **Type:** `"checklist-run-closed"`
- **Body:** `"${dateLabel} checklist closed — ${checks}/${total} items complete"`
- **Link:** `/dashboard/multimedia-checklist/history/${runId}`

### 12.3 No notifications on individual check/uncheck

Pusher handles that. In-app notifications are reserved for state changes that warrant the bell badge.

---

## 13. Visual design

Direction: **Tech-Ops Control Room** (dark slate + neon cyan accents).

### 13.1 Color palette

```
--bg-deep        #050a14   page background
--bg-panel       #0b1220   card / surface
--bg-panel-2     #0f172a   header / elevated surface
--bg-panel-3     #1e293b   input / interactive surface
--border         #1e293b
--border-hi      #334155
--text           #e2e8f0
--text-dim       #94a3b8
--text-dimmer    #64748b
--cyan           #22d3ee   primary accent
--cyan-glow      rgba(34,211,238,0.5)
--green          #4ade80   success / completion
--amber          #fbbf24   warning / partial
--red            #f87171   miss / error
```

Monospace font (`SF Mono` / `JetBrains Mono`) for labels, IDs, timestamps, category tags. Sans-serif (`Inter` / system) for headings and body.

### 13.2 Where this lives

The public page at `/checklist` uses its **own** theme via a standalone `app/(public)/checklist/layout.tsx`. It does not inherit the existing `globals.css` blue-and-gold dashboard palette. The dashboard admin pages (`/dashboard/multimedia-checklist/*`) **also** use the dark tech-ops palette, implemented as a scoped `.checklist-admin` wrapper so they visually match the public page while sitting inside `DashboardShell`.

### 13.3 Screen mockups

See browser session at `.superpowers/brainstorm/*/content/all-screens.html` for the full 11-screen review. Canonical reference for visual fidelity during implementation.

---

## 14. Verification

No test runner is configured in this repo. Verification is `npm run check` + a scripted manual dry-run.

### 14.1 Automated

1. `npm run type-check` — TypeScript strict passes.
2. `npm run lint` — ESLint passes.
3. `npm run format:check` — Prettier clean.

All three run together as `npm run check`.

### 14.2 Manual Sunday dry-run

Executed against a fresh DB after migration + seed:

1. **Seeded state:** Verify Multimedia `ChecklistTemplate` exists with starter categories and items from seed.
2. **Anonymous view:** Open `/checklist` in an incognito window. Confirm page renders with current (empty) run, zero progress, no session prompt anywhere.
3. **Admin edit:** Log in as admin. Navigate to `/dashboard/multimedia-checklist/template`. Add a category, add two items, rename one, delete one. Open the incognito `/checklist` tab — confirm changes appear live via Pusher.
4. **Member check:** In a second browser, log in as a seeded Multimedia member (create one if seed doesn't provide). Open `/checklist`. Confirm checkboxes are tappable. Tap one. Confirm (a) the incognito tab updates live, (b) the progress bar advances, (c) the `ItemCheck` row exists in the DB with correct `labelSnapshot`.
5. **Mid-service add:** While the run is open, add a new item from the template editor. Confirm it appears immediately in both the admin view and the public view, unchecked.
6. **100% celebration:** Check every item from the member browser. Verify full-screen celebration fires once, confetti animates, collapses to inline banner after ~4s. Refresh the page — confirm only the banner shows, not the full-screen (localStorage flag). Uncheck one item — banner disappears. Re-check — banner returns without full-screen.
7. **Manual close:** From admin landing, click "Close current week". Verify confirmation, close, redirect, and that `/api/checklist/current` now reports no open run.
8. **Cron path:** `curl -H "x-cron-secret: $CRON_SECRET" http://localhost:3000/api/cron/checklist-reset`. Verify a new run opens for the current week. Run again — verify idempotency (no duplicate).
9. **History:** Navigate to `/dashboard/multimedia-checklist/history`. Verify all four tabs render. Click a past run — verify drill-down shows correct items with snapshot labels and missed items in red.
10. **Permission gates:** Log in as a non-Multimedia `user`. Verify `/checklist` shows checkboxes as disabled. Verify `/dashboard/multimedia-checklist` is not in the sidebar. Verify direct navigation to `/dashboard/multimedia-checklist/template` redirects / shows unauthorized.

Document this checklist in the eventual implementation plan so each step has a verification task attached.

---

## 15. Out of scope / deferred

Explicitly deferred with reason:

- **Rate limiting on `/api/checklist/current`.** v1 audience is ~50–100 people with no adversary model, and clients use Pusher instead of polling. Drop `@upstash/ratelimit` in front of the endpoint later if traffic shows up in metrics. ~20-minute change with no schema or UX impact.
- **Multiple concurrent checklists per ministry.** Current design is one template per ministry (unique on `ministryId`). Generalizing to multiple named checklists is a straightforward schema extension but not needed for v1.
- **Per-person v2 stats.** Tabs 3–5 ship with basic aggregates. Richer analytics (streaks, weekly delta per person, category ownership) can be added against the same `ItemCheck` table without migration.
- **Bulk reorder endpoint.** v1 fires one `PATCH` per moved entity. Add a bulk endpoint if drag-reorder performance becomes visible.
- **Public footer link to `/checklist`.** URL lives out-of-band (QR code at the mixer, ministry group chat) for v1.
- **Generalization to other ministries.** Data model already supports it (`ChecklistTemplate.ministryId` is unique per ministry), but v1 permissions hard-code Multimedia. When another ministry wants this, factor the helpers to take a ministry slug.

---

## 16. File inventory (expected changes)

This is a scope sketch — the implementation plan derived from this spec will have the definitive list.

**New files:**

- `prisma/migrations/<new>/migration.sql`
- `schemas/checklist.ts`
- `lib/checklist.ts` — `getMultimediaMinistryId()`, any shared helpers
- `services/checklistEvents.ts` — thin wrapper around Pusher publishing for checklist events (keeps mutation handlers clean)
- `app/(public)/checklist/layout.tsx`
- `app/(public)/checklist/page.tsx`
- `features/checklist/ChecklistPublicClient.tsx` — the interactive client component
- `features/checklist/TemplateEditor.tsx` — dashboard template editor
- `features/checklist/ChecklistLandingClient.tsx` — dashboard landing stats + recent activity
- `features/checklist/HistoryRunsTable.tsx`
- `features/checklist/HistoryTrendsCharts.tsx`
- `features/checklist/HistoryReliabilityTable.tsx`
- `features/checklist/HistoryPeopleTable.tsx`
- `features/checklist/RunDrillDown.tsx`
- `features/checklist/CelebrationOverlay.tsx` — Framer Motion full-screen + banner
- `app/(dashboard)/dashboard/multimedia-checklist/page.tsx`
- `app/(dashboard)/dashboard/multimedia-checklist/template/page.tsx`
- `app/(dashboard)/dashboard/multimedia-checklist/history/page.tsx`
- `app/(dashboard)/dashboard/multimedia-checklist/history/[runId]/page.tsx`
- `app/api/checklist/current/route.ts`
- `app/api/checklist/items/[itemId]/check/route.ts`
- `app/api/checklist/items/route.ts` + `app/api/checklist/items/[id]/route.ts`
- `app/api/checklist/categories/route.ts` + `app/api/checklist/categories/[id]/route.ts`
- `app/api/checklist/runs/start/route.ts`
- `app/api/checklist/runs/close/route.ts`
- `app/api/checklist/runs/route.ts` + `app/api/checklist/runs/[id]/route.ts`
- `app/api/checklist/stats/route.ts`
- `app/api/cron/checklist-reset/route.ts`

**Modified files:**

- `prisma/schema.prisma` — append 4 new models
- `lib/permissions.ts` — append 4 new helpers + `getMultimediaMinistryId`
- `lib/db/seed.ts` — seed empty Multimedia `ChecklistTemplate` + starter categories
- `components/layout/Sidebar.tsx` — new "Multimedia Checklist" nav entry
- `services/notificationService.ts` — new notification types for `checklist-template-changed` and `checklist-run-closed` (or just new call sites if the service is generic)

---

## 17. Open questions for implementation plan

These don't block the spec, but the writing-plans phase should pin them down:

1. **Starter template contents.** The seed inserts categories and items matching the user's example (PC1 Full Setup, PC2 Camera & Stream, Sound Mixer). Exact label strings and initial `sortOrder` values need final sign-off before implementation.
2. **Confetti implementation.** Framer Motion primitives vs `canvas-confetti` (new dep). Lean toward Framer-only to avoid a dependency.
3. **Chart SVG viewport math.** Hand-rolled SVG charts need concrete width/height math for responsive behavior on mobile. Trivial but worth capturing.
4. **Cron runner wiring.** Spec documents the endpoint and schedule but not the runner. Operations will wire it up (Vercel Cron, GitHub Actions, whatever) — outside the feature scope.
