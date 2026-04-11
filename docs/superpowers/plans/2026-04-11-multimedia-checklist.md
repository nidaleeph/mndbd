# Multimedia Checklist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public-viewable, authenticated-editable Sunday setup checklist for the Multimedia ministry with live Pusher updates, weekly run history, and a five-view analytics dashboard.

**Architecture:** Public route group `app/(public)/checklist/*` for the live page (no auth gate; optional session enables interactive checks); dashboard route `app/(dashboard)/dashboard/multimedia-checklist/*` for template editing and history. Four new Prisma models (`ChecklistTemplate`, `ChecklistCategory`, `ChecklistItem`, `ChecklistRun`, `ItemCheck`) with label snapshots on checks for rename-safe history. Single public Pusher channel `checklist-multimedia` broadcasts check/template/run events to every viewer. Cron-driven weekly reset with manual override.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Prisma + PostgreSQL, NextAuth (credentials), Pusher (real-time), Tailwind v4, Framer Motion (existing), `react-dnd` (existing for drag-reorder), Zod (existing for validation).

**Source spec:** [docs/superpowers/specs/2026-04-11-multimedia-checklist-design.md](../specs/2026-04-11-multimedia-checklist-design.md) — canonical definitions live there; this plan converts the spec into sequenced tasks.

---

## Important adaptations for this codebase

### No test runner

There is **no test runner configured** in this repo (confirmed in [CLAUDE.md](../../../CLAUDE.md) and spec §14). The standard TDD "write failing test first" pattern is replaced with:

1. Write the code
2. Run `npm run type-check` — expect zero errors
3. Run `npm run lint` — expect zero errors
4. For UI-facing work, exercise it via `npm run dev` in a browser
5. Stage the changes and **stop for user review** — the user commits manually

Do not invent a `npm test` command. Do not write unit tests without a runner. Verification is type-check + lint + manual dry-run.

### No auto-commits

Per [CLAUDE.md](../../../CLAUDE.md), **never run `git commit`, `git push`, or create PRs**. At every "commit" step in this plan, you:

1. Run `git status` to show changed files
2. Report the prepared commit message to the user verbatim
3. **Stop and wait** for the user to commit manually

The commit messages in this plan are the messages the user should use — they are not instructions for you to execute.

---

## File structure (what gets created / modified)

Created:

- `prisma/migrations/<timestamp>_checklist/migration.sql` — auto-generated
- `schemas/checklist.ts`
- `lib/checklist.ts` — `getMultimediaMinistryId()`, `computeUpcomingSundayManila()`, run/progress helpers
- `services/checklistEvents.ts` — Pusher publish wrapper
- `features/checklist/ChecklistPublicClient.tsx`
- `features/checklist/TemplateEditor.tsx`
- `features/checklist/ChecklistLandingClient.tsx`
- `features/checklist/HistoryRunsTable.tsx`
- `features/checklist/HistoryTabs.tsx`
- `features/checklist/HistoryTrendsCharts.tsx`
- `features/checklist/HistoryReliabilityTable.tsx`
- `features/checklist/HistoryPeopleTable.tsx`
- `features/checklist/RunDrillDown.tsx`
- `features/checklist/CelebrationOverlay.tsx`
- `app/(public)/checklist/layout.tsx`
- `app/(public)/checklist/page.tsx`
- `app/(public)/checklist/checklist.css` — scoped dark tech-ops theme
- `app/(dashboard)/dashboard/multimedia-checklist/page.tsx`
- `app/(dashboard)/dashboard/multimedia-checklist/template/page.tsx`
- `app/(dashboard)/dashboard/multimedia-checklist/history/page.tsx`
- `app/(dashboard)/dashboard/multimedia-checklist/history/[runId]/page.tsx`
- `app/api/checklist/current/route.ts`
- `app/api/checklist/items/[itemId]/check/route.ts`
- `app/api/checklist/items/route.ts`
- `app/api/checklist/items/[id]/route.ts`
- `app/api/checklist/categories/route.ts`
- `app/api/checklist/categories/[id]/route.ts`
- `app/api/checklist/runs/start/route.ts`
- `app/api/checklist/runs/close/route.ts`
- `app/api/checklist/runs/route.ts`
- `app/api/checklist/runs/[id]/route.ts`
- `app/api/checklist/stats/route.ts`
- `app/api/cron/checklist-reset/route.ts`

Modified:

- `prisma/schema.prisma` — append 5 new models
- `lib/permissions.ts` — append 4 helpers
- `lib/db/seed.ts` — append starter template seeding
- `components/layout/Sidebar.tsx` — add "Multimedia Checklist" entry

---

## Task 1: Add Prisma schema for checklist models

**Files:**

- Modify: `prisma/schema.prisma` — append at end of file (before the final closing line if any) and add two back-relations on `User`

- [ ] **Step 1: Append 5 new models to `prisma/schema.prisma`**

Append this block at the end of the file:

```prisma
model ChecklistTemplate {
  id         String              @id @default(cuid())
  ministryId String              @unique
  createdAt  DateTime            @default(now())
  updatedAt  DateTime            @updatedAt
  ministry   Ministry            @relation(fields: [ministryId], references: [id], onDelete: Cascade)
  categories ChecklistCategory[]
  runs       ChecklistRun[]
}

model ChecklistCategory {
  id         String            @id @default(cuid())
  templateId String
  name       String
  sortOrder  Int
  archivedAt DateTime?
  createdAt  DateTime          @default(now())
  updatedAt  DateTime          @updatedAt
  template   ChecklistTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  items      ChecklistItem[]

  @@index([templateId, sortOrder])
}

model ChecklistItem {
  id         String            @id @default(cuid())
  categoryId String
  label      String
  sortOrder  Int
  archivedAt DateTime?
  createdAt  DateTime          @default(now())
  updatedAt  DateTime          @updatedAt
  category   ChecklistCategory @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  checks     ItemCheck[]

  @@index([categoryId, sortOrder])
}

model ChecklistRun {
  id          String            @id @default(cuid())
  templateId  String
  weekStart   DateTime
  startedAt   DateTime
  closedAt    DateTime?
  startedById String?
  closedById  String?
  template    ChecklistTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  startedBy   User?             @relation("ChecklistRunStartedBy", fields: [startedById], references: [id], onDelete: SetNull)
  closedBy    User?             @relation("ChecklistRunClosedBy", fields: [closedById], references: [id], onDelete: SetNull)
  checks      ItemCheck[]

  @@unique([templateId, weekStart])
  @@index([templateId, closedAt])
}

model ItemCheck {
  id                   String        @id @default(cuid())
  runId                String
  itemId               String
  checkedById          String
  checkedAt            DateTime      @default(now())
  labelSnapshot        String
  categoryNameSnapshot String
  run                  ChecklistRun  @relation(fields: [runId], references: [id], onDelete: Cascade)
  item                 ChecklistItem @relation(fields: [itemId], references: [id], onDelete: Cascade)
  checkedBy            User          @relation("ItemChecksBy", fields: [checkedById], references: [id], onDelete: Restrict)

  @@unique([runId, itemId])
  @@index([runId])
  @@index([itemId])
}
```

- [ ] **Step 2: Add back-relations to `User` model**

In `prisma/schema.prisma`, find the `User` model block and append these three relation fields alongside the other relations (after `prayersCreated Prayer[] @relation("PrayerCreatedBy")` at line 111):

```prisma
  checklistRunsStarted  ChecklistRun[] @relation("ChecklistRunStartedBy")
  checklistRunsClosed   ChecklistRun[] @relation("ChecklistRunClosedBy")
  itemChecks            ItemCheck[]    @relation("ItemChecksBy")
```

- [ ] **Step 3: Add back-relation to `Ministry` model**

In the `Ministry` model block (lines ~59–73), append:

```prisma
  checklistTemplate ChecklistTemplate?
```

- [ ] **Step 4: Generate the migration**

Run: `npm run db:generate -- --name checklist`

Expected: Prisma prompts for confirmation, generates `prisma/migrations/<timestamp>_checklist/migration.sql`, applies to the dev database, and regenerates the client. If the prompt blocks on interactive input, run `npx prisma migrate dev --name checklist` directly.

- [ ] **Step 5: Verify Prisma client regenerated**

Run: `npm run type-check`

Expected: zero errors. The new `prisma.checklistTemplate`, `prisma.checklistRun`, etc. should be available on the client.

- [ ] **Step 6: Prepare commit (do not run)**

Run: `git status`

Report to user. Prepared commit message:

```
feat(checklist): add data models for multimedia checklist

Adds ChecklistTemplate, ChecklistCategory, ChecklistItem, ChecklistRun,
and ItemCheck models with label snapshots for rename-safe history.
```

**Stop and wait for user to commit manually.**

---

## Task 2: Seed starter template for Multimedia ministry

**Files:**

- Modify: `lib/db/seed.ts`

- [ ] **Step 1: Append starter template seeding at the end of the `main()` function**

Open `lib/db/seed.ts`. After the admin user creation block near the end of `main()` (after `console.log("Admin user seeded.")` or the equivalent), append:

```ts
// --- Multimedia checklist starter template ---
const multimediaMinistry = await prisma.ministry.findUnique({
  where: { slug: "multimedia" },
});
if (multimediaMinistry) {
  const template = await prisma.checklistTemplate.upsert({
    where: { ministryId: multimediaMinistry.id },
    create: { ministryId: multimediaMinistry.id, updatedAt: now },
    update: { updatedAt: now },
  });

  const starterCategories: Array<{ name: string; items: string[] }> = [
    {
      name: "PC1 — Full Setup",
      items: [
        "Check all PowerPoint",
        "Verify EZ Lyrics — all correct",
        "Open vMix for NDI connections",
        "Check all monitors are on",
      ],
    },
    {
      name: "PC2 — Camera & Stream",
      items: [
        "Back cam connected",
        "OBS connection established",
        "Front cam connection",
        "Gimbal connection",
      ],
    },
    {
      name: "Sound Mixer",
      items: ["Pulpit mic working", "PC1 output to mixer", "PC2 receiving audio from mixer"],
    },
  ];

  for (let c = 0; c < starterCategories.length; c++) {
    const cat = starterCategories[c];
    const existing = await prisma.checklistCategory.findFirst({
      where: { templateId: template.id, name: cat.name },
    });
    const category =
      existing ??
      (await prisma.checklistCategory.create({
        data: {
          templateId: template.id,
          name: cat.name,
          sortOrder: c,
          updatedAt: now,
        },
      }));

    for (let i = 0; i < cat.items.length; i++) {
      const label = cat.items[i];
      const existingItem = await prisma.checklistItem.findFirst({
        where: { categoryId: category.id, label },
      });
      if (!existingItem) {
        await prisma.checklistItem.create({
          data: {
            categoryId: category.id,
            label,
            sortOrder: i,
            updatedAt: now,
          },
        });
      }
    }
  }
  console.log("Multimedia checklist starter template seeded.");
}
```

- [ ] **Step 2: Run seed**

Run: `npm run db:seed`

Expected output ends with `"Multimedia checklist starter template seeded."` and no errors.

- [ ] **Step 3: Verify in Prisma Studio (optional but recommended)**

Run: `npm run db:studio`

Open `ChecklistTemplate`, `ChecklistCategory`, `ChecklistItem` — confirm 1 template, 3 categories, 11 items. Close Studio.

- [ ] **Step 4: Prepare commit**

```
feat(checklist): seed starter template for Multimedia ministry

Three categories (PC1, PC2, Sound Mixer) with example items.
Idempotent — safe to re-run against existing data.
```

Stop for user review.

---

## Task 3: Add permission helpers and ministry-id / time helpers

**Files:**

- Modify: `lib/permissions.ts`
- Create: `lib/checklist.ts`

- [ ] **Step 1: Append four permission helpers to `lib/permissions.ts`**

Add at the end of the file:

```ts
// --- Multimedia checklist permissions ---

/** Everyone in the Multimedia ministry (plus admin) can view history — transparency, not management gate. */
export function canViewChecklistHistory(
  roleSlug: RoleSlug,
  userMinistryIds: string[],
  multimediaMinistryId: string
): boolean {
  if (roleSlug === "admin") return true;
  return userMinistryIds.includes(multimediaMinistryId);
}

/** Any Multimedia member (plus admin) can check/uncheck items on the live run. */
export function canToggleChecklistItem(
  roleSlug: RoleSlug,
  userMinistryIds: string[],
  multimediaMinistryId: string
): boolean {
  if (roleSlug === "admin") return true;
  return userMinistryIds.includes(multimediaMinistryId);
}

/** Only admin or Multimedia ministry_head can edit the template (add/reorder/archive). */
export function canEditChecklistTemplate(
  roleSlug: RoleSlug,
  userMinistryIds: string[],
  multimediaMinistryId: string
): boolean {
  if (roleSlug === "admin") return true;
  return roleSlug === "ministry_head" && userMinistryIds.includes(multimediaMinistryId);
}

/** Same set as template editing — start/close runs is a management action. */
export function canManageChecklistRuns(
  roleSlug: RoleSlug,
  userMinistryIds: string[],
  multimediaMinistryId: string
): boolean {
  return canEditChecklistTemplate(roleSlug, userMinistryIds, multimediaMinistryId);
}
```

- [ ] **Step 2: Create `lib/checklist.ts`**

```ts
/**
 * Shared helpers for the Multimedia checklist feature.
 *
 * Timezone note: all "Sunday" rollover logic is in Asia/Manila. Spec §8 is the
 * canonical reference — do not change these helpers without updating the spec.
 */

import { prisma } from "@/lib/prisma";

export const MULTIMEDIA_MINISTRY_SLUG = "multimedia";
export const CHECKLIST_CHANNEL = "checklist-multimedia";
export const CHECKLIST_TIMEZONE = "Asia/Manila";

/** Look up the Multimedia ministry id fresh on every call. Intentionally boring. */
export async function getMultimediaMinistryId(): Promise<string | null> {
  const ministry = await prisma.ministry.findUnique({
    where: { slug: MULTIMEDIA_MINISTRY_SLUG },
    select: { id: true },
  });
  return ministry?.id ?? null;
}

/**
 * Compute the next Sunday >= now in Asia/Manila, truncated to 00:00:00.
 * Returns a UTC Date whose wall-clock equivalent in Asia/Manila is Sunday 00:00.
 *
 * Logic: get today's date in Manila, find the current day-of-week, add days
 * until we land on Sunday (0). If today is Sunday and we're past 00:00, the
 * cron rule says "next Sunday" — see spec §8.1 step 1.
 */
export function computeUpcomingSundayManila(now: Date = new Date()): Date {
  // Get the Manila wall-clock components of `now`.
  const manila = new Date(now.toLocaleString("en-US", { timeZone: CHECKLIST_TIMEZONE }));
  const day = manila.getDay(); // 0 = Sunday
  // If it's exactly Sunday 00:00 Manila, use today; otherwise advance to the next Sunday.
  let daysToAdd: number;
  if (
    day === 0 &&
    manila.getHours() === 0 &&
    manila.getMinutes() === 0 &&
    manila.getSeconds() === 0
  ) {
    daysToAdd = 0;
  } else {
    daysToAdd = (7 - day) % 7;
    if (daysToAdd === 0) daysToAdd = 7; // today is Sunday but past 00:00 → next Sunday
  }
  const target = new Date(manila);
  target.setHours(0, 0, 0, 0);
  target.setDate(target.getDate() + daysToAdd);
  // `target` is still in the local JS timezone; convert to a UTC instant that represents Manila 00:00.
  // We do that by computing the Manila offset at `target` and subtracting it.
  const manilaOffsetMinutes = getManilaOffsetMinutes(target);
  return new Date(target.getTime() - manilaOffsetMinutes * 60 * 1000);
}

/** Start-of-today in Asia/Manila, returned as a UTC instant. */
export function startOfTodayManila(now: Date = new Date()): Date {
  const manila = new Date(now.toLocaleString("en-US", { timeZone: CHECKLIST_TIMEZONE }));
  manila.setHours(0, 0, 0, 0);
  const offset = getManilaOffsetMinutes(manila);
  return new Date(manila.getTime() - offset * 60 * 1000);
}

/**
 * Manila is UTC+08:00 year-round (no DST). Returning a constant is correct
 * and stable; we keep the function signature in case this ever changes.
 */
function getManilaOffsetMinutes(_at: Date): number {
  return 8 * 60;
}

/** Count complete items in a run: an item is "complete" if an ItemCheck row exists. */
export function computeRunProgress(
  items: Array<{ id: string; archivedAt: Date | null }>,
  checks: Array<{ itemId: string }>
): { total: number; complete: number; percent: number } {
  const active = items.filter((i) => i.archivedAt === null);
  const total = active.length;
  const checkedIds = new Set(checks.map((c) => c.itemId));
  const complete = active.filter((i) => checkedIds.has(i.id)).length;
  const percent = total === 0 ? 0 : Math.round((complete / total) * 100);
  return { total, complete, percent };
}
```

- [ ] **Step 3: Type-check**

Run: `npm run type-check`

Expected: zero errors.

- [ ] **Step 4: Lint**

Run: `npm run lint`

Expected: zero errors.

- [ ] **Step 5: Prepare commit**

```
feat(checklist): add permission helpers and time/ministry helpers

Four pure permission helpers (view history, toggle item, edit template,
manage runs) plus getMultimediaMinistryId, computeUpcomingSundayManila,
startOfTodayManila, and computeRunProgress in lib/checklist.ts.
```

Stop for user review.

---

## Task 4: Create Zod schemas for checklist mutations

**Files:**

- Create: `schemas/checklist.ts`
- Modify: `schemas/index.ts` (if it re-exports other schema files)

- [ ] **Step 1: Create `schemas/checklist.ts`**

```ts
import { z } from "zod";

export const checklistCategoryCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  sortOrder: z.number().int().min(0).optional(),
});

export const checklistCategoryPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    sortOrder: z.number().int().min(0).optional(),
  })
  .refine((v) => v.name !== undefined || v.sortOrder !== undefined, {
    message: "Provide at least one field to update",
  });

export const checklistItemCreateSchema = z.object({
  categoryId: z.string().min(1),
  label: z.string().trim().min(1).max(200),
  sortOrder: z.number().int().min(0).optional(),
});

export const checklistItemPatchSchema = z
  .object({
    label: z.string().trim().min(1).max(200).optional(),
    sortOrder: z.number().int().min(0).optional(),
    categoryId: z.string().min(1).optional(),
  })
  .refine((v) => v.label !== undefined || v.sortOrder !== undefined || v.categoryId !== undefined, {
    message: "Provide at least one field to update",
  });

export type ChecklistCategoryCreateInput = z.infer<typeof checklistCategoryCreateSchema>;
export type ChecklistCategoryPatchInput = z.infer<typeof checklistCategoryPatchSchema>;
export type ChecklistItemCreateInput = z.infer<typeof checklistItemCreateSchema>;
export type ChecklistItemPatchInput = z.infer<typeof checklistItemPatchSchema>;
```

- [ ] **Step 2: Re-export from `schemas/index.ts` if that file exists and re-exports other schemas**

Open `schemas/index.ts`. If it contains lines like `export * from "./arf";`, append:

```ts
export * from "./checklist";
```

If it doesn't exist or doesn't re-export others, skip this step.

- [ ] **Step 3: Type-check + lint**

Run: `npm run type-check && npm run lint`

Expected: zero errors.

- [ ] **Step 4: Prepare commit**

```
feat(checklist): add Zod schemas for category and item mutations
```

Stop for user review.

---

## Task 5: Create Pusher events wrapper

**Files:**

- Create: `services/checklistEvents.ts`

- [ ] **Step 1: Create the wrapper**

```ts
/**
 * Thin wrapper around Pusher publishing for checklist events.
 *
 * Mutation handlers import these functions instead of calling getPusher() directly,
 * so the channel name and event names are single points of truth. Mirrors the
 * services/notificationService.ts pattern.
 */

import { getPusher } from "@/lib/pusher";
import { CHECKLIST_CHANNEL } from "@/lib/checklist";

export type TemplateChangedKind =
  | "category-added"
  | "category-updated"
  | "category-archived"
  | "item-added"
  | "item-updated"
  | "item-archived";

export type RunChangedKind = "started" | "closed";

export interface ItemCheckedPayload {
  itemId: string;
  checkedById: string;
  checkedByName: string;
  checkedAt: string; // ISO
}

export async function publishItemChecked(payload: ItemCheckedPayload): Promise<void> {
  const pusher = getPusher();
  if (!pusher) return;
  await pusher.trigger(CHECKLIST_CHANNEL, "item-checked", payload).catch(() => {});
}

export async function publishItemUnchecked(itemId: string): Promise<void> {
  const pusher = getPusher();
  if (!pusher) return;
  await pusher.trigger(CHECKLIST_CHANNEL, "item-unchecked", { itemId }).catch(() => {});
}

export async function publishTemplateChanged(
  kind: TemplateChangedKind,
  entityId: string
): Promise<void> {
  const pusher = getPusher();
  if (!pusher) return;
  await pusher.trigger(CHECKLIST_CHANNEL, "template-changed", { kind, entityId }).catch(() => {});
}

export async function publishRunChanged(kind: RunChangedKind, runId: string): Promise<void> {
  const pusher = getPusher();
  if (!pusher) return;
  await pusher.trigger(CHECKLIST_CHANNEL, "run-changed", { kind, runId }).catch(() => {});
}
```

- [ ] **Step 2: Type-check + lint**

Run: `npm run type-check && npm run lint`

- [ ] **Step 3: Prepare commit**

```
feat(checklist): add Pusher events wrapper
```

Stop for user review.

---

## Task 6: GET /api/checklist/current — public hydration endpoint

**Files:**

- Create: `app/api/checklist/current/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMultimediaMinistryId } from "@/lib/checklist";

export const dynamic = "force-dynamic";

/**
 * Public endpoint — no auth. Returns the current Multimedia run (or null),
 * the live template (categories + non-archived items), and all ItemCheck rows
 * for the current run. Public page and admin landing both hydrate from this.
 */
export async function GET() {
  const ministryId = await getMultimediaMinistryId();
  if (!ministryId) {
    return NextResponse.json({ error: "Multimedia ministry not found" }, { status: 500 });
  }

  const template = await prisma.checklistTemplate.findUnique({
    where: { ministryId },
    include: {
      categories: {
        where: { archivedAt: null },
        orderBy: { sortOrder: "asc" },
        include: {
          items: {
            where: { archivedAt: null },
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
  });

  if (!template) {
    return NextResponse.json({ run: null, template: null, checks: [] });
  }

  const run = await prisma.checklistRun.findFirst({
    where: { templateId: template.id, closedAt: null },
    orderBy: { startedAt: "desc" },
  });

  const checks = run
    ? await prisma.itemCheck.findMany({
        where: { runId: run.id },
        include: { checkedBy: { select: { id: true, name: true } } },
      })
    : [];

  return NextResponse.json({
    run,
    template,
    checks: checks.map((c) => ({
      id: c.id,
      itemId: c.itemId,
      checkedById: c.checkedById,
      checkedByName: c.checkedBy.name,
      checkedAt: c.checkedAt.toISOString(),
    })),
  });
}
```

- [ ] **Step 2: Type-check + lint**

Run: `npm run type-check && npm run lint`

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev` (if not already running). In a browser open `http://localhost:3000/api/checklist/current`. Expected JSON: `{ run: null, template: { ... categories with items ... }, checks: [] }` (run is null because no run has been started yet — that's correct for a fresh install).

- [ ] **Step 4: Prepare commit**

```
feat(checklist): add public GET /api/checklist/current
```

Stop for user review.

---

## Task 7: POST/DELETE /api/checklist/items/[itemId]/check

**Files:**

- Create: `app/api/checklist/items/[itemId]/check/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canToggleChecklistItem, type RoleSlug } from "@/lib/permissions";
import { getMultimediaMinistryId } from "@/lib/checklist";
import { publishItemChecked, publishItemUnchecked } from "@/services/checklistEvents";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ itemId: string }> };

async function resolveAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const roleSlug = (session.roleSlug ?? "user") as RoleSlug;
  const ministryIds = session.ministryIds ?? [];
  const multimediaMinistryId = await getMultimediaMinistryId();
  if (!multimediaMinistryId) {
    return {
      error: NextResponse.json({ error: "Multimedia ministry not found" }, { status: 500 }),
    };
  }
  if (!canToggleChecklistItem(roleSlug, ministryIds, multimediaMinistryId)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session, multimediaMinistryId };
}

async function loadOpenRunAndItem(itemId: string, multimediaMinistryId: string) {
  const template = await prisma.checklistTemplate.findUnique({
    where: { ministryId: multimediaMinistryId },
    select: { id: true },
  });
  if (!template) return { error: "No checklist template" as const };

  const run = await prisma.checklistRun.findFirst({
    where: { templateId: template.id, closedAt: null },
    orderBy: { startedAt: "desc" },
  });
  if (!run) return { error: "No open run" as const };

  const item = await prisma.checklistItem.findUnique({
    where: { id: itemId },
    include: { category: { select: { name: true, templateId: true } } },
  });
  if (!item || item.archivedAt) return { error: "Item not found" as const };
  if (item.category.templateId !== template.id) return { error: "Item not in template" as const };

  return { run, item };
}

export async function POST(_request: Request, { params }: Params) {
  const { itemId } = await params;
  const auth = await resolveAuth();
  if ("error" in auth) return auth.error;

  const loaded = await loadOpenRunAndItem(itemId, auth.multimediaMinistryId);
  if ("error" in loaded) {
    const status = loaded.error === "No open run" ? 409 : 404;
    return NextResponse.json({ message: loaded.error }, { status });
  }
  const { run, item } = loaded;

  const user = await prisma.user.findUnique({
    where: { id: auth.session.userId },
    select: { name: true },
  });

  const check = await prisma.itemCheck.upsert({
    where: { runId_itemId: { runId: run.id, itemId: item.id } },
    create: {
      runId: run.id,
      itemId: item.id,
      checkedById: auth.session.userId,
      labelSnapshot: item.label,
      categoryNameSnapshot: item.category.name,
    },
    update: {
      checkedById: auth.session.userId,
      checkedAt: new Date(),
      labelSnapshot: item.label,
      categoryNameSnapshot: item.category.name,
    },
  });

  await publishItemChecked({
    itemId: item.id,
    checkedById: auth.session.userId,
    checkedByName: user?.name ?? "Unknown",
    checkedAt: check.checkedAt.toISOString(),
  });

  return NextResponse.json({ ok: true, check });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { itemId } = await params;
  const auth = await resolveAuth();
  if ("error" in auth) return auth.error;

  const loaded = await loadOpenRunAndItem(itemId, auth.multimediaMinistryId);
  if ("error" in loaded) {
    const status = loaded.error === "No open run" ? 409 : 404;
    return NextResponse.json({ message: loaded.error }, { status });
  }
  const { run, item } = loaded;

  await prisma.itemCheck
    .delete({ where: { runId_itemId: { runId: run.id, itemId: item.id } } })
    .catch(() => null); // idempotent — already unchecked is fine

  await publishItemUnchecked(item.id);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Type-check + lint**

Run: `npm run type-check && npm run lint`

- [ ] **Step 3: Prepare commit**

```
feat(checklist): add POST/DELETE check endpoint
```

Stop for user review.

---

## Task 8: Category CRUD routes

**Files:**

- Create: `app/api/checklist/categories/route.ts`
- Create: `app/api/checklist/categories/[id]/route.ts`

- [ ] **Step 1: Write `categories/route.ts` (POST create)**

```ts
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditChecklistTemplate, type RoleSlug } from "@/lib/permissions";
import { getMultimediaMinistryId } from "@/lib/checklist";
import { checklistCategoryCreateSchema } from "@/schemas/checklist";
import { publishTemplateChanged } from "@/services/checklistEvents";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const roleSlug = (session.roleSlug ?? "user") as RoleSlug;
  const ministryIds = session.ministryIds ?? [];
  const multimediaMinistryId = await getMultimediaMinistryId();
  if (!multimediaMinistryId) {
    return NextResponse.json({ error: "Multimedia ministry not found" }, { status: 500 });
  }
  if (!canEditChecklistTemplate(roleSlug, ministryIds, multimediaMinistryId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = checklistCategoryCreateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.errors[0]?.message ?? "Validation failed" },
      { status: 400 }
    );
  }

  const template = await prisma.checklistTemplate.findUnique({
    where: { ministryId: multimediaMinistryId },
    select: { id: true },
  });
  if (!template) {
    return NextResponse.json({ error: "No template" }, { status: 404 });
  }

  const sortOrder =
    parsed.data.sortOrder ??
    ((await prisma.checklistCategory.count({
      where: { templateId: template.id, archivedAt: null },
    })) as number);

  const category = await prisma.checklistCategory.create({
    data: {
      templateId: template.id,
      name: parsed.data.name,
      sortOrder,
      updatedAt: new Date(),
    },
  });

  await publishTemplateChanged("category-added", category.id);
  return NextResponse.json(category);
}
```

- [ ] **Step 2: Write `categories/[id]/route.ts` (PATCH + DELETE)**

```ts
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditChecklistTemplate, type RoleSlug } from "@/lib/permissions";
import { getMultimediaMinistryId } from "@/lib/checklist";
import { checklistCategoryPatchSchema } from "@/schemas/checklist";
import { publishTemplateChanged } from "@/services/checklistEvents";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function guard() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const roleSlug = (session.roleSlug ?? "user") as RoleSlug;
  const ministryIds = session.ministryIds ?? [];
  const multimediaMinistryId = await getMultimediaMinistryId();
  if (!multimediaMinistryId) {
    return {
      error: NextResponse.json({ error: "Multimedia ministry not found" }, { status: 500 }),
    };
  }
  if (!canEditChecklistTemplate(roleSlug, ministryIds, multimediaMinistryId)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session, multimediaMinistryId };
}

export async function PATCH(request: Request, { params }: Params) {
  const g = await guard();
  if ("error" in g) return g.error;
  const { id } = await params;

  const parsed = checklistCategoryPatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.errors[0]?.message ?? "Validation failed" },
      { status: 400 }
    );
  }

  const category = await prisma.checklistCategory.update({
    where: { id },
    data: {
      name: parsed.data.name,
      sortOrder: parsed.data.sortOrder,
      updatedAt: new Date(),
    },
  });

  await publishTemplateChanged("category-updated", category.id);
  return NextResponse.json(category);
}

export async function DELETE(_request: Request, { params }: Params) {
  const g = await guard();
  if ("error" in g) return g.error;
  const { id } = await params;

  // Soft-delete category and cascade archive to its items so they disappear from live view.
  const now = new Date();
  await prisma.$transaction([
    prisma.checklistCategory.update({
      where: { id },
      data: { archivedAt: now, updatedAt: now },
    }),
    prisma.checklistItem.updateMany({
      where: { categoryId: id, archivedAt: null },
      data: { archivedAt: now, updatedAt: now },
    }),
  ]);

  await publishTemplateChanged("category-archived", id);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Type-check + lint**

Run: `npm run type-check && npm run lint`

- [ ] **Step 4: Prepare commit**

```
feat(checklist): add category CRUD routes
```

Stop for user review.

---

## Task 9: Item CRUD routes

**Files:**

- Create: `app/api/checklist/items/route.ts`
- Create: `app/api/checklist/items/[id]/route.ts`

- [ ] **Step 1: Write `items/route.ts` (POST create)**

```ts
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditChecklistTemplate, type RoleSlug } from "@/lib/permissions";
import { getMultimediaMinistryId } from "@/lib/checklist";
import { checklistItemCreateSchema } from "@/schemas/checklist";
import { publishTemplateChanged } from "@/services/checklistEvents";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const roleSlug = (session.roleSlug ?? "user") as RoleSlug;
  const ministryIds = session.ministryIds ?? [];
  const multimediaMinistryId = await getMultimediaMinistryId();
  if (!multimediaMinistryId) {
    return NextResponse.json({ error: "Multimedia ministry not found" }, { status: 500 });
  }
  if (!canEditChecklistTemplate(roleSlug, ministryIds, multimediaMinistryId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = checklistItemCreateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.errors[0]?.message ?? "Validation failed" },
      { status: 400 }
    );
  }

  // Confirm the target category belongs to the Multimedia template.
  const category = await prisma.checklistCategory.findUnique({
    where: { id: parsed.data.categoryId },
    include: { template: { select: { ministryId: true } } },
  });
  if (!category || category.archivedAt || category.template.ministryId !== multimediaMinistryId) {
    return NextResponse.json({ message: "Category not found" }, { status: 404 });
  }

  const sortOrder =
    parsed.data.sortOrder ??
    ((await prisma.checklistItem.count({
      where: { categoryId: category.id, archivedAt: null },
    })) as number);

  const item = await prisma.checklistItem.create({
    data: {
      categoryId: category.id,
      label: parsed.data.label,
      sortOrder,
      updatedAt: new Date(),
    },
  });

  await publishTemplateChanged("item-added", item.id);
  return NextResponse.json(item);
}
```

- [ ] **Step 2: Write `items/[id]/route.ts` (PATCH + DELETE)**

```ts
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditChecklistTemplate, type RoleSlug } from "@/lib/permissions";
import { getMultimediaMinistryId } from "@/lib/checklist";
import { checklistItemPatchSchema } from "@/schemas/checklist";
import { publishTemplateChanged } from "@/services/checklistEvents";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function guard() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const roleSlug = (session.roleSlug ?? "user") as RoleSlug;
  const ministryIds = session.ministryIds ?? [];
  const multimediaMinistryId = await getMultimediaMinistryId();
  if (!multimediaMinistryId) {
    return {
      error: NextResponse.json({ error: "Multimedia ministry not found" }, { status: 500 }),
    };
  }
  if (!canEditChecklistTemplate(roleSlug, ministryIds, multimediaMinistryId)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session, multimediaMinistryId };
}

export async function PATCH(request: Request, { params }: Params) {
  const g = await guard();
  if ("error" in g) return g.error;
  const { id } = await params;

  const parsed = checklistItemPatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.errors[0]?.message ?? "Validation failed" },
      { status: 400 }
    );
  }

  // If reparenting, confirm the new category is in the Multimedia template.
  if (parsed.data.categoryId) {
    const newCat = await prisma.checklistCategory.findUnique({
      where: { id: parsed.data.categoryId },
      include: { template: { select: { ministryId: true } } },
    });
    if (!newCat || newCat.archivedAt || newCat.template.ministryId !== g.multimediaMinistryId) {
      return NextResponse.json({ message: "Target category not found" }, { status: 404 });
    }
  }

  const item = await prisma.checklistItem.update({
    where: { id },
    data: {
      label: parsed.data.label,
      sortOrder: parsed.data.sortOrder,
      categoryId: parsed.data.categoryId,
      updatedAt: new Date(),
    },
  });

  await publishTemplateChanged("item-updated", item.id);
  return NextResponse.json(item);
}

export async function DELETE(_request: Request, { params }: Params) {
  const g = await guard();
  if ("error" in g) return g.error;
  const { id } = await params;

  await prisma.checklistItem.update({
    where: { id },
    data: { archivedAt: new Date(), updatedAt: new Date() },
  });

  await publishTemplateChanged("item-archived", id);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Type-check + lint**

Run: `npm run type-check && npm run lint`

- [ ] **Step 4: Prepare commit**

```
feat(checklist): add item CRUD routes
```

Stop for user review.

---

## Task 10: Run lifecycle routes (start / close)

**Files:**

- Create: `app/api/checklist/runs/start/route.ts`
- Create: `app/api/checklist/runs/close/route.ts`

- [ ] **Step 1: Write `runs/start/route.ts`**

```ts
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageChecklistRuns, type RoleSlug } from "@/lib/permissions";
import { getMultimediaMinistryId, computeUpcomingSundayManila } from "@/lib/checklist";
import { publishRunChanged } from "@/services/checklistEvents";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const roleSlug = (session.roleSlug ?? "user") as RoleSlug;
  const ministryIds = session.ministryIds ?? [];
  const multimediaMinistryId = await getMultimediaMinistryId();
  if (!multimediaMinistryId) {
    return NextResponse.json({ error: "Multimedia ministry not found" }, { status: 500 });
  }
  if (!canManageChecklistRuns(roleSlug, ministryIds, multimediaMinistryId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const template = await prisma.checklistTemplate.findUnique({
    where: { ministryId: multimediaMinistryId },
    select: { id: true },
  });
  if (!template) {
    return NextResponse.json({ error: "No template" }, { status: 404 });
  }

  const existingOpen = await prisma.checklistRun.findFirst({
    where: { templateId: template.id, closedAt: null },
  });
  if (existingOpen) {
    return NextResponse.json({ message: "An open run already exists" }, { status: 409 });
  }

  const weekStart = computeUpcomingSundayManila();

  // If a CLOSED run already exists for this weekStart (unlikely but possible),
  // return 409 — the unique constraint would fail on insert anyway.
  const existingAny = await prisma.checklistRun.findUnique({
    where: { templateId_weekStart: { templateId: template.id, weekStart } },
  });
  if (existingAny) {
    return NextResponse.json({ message: "A run already exists for this week" }, { status: 409 });
  }

  const run = await prisma.checklistRun.create({
    data: {
      templateId: template.id,
      weekStart,
      startedAt: new Date(),
      startedById: session.userId,
    },
  });

  await publishRunChanged("started", run.id);
  return NextResponse.json(run);
}
```

- [ ] **Step 2: Write `runs/close/route.ts`**

```ts
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageChecklistRuns, type RoleSlug } from "@/lib/permissions";
import { getMultimediaMinistryId } from "@/lib/checklist";
import { publishRunChanged } from "@/services/checklistEvents";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const roleSlug = (session.roleSlug ?? "user") as RoleSlug;
  const ministryIds = session.ministryIds ?? [];
  const multimediaMinistryId = await getMultimediaMinistryId();
  if (!multimediaMinistryId) {
    return NextResponse.json({ error: "Multimedia ministry not found" }, { status: 500 });
  }
  if (!canManageChecklistRuns(roleSlug, ministryIds, multimediaMinistryId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const template = await prisma.checklistTemplate.findUnique({
    where: { ministryId: multimediaMinistryId },
    select: { id: true },
  });
  if (!template) {
    return NextResponse.json({ error: "No template" }, { status: 404 });
  }

  const openRun = await prisma.checklistRun.findFirst({
    where: { templateId: template.id, closedAt: null },
  });
  if (!openRun) {
    return NextResponse.json({ message: "No open run" }, { status: 404 });
  }

  const closed = await prisma.checklistRun.update({
    where: { id: openRun.id },
    data: { closedAt: new Date(), closedById: session.userId },
  });

  await publishRunChanged("closed", closed.id);
  return NextResponse.json(closed);
}
```

- [ ] **Step 3: Type-check + lint**

Run: `npm run type-check && npm run lint`

- [ ] **Step 4: Prepare commit**

```
feat(checklist): add run start/close routes
```

Stop for user review.

---

## Task 11: Run list + drill-down routes

**Files:**

- Create: `app/api/checklist/runs/route.ts`
- Create: `app/api/checklist/runs/[id]/route.ts`

- [ ] **Step 1: Write `runs/route.ts` (paginated list for history)**

```ts
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewChecklistHistory, type RoleSlug } from "@/lib/permissions";
import { getMultimediaMinistryId, computeRunProgress } from "@/lib/checklist";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const roleSlug = (session.roleSlug ?? "user") as RoleSlug;
  const ministryIds = session.ministryIds ?? [];
  const multimediaMinistryId = await getMultimediaMinistryId();
  if (!multimediaMinistryId) {
    return NextResponse.json({ error: "Multimedia ministry not found" }, { status: 500 });
  }
  if (!canViewChecklistHistory(roleSlug, ministryIds, multimediaMinistryId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 20), 100);
  const cursor = url.searchParams.get("cursor");

  const template = await prisma.checklistTemplate.findUnique({
    where: { ministryId: multimediaMinistryId },
    select: { id: true },
  });
  if (!template) return NextResponse.json({ runs: [], nextCursor: null });

  const runs = await prisma.checklistRun.findMany({
    where: { templateId: template.id },
    orderBy: { weekStart: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      startedBy: { select: { id: true, name: true } },
      closedBy: { select: { id: true, name: true } },
      checks: { select: { itemId: true, checkedAt: true } },
      template: {
        include: {
          categories: {
            include: { items: { select: { id: true, archivedAt: true, createdAt: true } } },
          },
        },
      },
    },
  });

  const hasMore = runs.length > limit;
  const rows = hasMore ? runs.slice(0, limit) : runs;

  const shaped = rows.map((run) => {
    const allItems = run.template.categories.flatMap((c) => c.items);
    const { total, complete, percent } = computeRunProgress(allItems, run.checks);
    const midServiceAdds = allItems.filter((i) => i.createdAt > run.startedAt).length;
    const times = run.checks.map((c) => c.checkedAt.getTime());
    const durationMs = times.length >= 2 ? Math.max(...times) - Math.min(...times) : 0;
    return {
      id: run.id,
      weekStart: run.weekStart,
      startedAt: run.startedAt,
      closedAt: run.closedAt,
      startedBy: run.startedBy?.name ?? null,
      closedBy: run.closedBy?.name ?? null,
      total,
      complete,
      percent,
      midServiceAdds,
      durationMs,
    };
  });

  return NextResponse.json({
    runs: shaped,
    nextCursor: hasMore ? rows[rows.length - 1].id : null,
  });
}
```

- [ ] **Step 2: Write `runs/[id]/route.ts` (drill-down)**

```ts
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewChecklistHistory, type RoleSlug } from "@/lib/permissions";
import { getMultimediaMinistryId } from "@/lib/checklist";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const roleSlug = (session.roleSlug ?? "user") as RoleSlug;
  const ministryIds = session.ministryIds ?? [];
  const multimediaMinistryId = await getMultimediaMinistryId();
  if (!multimediaMinistryId) {
    return NextResponse.json({ error: "Multimedia ministry not found" }, { status: 500 });
  }
  if (!canViewChecklistHistory(roleSlug, ministryIds, multimediaMinistryId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const run = await prisma.checklistRun.findUnique({
    where: { id },
    include: {
      startedBy: { select: { id: true, name: true } },
      closedBy: { select: { id: true, name: true } },
      template: {
        include: {
          categories: {
            orderBy: { sortOrder: "asc" },
            include: {
              items: {
                orderBy: { sortOrder: "asc" },
                select: { id: true, label: true, archivedAt: true, createdAt: true },
              },
            },
          },
        },
      },
      checks: {
        include: {
          checkedBy: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!run || run.template.ministryId !== multimediaMinistryId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ run });
}
```

- [ ] **Step 3: Type-check + lint**

Run: `npm run type-check && npm run lint`

- [ ] **Step 4: Prepare commit**

```
feat(checklist): add run list and drill-down endpoints
```

Stop for user review.

---

## Task 12: Stats endpoint (trends, reliability, people)

**Files:**

- Create: `app/api/checklist/stats/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewChecklistHistory, type RoleSlug } from "@/lib/permissions";
import { getMultimediaMinistryId, computeRunProgress } from "@/lib/checklist";

export const dynamic = "force-dynamic";

const HISTORY_WINDOW = 12;

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const roleSlug = (session.roleSlug ?? "user") as RoleSlug;
  const ministryIds = session.ministryIds ?? [];
  const multimediaMinistryId = await getMultimediaMinistryId();
  if (!multimediaMinistryId) {
    return NextResponse.json({ error: "Multimedia ministry not found" }, { status: 500 });
  }
  if (!canViewChecklistHistory(roleSlug, ministryIds, multimediaMinistryId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const view = new URL(request.url).searchParams.get("view") ?? "trends";
  if (view !== "trends" && view !== "reliability" && view !== "people") {
    return NextResponse.json({ message: "Invalid view" }, { status: 400 });
  }

  const template = await prisma.checklistTemplate.findUnique({
    where: { ministryId: multimediaMinistryId },
    select: { id: true },
  });
  if (!template) return NextResponse.json({ view, data: [] });

  if (view === "trends") {
    const runs = await prisma.checklistRun.findMany({
      where: { templateId: template.id },
      orderBy: { weekStart: "desc" },
      take: HISTORY_WINDOW,
      include: {
        checks: { select: { itemId: true, checkedAt: true } },
        template: {
          include: {
            categories: { include: { items: { select: { id: true, archivedAt: true } } } },
          },
        },
      },
    });
    const rows = runs
      .map((r) => {
        const items = r.template.categories.flatMap((c) => c.items);
        const { percent } = computeRunProgress(items, r.checks);
        const times = r.checks.map((c) => c.checkedAt.getTime());
        const durationMinutes =
          times.length >= 2 ? Math.round((Math.max(...times) - Math.min(...times)) / 60000) : 0;
        return { runId: r.id, weekStart: r.weekStart, percent, durationMinutes };
      })
      .reverse(); // chronological left-to-right for charts
    return NextResponse.json({ view, data: rows });
  }

  if (view === "reliability") {
    // For each non-archived item, count checks and total runs it could have appeared in.
    const recentRuns = await prisma.checklistRun.findMany({
      where: { templateId: template.id },
      orderBy: { weekStart: "desc" },
      take: HISTORY_WINDOW,
      select: { id: true, startedAt: true },
    });
    const runIds = recentRuns.map((r) => r.id);

    const items = await prisma.checklistItem.findMany({
      where: { archivedAt: null, category: { templateId: template.id } },
      include: {
        category: { select: { name: true } },
        checks: { where: { runId: { in: runIds } }, select: { runId: true } },
      },
    });

    const rows = items.map((item) => {
      // An item counts toward a run only if the item existed at the run's startedAt.
      const eligibleRuns = recentRuns.filter((r) => r.startedAt >= item.createdAt).length;
      const checkedRunIds = new Set(item.checks.map((c) => c.runId));
      const timesChecked = checkedRunIds.size;
      const timesMissed = Math.max(0, eligibleRuns - timesChecked);
      const missRate = eligibleRuns === 0 ? 0 : timesMissed / eligibleRuns;
      return {
        itemId: item.id,
        category: item.category.name,
        label: item.label,
        timesChecked,
        timesMissed,
        missRate: Math.round(missRate * 1000) / 10, // 1dp percent
      };
    });
    rows.sort((a, b) => b.missRate - a.missRate);
    return NextResponse.json({ view, data: rows });
  }

  // view === "people"
  const recentRuns = await prisma.checklistRun.findMany({
    where: { templateId: template.id },
    orderBy: { weekStart: "desc" },
    take: HISTORY_WINDOW,
    select: { id: true },
  });
  const runIds = recentRuns.map((r) => r.id);

  const checksByUser = await prisma.itemCheck.findMany({
    where: { runId: { in: runIds } },
    include: { checkedBy: { select: { id: true, name: true } } },
  });

  const byUser = new Map<
    string,
    { userId: string; name: string; runs: Set<string>; total: number; last: Date }
  >();
  for (const c of checksByUser) {
    const existing = byUser.get(c.checkedById);
    if (existing) {
      existing.runs.add(c.runId);
      existing.total += 1;
      if (c.checkedAt > existing.last) existing.last = c.checkedAt;
    } else {
      byUser.set(c.checkedById, {
        userId: c.checkedById,
        name: c.checkedBy.name,
        runs: new Set([c.runId]),
        total: 1,
        last: c.checkedAt,
      });
    }
  }

  const rows = Array.from(byUser.values())
    .map((u) => ({
      userId: u.userId,
      name: u.name,
      runsParticipated: u.runs.size,
      totalRuns: recentRuns.length,
      totalChecked: u.total,
      avgPerRun: u.runs.size === 0 ? 0 : Math.round((u.total / u.runs.size) * 10) / 10,
      lastActive: u.last.toISOString(),
    }))
    .sort((a, b) => b.totalChecked - a.totalChecked);

  return NextResponse.json({ view, data: rows });
}
```

- [ ] **Step 2: Type-check + lint**

Run: `npm run type-check && npm run lint`

- [ ] **Step 3: Prepare commit**

```
feat(checklist): add stats endpoint (trends, reliability, people)
```

Stop for user review.

---

## Task 13: Cron reset endpoint

**Files:**

- Create: `app/api/cron/checklist-reset/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getMultimediaMinistryId,
  computeUpcomingSundayManila,
  startOfTodayManila,
} from "@/lib/checklist";
import { publishRunChanged } from "@/services/checklistEvents";

export const dynamic = "force-dynamic";

/**
 * Cron endpoint — idempotent, safe to run repeatedly.
 * Matches the Authorization: Bearer $CRON_SECRET pattern used by /api/cron/reminders.
 * See spec §8.1 for the logic contract.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const multimediaMinistryId = await getMultimediaMinistryId();
  if (!multimediaMinistryId) {
    return NextResponse.json({ error: "Multimedia ministry not found" }, { status: 500 });
  }

  const template = await prisma.checklistTemplate.findUnique({
    where: { ministryId: multimediaMinistryId },
    select: { id: true },
  });
  if (!template) {
    return NextResponse.json({ closed: 0, started: null, message: "No template" });
  }

  const todayStart = startOfTodayManila();
  const upcoming = computeUpcomingSundayManila();
  const closed: string[] = [];
  let started: string | null = null;

  // 1. Close all open runs whose weekStart has already passed.
  const openRuns = await prisma.checklistRun.findMany({
    where: { templateId: template.id, closedAt: null },
  });
  for (const run of openRuns) {
    if (run.weekStart < todayStart) {
      await prisma.checklistRun.update({
        where: { id: run.id },
        data: { closedAt: new Date(), closedById: null },
      });
      await publishRunChanged("closed", run.id);
      closed.push(run.id);
    }
  }

  // 2. If no run exists for the upcoming Sunday yet, open one.
  const existing = await prisma.checklistRun.findUnique({
    where: { templateId_weekStart: { templateId: template.id, weekStart: upcoming } },
  });
  if (!existing) {
    const created = await prisma.checklistRun.create({
      data: {
        templateId: template.id,
        weekStart: upcoming,
        startedAt: new Date(),
        startedById: null,
      },
    });
    await publishRunChanged("started", created.id);
    started = created.id;
  }

  return NextResponse.json({ closed, started });
}
```

- [ ] **Step 2: Type-check + lint**

Run: `npm run type-check && npm run lint`

- [ ] **Step 3: Manual test**

With `npm run dev` running, call the endpoint:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/checklist-reset
```

(If `CRON_SECRET` is unset in your `.env`, omit the `-H` flag — the route allows unauthenticated access when no secret is configured.)

Expected: `{"closed":[],"started":"cl..."}` on first run (opens a new run). Run it again: `{"closed":[],"started":null}` (idempotent).

Verify in the database (or `npm run db:studio`) that one `ChecklistRun` row now exists for the upcoming Sunday with `startedById: null`.

- [ ] **Step 4: Prepare commit**

```
feat(checklist): add cron reset endpoint
```

Stop for user review.

---

## Task 14: Public checklist layout + scoped CSS

**Files:**

- Create: `app/(public)/checklist/layout.tsx`
- Create: `app/(public)/checklist/checklist.css`

- [ ] **Step 1: Create the scoped CSS**

```css
/* Tech-ops dark theme for the public checklist page.
   Scoped under .checklist-root so it never leaks into the dashboard. */

.checklist-root {
  --bg-deep: #050a14;
  --bg-panel: #0b1220;
  --bg-panel-2: #0f172a;
  --bg-panel-3: #1e293b;
  --cl-border: #1e293b;
  --cl-border-hi: #334155;
  --cl-text: #e2e8f0;
  --cl-text-dim: #94a3b8;
  --cl-text-dimmer: #64748b;
  --cl-cyan: #22d3ee;
  --cl-cyan-dim: rgba(34, 211, 238, 0.15);
  --cl-cyan-border: rgba(34, 211, 238, 0.35);
  --cl-green: #4ade80;
  --cl-red: #f87171;
  --cl-mono: "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace;
  background: var(--bg-deep);
  color: var(--cl-text);
  min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.checklist-root .cl-container {
  max-width: 860px;
  margin: 0 auto;
  padding: 28px 24px 64px;
}

.checklist-root .cl-topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}
.checklist-root .cl-brand {
  font-family: var(--cl-mono);
  font-size: 13px;
  color: var(--cl-cyan);
  letter-spacing: 0.05em;
}
.checklist-root .cl-brand span {
  color: var(--cl-text-dim);
}
.checklist-root .cl-status {
  font-family: var(--cl-mono);
  font-size: 10px;
  color: var(--cl-cyan);
  background: var(--cl-cyan-dim);
  border: 1px solid var(--cl-cyan-border);
  padding: 4px 10px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.checklist-root .cl-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--cl-cyan);
  box-shadow: 0 0 6px var(--cl-cyan);
  animation: cl-pulse 1.8s ease-in-out infinite;
}
@keyframes cl-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}

.checklist-root .cl-hero {
  background: var(--bg-panel-2);
  border: 1px solid var(--cl-border);
  border-radius: 10px;
  padding: 22px 24px;
  margin-bottom: 28px;
}
.checklist-root .cl-hero h1 {
  margin: 0 0 4px;
  font-size: 22px;
  font-weight: 700;
  color: var(--cl-text);
}
.checklist-root .cl-date {
  color: var(--cl-text-dim);
  font-size: 13px;
  margin-bottom: 18px;
}
.checklist-root .cl-progress-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 8px;
  font-size: 12px;
}
.checklist-root .cl-progress-row .cl-count,
.checklist-root .cl-progress-row .cl-pct {
  font-family: var(--cl-mono);
  font-size: 14px;
}
.checklist-root .cl-progress-row .cl-count {
  color: var(--cl-text);
}
.checklist-root .cl-progress-row .cl-pct {
  color: var(--cl-cyan);
}
.checklist-root .cl-progress-bar {
  height: 10px;
  background: var(--bg-panel-3);
  border-radius: 5px;
  overflow: hidden;
  border: 1px solid var(--cl-border);
}
.checklist-root .cl-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--cl-cyan), var(--cl-green));
  box-shadow: 0 0 18px rgba(34, 211, 238, 0.5);
  transition: width 0.3s ease;
}

.checklist-root .cl-category {
  margin-bottom: 28px;
}
.checklist-root .cl-cat-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.checklist-root .cl-cat-tag {
  font-family: var(--cl-mono);
  font-size: 10px;
  color: var(--cl-cyan);
  background: var(--bg-panel-2);
  border: 1px solid var(--cl-cyan-border);
  padding: 4px 8px;
  border-radius: 4px;
  letter-spacing: 0.1em;
}
.checklist-root .cl-cat-title {
  font-size: 13px;
  color: var(--cl-text);
  font-weight: 600;
}
.checklist-root .cl-cat-count {
  font-family: var(--cl-mono);
  font-size: 11px;
  color: var(--cl-text-dimmer);
  margin-left: auto;
}

.checklist-root .cl-items {
  background: var(--bg-panel-2);
  border: 1px solid var(--cl-border);
  border-radius: 8px;
  overflow: hidden;
}
.checklist-root .cl-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 13px 16px;
  border-top: 1px solid var(--cl-border);
  font-size: 14px;
}
.checklist-root .cl-item:first-child {
  border-top: none;
}
.checklist-root .cl-check {
  width: 20px;
  height: 20px;
  border: 1.5px solid var(--cl-border-hi);
  background: var(--bg-panel-3);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  flex-shrink: 0;
  transition: all 0.15s;
  padding: 0;
  color: var(--cl-text);
}
.checklist-root .cl-check.done {
  background: var(--cl-cyan);
  border-color: var(--cl-cyan);
  color: var(--bg-deep);
  box-shadow: 0 0 10px rgba(34, 211, 238, 0.5);
}
.checklist-root .cl-item.done .cl-item-label {
  color: var(--cl-text-dimmer);
  text-decoration: line-through;
}
.checklist-root .cl-item-label {
  flex: 1;
  color: var(--cl-text);
}
.checklist-root .cl-item-meta {
  font-family: var(--cl-mono);
  font-size: 10px;
  color: var(--cl-text-dimmer);
}

.checklist-root.can-check .cl-check {
  cursor: pointer;
}
.checklist-root.can-check .cl-check:not(.done):hover {
  border-color: var(--cl-cyan);
  box-shadow: 0 0 6px rgba(34, 211, 238, 0.3);
}

.checklist-root .cl-signed-banner {
  background: var(--cl-cyan-dim);
  border: 1px solid var(--cl-cyan-border);
  border-radius: 8px;
  padding: 10px 14px;
  font-family: var(--cl-mono);
  font-size: 11px;
  color: var(--cl-cyan);
  margin-bottom: 22px;
}

.checklist-root .cl-empty {
  text-align: center;
  padding: 60px 20px;
  color: var(--cl-text-dim);
}
```

- [ ] **Step 2: Create `app/(public)/checklist/layout.tsx`**

```tsx
import type { ReactNode } from "react";
import "./checklist.css";

export const metadata = {
  title: "Multimedia Checklist",
  description: "Sunday setup checklist for the Multimedia ministry",
};

export default function ChecklistLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
```

- [ ] **Step 3: Type-check + lint**

Run: `npm run type-check && npm run lint`

- [ ] **Step 4: Prepare commit**

```
feat(checklist): add public layout and scoped tech-ops theme
```

Stop for user review.

---

## Task 15: Public checklist page (server component)

**Files:**

- Create: `app/(public)/checklist/page.tsx`

- [ ] **Step 1: Write the server component**

```tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canToggleChecklistItem, type RoleSlug } from "@/lib/permissions";
import { getMultimediaMinistryId } from "@/lib/checklist";
import { ChecklistPublicClient } from "@/features/checklist/ChecklistPublicClient";

export const dynamic = "force-dynamic";

export default async function ChecklistPage() {
  const multimediaMinistryId = await getMultimediaMinistryId();
  if (!multimediaMinistryId) {
    return (
      <div className="checklist-root">
        <div className="cl-container">
          <div className="cl-empty">Multimedia ministry is not configured.</div>
        </div>
      </div>
    );
  }

  const template = await prisma.checklistTemplate.findUnique({
    where: { ministryId: multimediaMinistryId },
    include: {
      categories: {
        where: { archivedAt: null },
        orderBy: { sortOrder: "asc" },
        include: {
          items: {
            where: { archivedAt: null },
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
  });

  const run = template
    ? await prisma.checklistRun.findFirst({
        where: { templateId: template.id, closedAt: null },
        orderBy: { startedAt: "desc" },
      })
    : null;

  const checks = run
    ? await prisma.itemCheck.findMany({
        where: { runId: run.id },
        include: { checkedBy: { select: { id: true, name: true } } },
      })
    : [];

  // Resolve whether the viewer can interact. Public render is fine with session === null.
  const session = await getServerSession(authOptions);
  const canCheck = session?.userId
    ? canToggleChecklistItem(
        (session.roleSlug ?? "user") as RoleSlug,
        session.ministryIds ?? [],
        multimediaMinistryId
      )
    : false;

  return (
    <ChecklistPublicClient
      template={template}
      run={run}
      initialChecks={checks.map((c) => ({
        id: c.id,
        itemId: c.itemId,
        checkedById: c.checkedById,
        checkedByName: c.checkedBy.name,
        checkedAt: c.checkedAt.toISOString(),
      }))}
      canCheck={canCheck}
      currentUserId={session?.userId ?? null}
      currentUserName={session?.user?.name ?? null}
    />
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`

Expected: one error about `ChecklistPublicClient` not existing — that's intentional, Task 16 creates it.

- [ ] **Step 3: Skip commit for now**

Do not prepare a commit yet. Move directly to Task 16; commit the server component + client together at the end of Task 16.

---

## Task 16: Public checklist client component (interactive + Pusher)

**Files:**

- Create: `features/checklist/ChecklistPublicClient.tsx`

- [ ] **Step 1: Write the client component**

```tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Pusher from "pusher-js";
import { CelebrationOverlay } from "./CelebrationOverlay";

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

function formatHHMM(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

function formatDateLabel(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
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

  // ---- Hydration from server on template/run change ---------------
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

  // ---- Pusher subscription ---------------------------------------
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

  // ---- Toggle handler (optimistic) --------------------------------
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
          // rollback
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

  // ---- Render ----------------------------------------------------
  if (!liveTemplate || !liveRun) {
    return (
      <div className="checklist-root">
        <div className="cl-container">
          <div className="cl-topbar">
            <div className="cl-brand">
              // multimedia.checklist <span>&middot; sunday service</span>
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
    <div className={`checklist-root${canCheck ? "can-check" : ""}`}>
      <div className="cl-container">
        <div className="cl-topbar">
          <div className="cl-brand">
            // multimedia.checklist <span>&middot; sunday service</span>
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
          <div className="cl-date">{formatDateLabel(liveRun.weekStart)}</div>
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
                  const CheckEl = canCheck ? "button" : "div";
                  return (
                    <div key={item.id} className={`cl-item${isDone ? "done" : ""}`}>
                      <CheckEl
                        type={canCheck ? "button" : undefined}
                        className={`cl-check${isDone ? "done" : ""}`}
                        onClick={canCheck ? () => toggle(item.id) : undefined}
                        aria-label={isDone ? `Uncheck ${item.label}` : `Check ${item.label}`}
                      >
                        {isDone ? "✓" : ""}
                      </CheckEl>
                      <div className="cl-item-label">{item.label}</div>
                      <div className="cl-item-meta">
                        {check
                          ? `${check.checkedById === currentUserId ? "you" : check.checkedByName} · ${formatHHMM(check.checkedAt)}`
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
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`

Expected: one error about `CelebrationOverlay` not existing — that's Task 17.

- [ ] **Step 3: Skip commit**

Continue to Task 17; commit all three files (page, client, celebration) together at the end of Task 17.

---

## Task 17: CelebrationOverlay component

**Files:**

- Create: `features/checklist/CelebrationOverlay.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface Props {
  runId: string;
  active: boolean; // true while 100% complete
}

const STORAGE_PREFIX = "checklist-celebration-";

export function CelebrationOverlay({ runId, active }: Props) {
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const prevActiveRef = useRef(active);

  // On a 100%-crossing edge, check localStorage and maybe fire the fullscreen.
  useEffect(() => {
    const wasActive = prevActiveRef.current;
    prevActiveRef.current = active;

    if (active && !wasActive) {
      // crossed to 100%
      const key = `${STORAGE_PREFIX}${runId}`;
      const seen = typeof window !== "undefined" ? window.localStorage.getItem(key) : "1";
      if (!seen) {
        setShowFullscreen(true);
        try {
          window.localStorage.setItem(key, "1");
        } catch {
          /* ignore */
        }
        const t = setTimeout(() => {
          setShowFullscreen(false);
          setShowBanner(true);
        }, 4000);
        return () => clearTimeout(t);
      } else {
        setShowBanner(true);
      }
    } else if (!active && wasActive) {
      setShowFullscreen(false);
      setShowBanner(false);
    }
  }, [active, runId]);

  return (
    <>
      <AnimatePresence>
        {showBanner && active ? (
          <motion.div
            key="banner"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            style={{
              position: "fixed",
              top: 20,
              left: "50%",
              transform: "translateX(-50%)",
              background: "linear-gradient(90deg, rgba(34,211,238,0.22), rgba(74,222,128,0.18))",
              border: "1px solid #22d3ee",
              borderRadius: 8,
              padding: "12px 18px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              boxShadow: "0 0 24px rgba(34,211,238,0.25)",
              zIndex: 20,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "#22d3ee",
                color: "#050a14",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              ✓
            </div>
            <div style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 600 }}>
              All systems ready — to God be the glory
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {showFullscreen ? (
          <motion.div
            key="fullscreen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            style={{
              position: "fixed",
              inset: 0,
              background:
                "radial-gradient(ellipse at center, rgba(34,211,238,0.2), rgba(5,10,20,0.98) 70%)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 50,
              pointerEvents: "none",
            }}
          >
            {/* Simple hand-rolled confetti using framer-motion particles */}
            {Array.from({ length: 24 }).map((_, i) => (
              <motion.span
                key={i}
                initial={{ y: -40, x: (i - 12) * 24, opacity: 0, rotate: 0 }}
                animate={{
                  y: [0, 200, 340],
                  opacity: [0, 1, 0.8, 0],
                  rotate: [0, 120, 240, 360],
                }}
                transition={{ duration: 2.8, delay: 0.2 + (i % 6) * 0.08, ease: "easeOut" }}
                style={{
                  position: "absolute",
                  top: "25%",
                  left: "50%",
                  width: 8,
                  height: 14,
                  background: i % 3 === 0 ? "#22d3ee" : i % 3 === 1 ? "#4ade80" : "#fbbf24",
                  borderRadius: 2,
                }}
              />
            ))}
            <motion.div
              initial={{ scale: 0, rotate: -45 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 12 }}
              style={{
                width: 120,
                height: 120,
                borderRadius: "50%",
                background: "#22d3ee",
                color: "#050a14",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 68,
                marginBottom: 24,
                boxShadow: "0 0 60px rgba(34,211,238,0.6)",
              }}
            >
              ✓
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              style={{
                fontSize: 36,
                fontWeight: 800,
                margin: 0,
                color: "#22d3ee",
                textShadow: "0 0 20px rgba(34,211,238,0.4)",
              }}
            >
              All Systems Ready
            </motion.h1>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              style={{ color: "#94a3b8", fontSize: 16, marginTop: 10 }}
            >
              To God be the glory.
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
```

- [ ] **Step 2: Type-check + lint**

Run: `npm run type-check && npm run lint`

Expected: zero errors.

- [ ] **Step 3: Manual test**

With `npm run dev` running:

1. First, open a new run via: `curl -X POST -H "Cookie: $(your auth cookie)" http://localhost:3000/api/checklist/runs/start` — or log in as admin in the browser and hit `POST /api/checklist/runs/start` via browser devtools fetch. (Simpler path: skip this for now and come back after Task 20 which adds the Start button.)
2. Open `http://localhost:3000/checklist` in an incognito window. Expected: the dark page renders with the 11 seeded items and zero progress (read-only checkboxes).
3. Log in as admin in a normal window, go to `/checklist`. Expected: "SIGNED IN AS ..." banner appears, checkboxes become clickable. Click one. Progress bar advances. Watch the incognito tab — should update live via Pusher.

If the manual test for (1) is awkward without Task 20, postpone the full-flow test until after Task 20 and just verify the page renders with empty state here.

- [ ] **Step 4: Prepare commit (page + client + overlay)**

```
feat(checklist): add public page, interactive client, and celebration overlay
```

Stop for user review.

---

## Task 18: Dashboard landing page + client

**Files:**

- Create: `app/(dashboard)/dashboard/multimedia-checklist/page.tsx`
- Create: `features/checklist/ChecklistLandingClient.tsx`

- [ ] **Step 1: Write the server page**

```tsx
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewChecklistHistory, type RoleSlug } from "@/lib/permissions";
import { getMultimediaMinistryId, computeRunProgress } from "@/lib/checklist";
import { ChecklistLandingClient } from "@/features/checklist/ChecklistLandingClient";

export const dynamic = "force-dynamic";

export default async function MultimediaChecklistLanding() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login?callbackUrl=/dashboard/multimedia-checklist");

  const multimediaMinistryId = await getMultimediaMinistryId();
  if (!multimediaMinistryId) {
    return <div className="p-page">Multimedia ministry not configured.</div>;
  }

  const roleSlug = (session.roleSlug ?? "user") as RoleSlug;
  const ministryIds = session.ministryIds ?? [];
  if (!canViewChecklistHistory(roleSlug, ministryIds, multimediaMinistryId)) {
    redirect("/dashboard");
  }

  const canManage =
    roleSlug === "admin" ||
    (roleSlug === "ministry_head" && ministryIds.includes(multimediaMinistryId));

  const template = await prisma.checklistTemplate.findUnique({
    where: { ministryId: multimediaMinistryId },
    include: {
      categories: {
        where: { archivedAt: null },
        include: { items: { where: { archivedAt: null } } },
      },
    },
  });

  const run = template
    ? await prisma.checklistRun.findFirst({
        where: { templateId: template.id, closedAt: null },
        orderBy: { startedAt: "desc" },
        include: {
          startedBy: { select: { name: true } },
          checks: {
            orderBy: { checkedAt: "desc" },
            take: 10,
            include: { checkedBy: { select: { name: true } } },
          },
        },
      })
    : null;

  const items = template?.categories.flatMap((c) => c.items) ?? [];
  const progress = run
    ? computeRunProgress(items, run.checks)
    : { total: 0, complete: 0, percent: 0 };

  // Last 4 runs average completion
  const recentRuns = template
    ? await prisma.checklistRun.findMany({
        where: { templateId: template.id, closedAt: { not: null } },
        orderBy: { weekStart: "desc" },
        take: 4,
        include: {
          checks: { select: { itemId: true } },
          template: {
            include: {
              categories: { include: { items: { select: { id: true, archivedAt: true } } } },
            },
          },
        },
      })
    : [];
  const avgRecent =
    recentRuns.length === 0
      ? 0
      : Math.round(
          recentRuns
            .map((r) => {
              const rItems = r.template.categories.flatMap((c) => c.items);
              return computeRunProgress(rItems, r.checks).percent;
            })
            .reduce((a, b) => a + b, 0) / recentRuns.length
        );

  // Count distinct checkers on the current run — separate query so the recent-activity
  // `run.checks` (limited to 10) doesn't skew this number.
  const activeMembers = run
    ? (
        await prisma.itemCheck.findMany({
          where: { runId: run.id },
          distinct: ["checkedById"],
          select: { checkedById: true },
        })
      ).length
    : 0;

  return (
    <ChecklistLandingClient
      canManage={canManage}
      run={
        run
          ? {
              id: run.id,
              weekStart: run.weekStart.toISOString(),
              startedAt: run.startedAt.toISOString(),
              startedByName: run.startedBy?.name ?? null,
            }
          : null
      }
      progress={progress}
      avgRecent={avgRecent}
      activeMembers={activeMembers}
      recentActivity={
        run?.checks.map((c) => ({
          checkedAt: c.checkedAt.toISOString(),
          checkedByName: c.checkedBy.name,
          label: c.labelSnapshot,
        })) ?? []
      }
    />
  );
}
```

- [ ] **Step 2: Write `features/checklist/ChecklistLandingClient.tsx`**

```tsx
"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

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
            // multimedia · checklist
          </div>
          <h1 style={{ margin: "4px 0 0", fontSize: 22 }}>Sunday Setup Checklist</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <a
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
          </a>
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
          <a
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
          </a>
          <a
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
          </a>
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
```

- [ ] **Step 3: Type-check + lint**

Run: `npm run type-check && npm run lint`

- [ ] **Step 4: Manual test**

With `npm run dev` running, log in as admin and visit `http://localhost:3000/dashboard/multimedia-checklist`. Expected: landing renders, "Start new week" button visible (since no open run yet). Click it — run opens, page refreshes, "Close current week" replaces the Start button, progress card shows `0 of 11 items · 0%`.

- [ ] **Step 5: Prepare commit**

```
feat(checklist): add dashboard landing page with start/close controls
```

Stop for user review.

---

## Task 19: Sidebar navigation entry

The existing sidebar in [components/layout/Sidebar.tsx](../../../components/layout/Sidebar.tsx) uses a flat `navItems` array filtered by `roleSlug` only — it has no ministry awareness. We need to extend it with a `multimediaMinistryMember` flag resolved in the dashboard layout and threaded through `DashboardShell`.

**Files:**

- Modify: `components/layout/Sidebar.tsx`
- Modify: `components/layout/DashboardShell.tsx`
- Modify: `app/(dashboard)/layout.tsx`

- [ ] **Step 1: Extend `Sidebar.tsx` to accept the new prop and add the nav item**

In `components/layout/Sidebar.tsx`:

1. Change the `NavItem` interface to allow a ministry-based gate:

```ts
interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  roles: RoleSlug[];
  /** If true, also show when the user is a Multimedia ministry member (in addition to `roles`). */
  allowIfMultimediaMember?: boolean;
}
```

2. Add an icon import at the top — reuse `FiMonitor` from `react-icons/fi` (add it to the existing `import { FiHome, ... } from "react-icons/fi"` line):

```tsx
import {
  FiHome,
  FiFileText,
  FiMusic,
  FiCalendar,
  FiBell,
  FiUsers,
  FiSettings,
  FiBarChart2,
  FiHeart,
  FiMonitor,
} from "react-icons/fi";
```

3. Add the nav item to `navItems`, positioned after the "Music Lineup" entry (before "Calendar"):

```ts
  {
    href: "/dashboard/multimedia-checklist",
    label: "Multimedia Checklist",
    icon: <FiMonitor className="size-5" />,
    roles: ["admin"],
    allowIfMultimediaMember: true,
  },
```

4. Extend `SidebarProps`:

```ts
export interface SidebarProps {
  roleSlug: RoleSlug;
  /** On mobile, when true sidebar is hidden (drawer closed). */
  collapsed?: boolean;
  /** True if the current user is a member of the Multimedia ministry. */
  isMultimediaMember?: boolean;
}
```

5. Update the destructure and filter inside the `Sidebar` function:

```tsx
export function Sidebar({ roleSlug, collapsed = false, isMultimediaMember = false }: SidebarProps) {
  const pathname = usePathname();
  const visibleItems = navItems.filter((item) => {
    if (item.roles.includes(roleSlug)) return true;
    if (item.allowIfMultimediaMember && isMultimediaMember) return true;
    return false;
  });
  // ... rest of the function unchanged
```

- [ ] **Step 2: Extend `DashboardShell.tsx` to thread the prop through**

In `components/layout/DashboardShell.tsx`:

1. Add `isMultimediaMember?: boolean` to the `DashboardShellProps` interface.
2. Destructure it in the function signature (default to `false`).
3. Pass it to `<Sidebar>`:

```tsx
<Sidebar roleSlug={roleSlug} collapsed={sidebarCollapsed} isMultimediaMember={isMultimediaMember} />
```

- [ ] **Step 3: Compute the boolean in `app/(dashboard)/layout.tsx` and pass it down**

Open `app/(dashboard)/layout.tsx`. After the existing session/ministryIds resolution, add a Multimedia ministry lookup:

```ts
import { getMultimediaMinistryId } from "@/lib/checklist";
```

Inside the layout function, after `ministryIds` is resolved:

```ts
const multimediaMinistryId = await getMultimediaMinistryId();
const isMultimediaMember =
  multimediaMinistryId !== null && ministryIds.includes(multimediaMinistryId);
```

Then pass it to `<DashboardShell>`:

```tsx
<DashboardShell
  user={
    {
      /* ... */
    }
  }
  roleSlug={roleSlug}
  isMultimediaMember={isMultimediaMember}
  /* ... other existing props */
>
  {children}
</DashboardShell>
```

- [ ] **Step 4: Type-check + lint**

Run: `npm run type-check && npm run lint`

- [ ] **Step 5: Manual test**

Reload the dashboard logged in as admin. Expected: "Multimedia Checklist" appears in the sidebar after "Music Lineup". Log in as a seeded Multimedia member — also visible. Log in as a user with no Multimedia membership and role `user` — entry is hidden.

- [ ] **Step 6: Prepare commit**

```
feat(checklist): add sidebar entry for Multimedia Checklist

Extends Sidebar with allowIfMultimediaMember gate and threads the
isMultimediaMember boolean through DashboardShell from the dashboard layout.
```

Stop for user review.

---

## Task 20: Template editor page + client

**Files:**

- Create: `app/(dashboard)/dashboard/multimedia-checklist/template/page.tsx`
- Create: `features/checklist/TemplateEditor.tsx`

- [ ] **Step 1: Write the server page**

```tsx
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditChecklistTemplate, type RoleSlug } from "@/lib/permissions";
import { getMultimediaMinistryId } from "@/lib/checklist";
import { TemplateEditor } from "@/features/checklist/TemplateEditor";

export const dynamic = "force-dynamic";

export default async function TemplateEditorPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login?callbackUrl=/dashboard/multimedia-checklist/template");

  const multimediaMinistryId = await getMultimediaMinistryId();
  if (!multimediaMinistryId) {
    return <div className="p-page">Multimedia ministry not configured.</div>;
  }

  const roleSlug = (session.roleSlug ?? "user") as RoleSlug;
  const ministryIds = session.ministryIds ?? [];
  if (!canEditChecklistTemplate(roleSlug, ministryIds, multimediaMinistryId)) {
    redirect("/dashboard/multimedia-checklist");
  }

  const template = await prisma.checklistTemplate.findUnique({
    where: { ministryId: multimediaMinistryId },
    include: {
      categories: {
        where: { archivedAt: null },
        orderBy: { sortOrder: "asc" },
        include: {
          items: {
            where: { archivedAt: null },
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
  });

  if (!template) {
    return <div className="p-page">No template exists. Run the seed script.</div>;
  }

  return (
    <TemplateEditor
      initialCategories={template.categories.map((c) => ({
        id: c.id,
        name: c.name,
        sortOrder: c.sortOrder,
        items: c.items.map((i) => ({ id: i.id, label: i.label, sortOrder: i.sortOrder })),
      }))}
    />
  );
}
```

- [ ] **Step 2: Write `features/checklist/TemplateEditor.tsx`**

For v1 the editor uses click-to-edit and up/down reorder buttons. Drag-reorder with `react-dnd` is deferred to the first follow-up if reordering is painful — this keeps the task scope bounded while matching the design screens in the spec.

```tsx
"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

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

  // ---- Category ops -------------------------------------------------

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

  // ---- Item ops -----------------------------------------------------

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

  // ---- Render ------------------------------------------------------

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
            // checklist · template
          </div>
          <h1 style={{ margin: "4px 0 0", fontSize: 22 }}>Edit Template</h1>
        </div>
        <a
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
        </a>
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
```

- [ ] **Step 3: Type-check + lint**

Run: `npm run type-check && npm run lint`

- [ ] **Step 4: Manual test**

Log in as admin, visit `/dashboard/multimedia-checklist/template`. Click a category name, change it, tab away — verify the rename persists (refresh the public page in another tab and confirm). Use ↑/↓ to reorder a category. Click "+ Add item" — verify an item appears. Delete an item. Archive a category (items should disappear too).

- [ ] **Step 5: Prepare commit**

```
feat(checklist): add template editor page and client
```

Stop for user review.

---

## Task 21: History page shell with tab navigation

**Files:**

- Create: `app/(dashboard)/dashboard/multimedia-checklist/history/page.tsx`
- Create: `features/checklist/HistoryTabs.tsx`
- Create: `features/checklist/HistoryRunsTable.tsx`
- Create: `features/checklist/HistoryTrendsCharts.tsx`
- Create: `features/checklist/HistoryReliabilityTable.tsx`
- Create: `features/checklist/HistoryPeopleTable.tsx`

- [ ] **Step 1: Write the server page**

```tsx
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { canViewChecklistHistory, type RoleSlug } from "@/lib/permissions";
import { getMultimediaMinistryId } from "@/lib/checklist";
import { HistoryTabs } from "@/features/checklist/HistoryTabs";

export const dynamic = "force-dynamic";

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login?callbackUrl=/dashboard/multimedia-checklist/history");

  const multimediaMinistryId = await getMultimediaMinistryId();
  if (!multimediaMinistryId) {
    return <div className="p-page">Multimedia ministry not configured.</div>;
  }
  const roleSlug = (session.roleSlug ?? "user") as RoleSlug;
  if (!canViewChecklistHistory(roleSlug, session.ministryIds ?? [], multimediaMinistryId)) {
    redirect("/dashboard");
  }

  const { tab } = await searchParams;
  const active = tab === "trends" || tab === "reliability" || tab === "people" ? tab : "runs";

  return <HistoryTabs activeTab={active} />;
}
```

- [ ] **Step 2: Write `features/checklist/HistoryTabs.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { HistoryRunsTable } from "./HistoryRunsTable";
import { HistoryTrendsCharts } from "./HistoryTrendsCharts";
import { HistoryReliabilityTable } from "./HistoryReliabilityTable";
import { HistoryPeopleTable } from "./HistoryPeopleTable";

type Tab = "runs" | "trends" | "reliability" | "people";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "runs", label: "Runs" },
  { id: "trends", label: "Trends" },
  { id: "reliability", label: "Item reliability" },
  { id: "people", label: "People" },
];

interface Props {
  activeTab: Tab;
}

export function HistoryTabs({ activeTab }: Props) {
  const [tab, setTab] = useState<Tab>(activeTab);

  useEffect(() => {
    setTab(activeTab);
  }, [activeTab]);

  return (
    <div className="p-page">
      <div style={{ marginBottom: 18 }}>
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 10,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--color-text-muted)",
          }}
        >
          // checklist · history
        </div>
        <h1 style={{ margin: "4px 0 0", fontSize: 22 }}>Run History</h1>
      </div>

      <div
        style={{
          display: "flex",
          gap: 2,
          borderBottom: "1px solid var(--color-border)",
          marginBottom: 18,
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              const url = new URL(window.location.href);
              url.searchParams.set("tab", t.id);
              window.history.replaceState({}, "", url.toString());
            }}
            style={{
              padding: "10px 16px",
              fontSize: 12,
              fontFamily: "monospace",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: tab === t.id ? "var(--color-primary)" : "var(--color-text-muted)",
              borderBottom:
                tab === t.id ? "2px solid var(--color-primary)" : "2px solid transparent",
              background: "transparent",
              border: "none",
              borderBottomWidth: 2,
              borderBottomStyle: "solid",
              cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "runs" ? <HistoryRunsTable /> : null}
      {tab === "trends" ? <HistoryTrendsCharts /> : null}
      {tab === "reliability" ? <HistoryReliabilityTable /> : null}
      {tab === "people" ? <HistoryPeopleTable /> : null}
    </div>
  );
}
```

- [ ] **Step 3: Write `features/checklist/HistoryRunsTable.tsx`**

```tsx
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
```

- [ ] **Step 4: Write `features/checklist/HistoryTrendsCharts.tsx`**

```tsx
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
          {completionPoints.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="3" fill="#3b82f6" />
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
```

- [ ] **Step 5: Write `features/checklist/HistoryReliabilityTable.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";

interface Row {
  itemId: string;
  category: string;
  label: string;
  timesChecked: number;
  timesMissed: number;
  missRate: number;
}

function pctColor(pct: number): string {
  if (pct === 0) return "#16a34a";
  if (pct <= 15) return "#ca8a04";
  return "#dc2626";
}

export function HistoryReliabilityTable() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/checklist/stats?view=reliability", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load reliability"))))
      .then((d: { data: Row[] }) => setRows(d.data))
      .catch((e) => setError(e instanceof Error ? e.message : "Error"));
  }, []);

  if (error) return <div style={{ color: "#dc2626" }}>{error}</div>;
  if (!rows) return <div style={{ color: "var(--color-text-muted)" }}>Loading…</div>;
  if (rows.length === 0)
    return <div style={{ color: "var(--color-text-muted)" }}>No items yet.</div>;

  return (
    <table style={tableStyle}>
      <thead>
        <tr>
          {["Category", "Item", "Times checked", "Times missed", "Miss rate"].map((h) => (
            <th key={h} style={thStyle}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.itemId}>
            <td style={{ ...tdStyle, fontFamily: "monospace" }}>{r.category}</td>
            <td style={tdStyle}>{r.label}</td>
            <td style={{ ...tdStyle, fontFamily: "monospace" }}>{r.timesChecked}</td>
            <td style={{ ...tdStyle, fontFamily: "monospace" }}>{r.timesMissed}</td>
            <td style={{ ...tdStyle, color: pctColor(r.missRate), fontFamily: "monospace" }}>
              {r.missRate}%
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
```

- [ ] **Step 6: Write `features/checklist/HistoryPeopleTable.tsx`**

```tsx
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
```

- [ ] **Step 7: Type-check + lint**

Run: `npm run type-check && npm run lint`

- [ ] **Step 8: Manual test**

Visit `/dashboard/multimedia-checklist/history` logged in as admin. Verify all four tabs render (they'll be empty or minimal until there's history — that's fine). Click between tabs; URL updates via `?tab=trends`. Reload with `?tab=trends` — trends tab is active after reload.

- [ ] **Step 9: Prepare commit**

```
feat(checklist): add history page with runs/trends/reliability/people tabs
```

Stop for user review.

---

## Task 22: Per-run drill-down page

**Files:**

- Create: `app/(dashboard)/dashboard/multimedia-checklist/history/[runId]/page.tsx`
- Create: `features/checklist/RunDrillDown.tsx`

- [ ] **Step 1: Write the server page**

```tsx
import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewChecklistHistory, type RoleSlug } from "@/lib/permissions";
import { getMultimediaMinistryId } from "@/lib/checklist";
import { RunDrillDown } from "@/features/checklist/RunDrillDown";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ runId: string }> };

export default async function RunDrillPage({ params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login");

  const multimediaMinistryId = await getMultimediaMinistryId();
  if (!multimediaMinistryId)
    return <div className="p-page">Multimedia ministry not configured.</div>;

  const roleSlug = (session.roleSlug ?? "user") as RoleSlug;
  if (!canViewChecklistHistory(roleSlug, session.ministryIds ?? [], multimediaMinistryId)) {
    redirect("/dashboard");
  }

  const { runId } = await params;

  const run = await prisma.checklistRun.findUnique({
    where: { id: runId },
    include: {
      startedBy: { select: { name: true } },
      closedBy: { select: { name: true } },
      template: {
        include: {
          categories: {
            orderBy: { sortOrder: "asc" },
            include: {
              items: {
                orderBy: { sortOrder: "asc" },
                select: {
                  id: true,
                  label: true,
                  archivedAt: true,
                  createdAt: true,
                  sortOrder: true,
                },
              },
            },
          },
        },
      },
      checks: {
        include: { checkedBy: { select: { name: true } } },
      },
    },
  });

  if (!run || run.template.ministryId !== multimediaMinistryId) notFound();

  return (
    <RunDrillDown
      weekStart={run.weekStart.toISOString()}
      startedAt={run.startedAt.toISOString()}
      closedAt={run.closedAt?.toISOString() ?? null}
      startedBy={run.startedBy?.name ?? null}
      closedBy={run.closedBy?.name ?? null}
      categories={run.template.categories.map((cat) => {
        // For an open run: show every current item. For a closed run: show only items
        // that existed at/before the close time so post-close template additions don't
        // pollute the historical drill-down.
        const runClosedAt = run.closedAt;
        const visibleItems = cat.items.filter(
          (i) => runClosedAt === null || i.createdAt <= runClosedAt
        );
        return {
          id: cat.id,
          name: cat.name,
          items: visibleItems.map((item) => {
            const check = run.checks.find((c) => c.itemId === item.id);
            return {
              id: item.id,
              label: check?.labelSnapshot ?? item.label,
              categoryNameSnapshot: check?.categoryNameSnapshot ?? cat.name,
              checkedBy: check?.checkedBy.name ?? null,
              checkedAt: check?.checkedAt.toISOString() ?? null,
            };
          }),
        };
      })}
    />
  );
}
```

- [ ] **Step 2: Write `features/checklist/RunDrillDown.tsx`**

```tsx
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

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
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
          // history · drill-down
        </div>
        <h1 style={{ margin: "4px 0 0", fontSize: 22 }}>
          {new Date(weekStart).toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </h1>
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
            {formatTime(startedAt)}
          </span>
          <span>
            CLOSED BY{" "}
            <strong style={{ color: "var(--color-text-dark)" }}>
              {closedAt ? (closedBy ?? "cron") : "still open"}
            </strong>
            {closedAt ? ` · ${formatTime(closedAt)}` : ""}
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
                      ? `${item.checkedBy} · ${formatTime(item.checkedAt!)}`
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
```

- [ ] **Step 3: Type-check + lint**

Run: `npm run type-check && npm run lint`

- [ ] **Step 4: Manual test**

Close the current run (from landing page). Visit `/dashboard/multimedia-checklist/history` — the runs table should show the closed run. Click it — drill-down opens showing items with check/miss state.

- [ ] **Step 5: Prepare commit**

```
feat(checklist): add per-run drill-down page
```

Stop for user review.

---

## Task 23: Notifications wiring

**Files:**

- Modify: `app/api/checklist/categories/route.ts`
- Modify: `app/api/checklist/categories/[id]/route.ts`
- Modify: `app/api/checklist/items/route.ts`
- Modify: `app/api/checklist/items/[id]/route.ts`
- Modify: `app/api/checklist/runs/close/route.ts`
- Modify: `app/api/cron/checklist-reset/route.ts`

- [ ] **Step 1: Write a shared helper for checklist notification recipients**

Add these two helpers at the bottom of `lib/checklist.ts`:

```ts
import { type PrismaClient } from "@prisma/client";

/**
 * Returns the list of user ids who should receive a "template-changed" notification
 * when the template is edited during an open run. Multimedia members minus the actor.
 */
export async function getTemplateChangeRecipients(
  multimediaMinistryId: string,
  actorUserId: string
): Promise<string[]> {
  const { getMinistryMemberIds } = await import("@/lib/notificationRecipients");
  const memberIds = await getMinistryMemberIds(multimediaMinistryId);
  return memberIds.filter((id) => id !== actorUserId);
}

/**
 * Returns the list of user ids who should receive a "run-closed" notification.
 * Admin ∪ Multimedia ministry_head users, minus the actor (if any).
 */
export async function getRunClosedRecipients(
  multimediaMinistryId: string,
  actorUserId: string | null
): Promise<string[]> {
  const [{ getAdminUserIds }, prismaMod] = await Promise.all([
    import("@/lib/notificationRecipients"),
    import("@/lib/prisma"),
  ]);
  const prisma = (prismaMod as { prisma: PrismaClient }).prisma;
  const adminIds = await getAdminUserIds();
  const heads = await prisma.user.findMany({
    where: {
      role: { slug: "ministry_head" },
      OR: [
        { ministryId: multimediaMinistryId },
        { userMinistries: { some: { ministryId: multimediaMinistryId } } },
      ],
    },
    select: { id: true },
  });
  const all = new Set<string>([...adminIds, ...heads.map((h) => h.id)]);
  if (actorUserId) all.delete(actorUserId);
  return Array.from(all);
}
```

If the dynamic imports look awkward to you, the simpler form is to add static imports at the top of `lib/checklist.ts`:

```ts
import { getAdminUserIds, getMinistryMemberIds } from "@/lib/notificationRecipients";
```

…and call them directly. Use whichever import style the rest of the file uses.

- [ ] **Step 2: Wire "template-changed" notifications (only while a run is open)**

Wrap this helper inside `lib/checklist.ts` as well — it checks for an open run and fires the notification if and only if one exists:

```ts
import { createNotificationsForUserIds } from "@/services/notificationService";

export async function notifyTemplateChangeIfRunOpen({
  multimediaMinistryId,
  templateId,
  actorUserId,
  actorName,
}: {
  multimediaMinistryId: string;
  templateId: string;
  actorUserId: string;
  actorName: string;
}): Promise<void> {
  const prismaMod = await import("@/lib/prisma");
  const prisma = prismaMod.prisma;
  const openRun = await prisma.checklistRun.findFirst({
    where: { templateId, closedAt: null },
    select: { id: true },
  });
  if (!openRun) return;

  const recipients = await getTemplateChangeRecipients(multimediaMinistryId, actorUserId);
  if (recipients.length === 0) return;

  await createNotificationsForUserIds(recipients, {
    type: "checklist_template_changed",
    title: "Multimedia checklist updated",
    body: `Template updated by ${actorName}`,
    link: "/checklist",
    ministryId: multimediaMinistryId,
  }).catch(() => {});
}
```

- [ ] **Step 3: Call `notifyTemplateChangeIfRunOpen` from every mutating template route**

In `app/api/checklist/categories/route.ts`, inside the POST handler, right after `await publishTemplateChanged("category-added", category.id);` add:

```ts
const actor = await prisma.user.findUnique({
  where: { id: session.userId },
  select: { name: true },
});
await notifyTemplateChangeIfRunOpen({
  multimediaMinistryId,
  templateId: template.id,
  actorUserId: session.userId,
  actorName: actor?.name ?? "Someone",
});
```

And add the import: `import { notifyTemplateChangeIfRunOpen } from "@/lib/checklist";`

Repeat the same pattern in:

- `app/api/checklist/categories/[id]/route.ts` — PATCH and DELETE handlers, using `category.id` / `id` accordingly
- `app/api/checklist/items/route.ts` — POST handler
- `app/api/checklist/items/[id]/route.ts` — PATCH and DELETE handlers

For each handler you'll need access to `multimediaMinistryId` and `template.id` — fetch the template in the handler before the notification call if it's not already loaded.

- [ ] **Step 4: Wire "run-closed" notifications**

In `app/api/checklist/runs/close/route.ts`, right after `await publishRunChanged("closed", closed.id);` add:

```ts
const template = await prisma.checklistTemplate.findUnique({
  where: { id: closed.templateId },
  include: {
    categories: { include: { items: { select: { id: true, archivedAt: true } } } },
  },
});
const checks = await prisma.itemCheck.findMany({
  where: { runId: closed.id },
  select: { itemId: true },
});
const items = template?.categories.flatMap((c) => c.items) ?? [];
const progress = (await import("@/lib/checklist")).computeRunProgress(items, checks);

const recipients = await (
  await import("@/lib/checklist")
).getRunClosedRecipients(multimediaMinistryId, session.userId);
if (recipients.length > 0) {
  const { createNotificationsForUserIds } = await import("@/services/notificationService");
  const dateLabel = closed.weekStart.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  await createNotificationsForUserIds(recipients, {
    type: "checklist_run_closed",
    title: "Multimedia checklist closed",
    body: `${dateLabel} checklist closed — ${progress.complete}/${progress.total} items complete`,
    link: `/dashboard/multimedia-checklist/history/${closed.id}`,
    ministryId: multimediaMinistryId,
  }).catch(() => {});
}
```

(Prefer direct imports at top-of-file over dynamic `await import()` if that matches the rest of the codebase — the dynamic form is shown here only to keep the diff local. Clean it up as static imports.)

- [ ] **Step 5: Same for cron-closed runs**

In `app/api/cron/checklist-reset/route.ts`, inside the loop that closes stale runs, after `await publishRunChanged("closed", run.id);` do the same notification logic as Step 4 but pass `actorUserId: null` to `getRunClosedRecipients` (cron has no actor).

- [ ] **Step 6: Type-check + lint**

Run: `npm run type-check && npm run lint`

- [ ] **Step 7: Manual test**

- Log in as admin, open a run, then edit the template (rename an item). Log in as a seeded Multimedia member in another browser — a bell notification should appear.
- Close the run from the landing page. Log in as another admin — the "checklist closed" notification should appear.

- [ ] **Step 8: Prepare commit**

```
feat(checklist): wire template-change and run-closed notifications
```

Stop for user review.

---

## Task 24: Final verification

**Files:**

- None modified — this is a verification gate.

- [ ] **Step 1: Run the full check script**

Run: `npm run check`

Expected: zero errors across type-check, lint, and format.

- [ ] **Step 2: Execute the manual Sunday dry-run from spec §14.2**

Follow spec §14.2 steps 1–10 in order against `npm run dev`:

1. Seeded state — verify Multimedia `ChecklistTemplate` with starter categories/items via Prisma Studio or `/api/checklist/current`.
2. Anonymous view — incognito window at `/checklist`, verify empty-run state renders (no session errors).
3. Admin edit — log in as admin, navigate to `/dashboard/multimedia-checklist/template`, add/rename/delete items. Confirm incognito tab updates live via Pusher.
4. Member check — open a run from admin landing, log in as a seeded Multimedia member in a second browser, tap checkboxes. Confirm incognito updates and `ItemCheck` row exists in DB with correct `labelSnapshot` and `categoryNameSnapshot`.
5. Mid-service add — with an open run, add a new item from the template editor. Confirm it appears unchecked in the live view.
6. 100% celebration — check every item. Verify full-screen fires once, decays to inline banner. Refresh — only banner. Uncheck one — banner goes. Re-check — banner returns (no full-screen).
7. Manual close — click "Close current week" on the landing. Confirm `/api/checklist/current` now reports `run: null`.
8. Cron — `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/checklist-reset`. Verify one run opens. Run again — idempotent.
9. History — visit `/dashboard/multimedia-checklist/history`, verify all four tabs render. Click the closed run — drill-down shows items with snapshots.
10. Permission gates — log in as a non-Multimedia user. Verify `/checklist` checkboxes are disabled. Verify no sidebar entry. Direct-navigate to `/dashboard/multimedia-checklist/template` — expect redirect.

- [ ] **Step 3: Report dry-run results to user**

Write a short report listing which steps passed, which failed, and what you observed. Do not mark the plan complete if any manual step fails — create a follow-up task first.

- [ ] **Step 4: Prepare final commit (if any loose tweaks were made during verification)**

Only needed if the dry-run turned up fixes. Otherwise there is nothing to commit. Report "No changes from verification" and stop.

---

## Self-review checklist (for the executing agent)

Before declaring the plan complete, walk through the spec once more:

- [ ] Every section of [the spec](../specs/2026-04-11-multimedia-checklist-design.md) has a corresponding task in this plan (§3 data → Task 1–2, §4 permissions → Task 3, §5 routes → Tasks 14–22, §6 API → Tasks 6–13, §7 Pusher → Task 5 + per-route wiring, §8 reset → Tasks 10 + 13, §9 celebration → Task 17, §10 template editor → Task 20, §11 history → Tasks 21–22, §12 notifications → Task 23, §13 visual → Task 14, §14 verification → Task 24).
- [ ] No placeholders in code blocks. If a step says "adapt to the existing sidebar pattern" (Task 19), the executing agent confirms the pattern before editing.
- [ ] All permission helper names match between tasks: `canViewChecklistHistory`, `canToggleChecklistItem`, `canEditChecklistTemplate`, `canManageChecklistRuns`.
- [ ] All Pusher event names match: `item-checked`, `item-unchecked`, `template-changed`, `run-changed`.
- [ ] All channel names are `checklist-multimedia` (defined once in `CHECKLIST_CHANNEL`).
- [ ] Every commit step says "stop for user review" — no task runs `git commit` directly.
