# User Roles & Signup Approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the global-role model with a per-ministry role model, add signup approval workflow, and enable multi-ministry signup — shipped as one cohesive change.

**Architecture:** Drop `Role`/`Permission`/`RolePermission` tables entirely. Add `User.isAdmin: boolean` for the global admin concept. Add `UserMinistry.role: "head" | "member"` enum so roles live per-membership. NextAuth session carries `isAdmin` + `status` + `ministryIds[]` (all memberships) + `headOfMinistryIds[]` (subset). JWT rehydrates from DB on every request so role/status changes propagate without re-login. Signup flow lands new users in a `pending` status; admins approve via a new Pending tab on `/dashboard/users`.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Prisma + PostgreSQL (Neon dev), NextAuth (credentials + JWT), Tailwind v4, Zod, existing in-app notification service.

**Source spec:** [docs/superpowers/specs/2026-04-12-user-roles-and-signup-approval-design.md](../specs/2026-04-12-user-roles-and-signup-approval-design.md) — canonical reference.

---

## Codebase conventions (same as previous plans)

### No test runner

There is no test runner configured. Verification is `npm run check` (type-check + lint + format:check) plus a scripted manual dry-run at the end. Do not invent `npm test`. Do not write unit tests without a runner.

### No auto-commits

Per [CLAUDE.md](../../../CLAUDE.md), **never run `git commit`, `git push`, or create PRs**. At every "commit" step:

1. Run `git status` to show changed files
2. Report the prepared commit message verbatim
3. **Stop and wait** for the user to commit manually

The commit messages in this plan are the messages the user should use — not instructions to execute.

### Windows bash shell

Working directory is `d:/Jonathan Codes 2/mndbd`. Use forward slashes. `/dev/null` not `NUL`.

---

## File structure — what changes

### New files

- `prisma/migrations/<timestamp>_user_roles_rework/migration.sql` (auto-generated)
- `app/pending/page.tsx` + `app/pending/SignOutButton.tsx`
- `app/api/users/[id]/approve/route.ts`
- `app/api/users/[id]/reject/route.ts`

### Deleted files

- `app/api/options/roles/route.ts` — no Role table anymore

### Major rewrites (these are the substantive task targets)

- `prisma/schema.prisma` — drop 3 tables, add 2 enums, restructure User + UserMinistry
- `lib/auth.ts` — authorize + jwt + session callbacks + module augmentation
- `lib/permissions.ts` — full rewrite, new `PermissionSession` type, every helper signature changes
- `lib/notificationRecipients.ts` — rewrite admin query, add status filter, new `getMinistryHeadIds`
- `lib/checklist.ts` — simplify inline recipient helpers to use centralized functions
- `lib/db/seed.ts` — drop Role seeding, create admin with `isAdmin: true`
- `schemas/user.ts` — rewrite `signupSchema`, `userCreateSchema`, `userUpdateSchema`
- `app/(dashboard)/layout.tsx` — pending redirect + compute `SidebarGates`
- `components/layout/Sidebar.tsx` — refactor from `roles: RoleSlug[]` to `show: (g) => boolean`
- `components/layout/DashboardShell.tsx` — thread `gates: SidebarGates` through
- `app/api/auth/register/route.ts` — rewrite for multi-ministry + pending status
- `app/signup/page.tsx` — multi-ministry picker + success screen
- `app/login/page.tsx` — error query params + pending redirect
- `app/api/users/route.ts` + `[id]/route.ts` — rewrite with new body shape, scoping, response shape
- `features/users/UserForm.tsx` — ministry-memberships-with-role section, head-scoped edit mode
- `features/users/UsersTableClient.tsx` — tabs, pending rows, approve inline panel

### Mechanical sweep (session-shape updates across many files)

- `app/api/forms/arf/**`, `app/api/forms/prf/**` — call-site updates
- `app/api/lineup/**` — call-site updates
- `app/api/prayers/**` — call-site updates
- `app/api/settings/**` — call-site updates
- `app/api/checklist/**` (11 files from previous feature) — call-site updates
- `app/api/options/**`, `app/api/search/route.ts`, `app/api/notifications/read/route.ts` — call-site updates
- `app/(dashboard)/dashboard/**/page.tsx` (~10 files) — call-site updates + route gates
- `features/arf/**`, `features/prf/**`, `features/lineup/**`, `features/prayer/**` — session reads
- `components/layout/Navbar.tsx` — session reads

---

## Task breakdown (20 tasks)

1. **Task 1** — Prisma schema: drop Role tables, add `MinistryRole` + `UserStatus` enums, restructure User + UserMinistry, migrate + reseed
2. **Task 2** — `lib/auth.ts` rewrite (authorize, jwt with rehydration, session, module augmentation)
3. **Task 3** — `lib/permissions.ts` rewrite (`PermissionSession` type, all helpers rewritten)
4. **Task 4** — `lib/notificationRecipients.ts` rewrite + `lib/checklist.ts` cleanup
5. **Task 5** — Seed update (`lib/db/seed.ts`) + verify fresh reset
6. **Task 6** — Dashboard layout + Sidebar refactor to gates pattern
7. **Task 7** — Signup flow (schema, API, page, success screen)
8. **Task 8** — Pending approval page + SignOutButton
9. **Task 9** — Login page polish (error query params, pending-aware redirect)
10. **Task 10** — Users API rewrite (`/api/users` GET/POST, `[id]` GET/PUT/DELETE) with per-ministry scoping
11. **Task 11** — Approve + Reject API routes
12. **Task 12** — `UserForm.tsx` rewrite (ministry memberships section, head-scoped edit mode)
13. **Task 13** — `UsersTableClient.tsx` rewrite (tabs, chip list, pending tab, approve inline panel)
14. **Task 14** — Call-site sweep: Forms (ARF/PRF) routes + dashboard pages + feature clients
15. **Task 15** — Call-site sweep: Lineup routes + dashboard pages + feature clients
16. **Task 16** — Call-site sweep: Prayers routes + dashboard pages + feature clients
17. **Task 17** — Call-site sweep: Checklist routes + dashboard pages (11 files from previous feature)
18. **Task 18** — Call-site sweep: Settings, Options, Search, Notifications, Navbar, miscellaneous
19. **Task 19** — Delete dead routes (`/api/options/roles/route.ts`), final grep for stragglers
20. **Task 20** — Final verification (`npm run check` + full manual dry-run per spec §11.2)

---

## Task 1: Prisma schema rework

**Files:**

- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Drop the `Role`, `Permission`, `RolePermission` model blocks entirely**

Delete these three `model { ... }` blocks from `prisma/schema.prisma`. They start around line 34 with `model Role`. Also remove the `role` relation field on `User` (`role Role @relation(...)`).

- [ ] **Step 2: Add two new enums at the top of the file, near the existing enums**

Append near the other `enum` blocks (around the top of the file):

```prisma
enum MinistryRole {
  head
  member
}

enum UserStatus {
  pending
  active
  inactive
}
```

- [ ] **Step 3: Restructure the `User` model**

Replace the existing `User` model block with:

```prisma
model User {
  id                    String     @id @default(cuid())
  email                 String     @unique
  hashedPassword        String
  name                  String
  address               String?
  age                   Int?
  birthday              DateTime?
  status                UserStatus @default(pending)
  isAdmin               Boolean    @default(false)
  resetToken            String?
  resetTokenExp         DateTime?
  createdAt             DateTime   @default(now())
  updatedAt             DateTime   @updatedAt

  userMinistries        UserMinistry[]
  arfsCreated           ARF[]                  @relation("ARFCreatedBy")
  prfsCreated           PRF[]                  @relation("PRFCreatedBy")
  approvalHistory       ApprovalHistory[]
  lineupsCreated        Lineup[]               @relation("LineupCreatedBy")
  instrumentAssignments InstrumentAssignment[]
  singerAssignments     SingerAssignment[]
  chatMessages          ChatMessage[]
  notifications         Notification[]
  prayersCreated        Prayer[]               @relation("PrayerCreatedBy")
  checklistRunsStarted  ChecklistRun[]         @relation("ChecklistRunStartedBy")
  checklistRunsClosed   ChecklistRun[]         @relation("ChecklistRunClosedBy")
  itemChecks            ItemCheck[]            @relation("ItemChecksBy")
}
```

Columns removed from the prior schema: `roleId` (FK to Role), `ministryId` (primary ministry), and the `role Role @relation(...)` line. The `ministry Ministry? @relation(...)` line is also removed.

- [ ] **Step 4: Restructure the `UserMinistry` model**

Replace the existing `UserMinistry` model block with:

```prisma
model UserMinistry {
  userId     String
  ministryId String
  role       MinistryRole @default(member)
  createdAt  DateTime     @default(now())
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  ministry   Ministry @relation(fields: [ministryId], references: [id], onDelete: Cascade)

  @@id([userId, ministryId])
  @@index([ministryId, role])
}
```

New: `role` column with `MinistryRole` enum, default `member`. New composite index `[ministryId, role]` for fast "who heads ministry X" queries.

- [ ] **Step 5: Remove the now-orphaned `users User[]` relation on `Ministry`**

In the `Ministry` model (around lines 59–73), remove the line `users User[]`. That relation was the back-ref for `User.ministryId` which no longer exists. The `userMinistries UserMinistry[]` line stays — that's the only way to reach members now.

- [ ] **Step 6: Reset the dev database**

```bash
PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="User approved schema reset for user roles rework." npx prisma migrate reset --force --skip-seed
```

Expected: all tables dropped, all existing migrations replayed (minus the checklist migration which hasn't been committed yet — it'll be regenerated in Step 7).

Note: the previous checklist migration `20260411144415_checklist/` is still in the working tree (untracked). `migrate reset` replays only committed migrations. To avoid losing the checklist schema, we do the reset first (drops all checklist tables along with everything else), then regenerate one combined migration in the next step that includes both the prior committed state AND the new user-roles changes AND the checklist models.

Actually — the cleaner sequence is:

1. Keep the checklist migration folder in place
2. Run `migrate reset` which will replay it during the reset (since it's in the migrations folder, Prisma treats it as applied-in-dev)
3. Add the user-roles changes to `schema.prisma`
4. Generate a new migration on top that only contains the user-roles diff

Confirm `prisma/migrations/20260411144415_checklist/` exists before running the reset. If it does, the reset will replay it and the schema will include the checklist models. Then you add user-roles changes and `migrate dev` generates a clean diff.

- [ ] **Step 7: Generate the user-roles migration**

```bash
npx prisma migrate dev --name user_roles_rework
```

Expected: a new migration folder `prisma/migrations/<timestamp>_user_roles_rework/` with a `migration.sql` containing the DROP TABLE statements for `Role`/`Permission`/`RolePermission`, the CREATE TYPE for the two new enums, the ALTER TABLE on `User` (drop `roleId`, `ministryId`, add `isAdmin`, change `status` to enum), and the ALTER TABLE on `UserMinistry` (add `role` column + new index).

- [ ] **Step 8: Type-check**

```bash
npm run type-check
```

Expected: many errors, all of the form "Property 'roleSlug' does not exist on type 'Session'" or "prisma.role is not a function". These are expected — subsequent tasks fix them.

**Do NOT try to fix the type errors yet.** They represent the work of Tasks 2–18. Seeing them now confirms the schema change landed and the compiler sees the new shape.

- [ ] **Step 9: Prepare commit (do not run)**

Run `git status` and report this commit message to the user:

```
feat(auth): rework data model for per-ministry roles and signup approval

- Drop Role, Permission, RolePermission tables
- Add MinistryRole enum (head | member) and UserStatus enum (pending | active | inactive)
- Add User.isAdmin boolean, drop User.roleId and User.ministryId
- Add UserMinistry.role with default "member" and composite index
- Generate migration prisma/migrations/<timestamp>_user_roles_rework/

Per spec docs/superpowers/specs/2026-04-12-user-roles-and-signup-approval-design.md §3.
```

Stop for user review.

---

## Task 2: `lib/auth.ts` rewrite

**Files:**

- Modify: `lib/auth.ts` (full rewrite)

- [ ] **Step 1: Replace module augmentation**

At the top of `lib/auth.ts`, replace the existing `declare module "next-auth"` and `declare module "next-auth/jwt"` blocks with:

```ts
declare module "next-auth" {
  interface Session {
    userId: string;
    isAdmin: boolean;
    status: "pending" | "active" | "inactive";
    ministryIds: string[];
    headOfMinistryIds: string[];
  }

  interface User {
    id: string;
    email: string;
    name: string;
    isAdmin: boolean;
    status: "pending" | "active" | "inactive";
    ministryIds: string[];
    headOfMinistryIds: string[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    isAdmin: boolean;
    status: "pending" | "active" | "inactive";
    ministryIds: string[];
    headOfMinistryIds: string[];
  }
}
```

The old `roleId`, `roleSlug`, `ministryId` fields are gone.

- [ ] **Step 2: Rewrite the `authorize` callback**

Replace the existing `authorize` function inside `authOptions.providers[0]` with:

```ts
async authorize(credentials) {
  if (!credentials?.email || !credentials?.password) {
    return null;
  }
  const user = await prisma.user.findUnique({
    where: { email: credentials.email },
    include: {
      userMinistries: { select: { ministryId: true, role: true } },
    },
  });
  if (!user) return null;

  const valid = await bcrypt.compare(credentials.password, user.hashedPassword);
  if (!valid) return null;

  // Inactive users are rejected here. Pending users ARE allowed through —
  // the dashboard layout redirects them to /pending with a clear message.
  if (user.status === "inactive") return null;

  const ministryIds = user.userMinistries.map((um) => um.ministryId);
  const headOfMinistryIds = user.userMinistries
    .filter((um) => um.role === "head")
    .map((um) => um.ministryId);

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    isAdmin: user.isAdmin,
    status: user.status,
    ministryIds,
    headOfMinistryIds,
  };
},
```

- [ ] **Step 3: Rewrite the `jwt` callback with DB rehydration**

Replace the existing `jwt` callback in `authOptions.callbacks` with:

```ts
async jwt({ token, user }) {
  if (user) {
    // Initial login
    token.userId = user.id;
    token.isAdmin = user.isAdmin;
    token.status = user.status;
    token.ministryIds = user.ministryIds ?? [];
    token.headOfMinistryIds = user.headOfMinistryIds ?? [];
    return token;
  }
  // Subsequent requests — re-read fresh state so role/status changes
  // propagate immediately without requiring re-login. Cost: one Prisma
  // query per server request that resolves a session.
  if (token.userId) {
    const fresh = await prisma.user.findUnique({
      where: { id: token.userId },
      select: {
        isAdmin: true,
        status: true,
        userMinistries: { select: { ministryId: true, role: true } },
      },
    });
    if (!fresh) {
      // User was deleted — invalidate token
      return {};
    }
    token.isAdmin = fresh.isAdmin;
    token.status = fresh.status;
    token.ministryIds = fresh.userMinistries.map((um) => um.ministryId);
    token.headOfMinistryIds = fresh.userMinistries
      .filter((um) => um.role === "head")
      .map((um) => um.ministryId);
  }
  return token;
},
```

- [ ] **Step 4: Rewrite the `session` callback**

Replace the `session` callback with:

```ts
async session({ session, token }) {
  if (session.user && token.userId) {
    (session.user as { id?: string }).id = token.userId;
    session.userId = token.userId;
    session.isAdmin = token.isAdmin ?? false;
    session.status = token.status ?? "active";
    session.ministryIds = token.ministryIds ?? [];
    session.headOfMinistryIds = token.headOfMinistryIds ?? [];
  }
  return session;
},
```

- [ ] **Step 5: Type-check**

```bash
npm run type-check
```

Expected: `lib/auth.ts` itself should compile clean. Many errors still exist elsewhere (routes reading `session.roleSlug`) — those come in Tasks 14–18.

- [ ] **Step 6: Prepare commit**

```
feat(auth): rewrite NextAuth callbacks for new session shape

Replace roleSlug/ministryId with isAdmin/status/ministryIds/headOfMinistryIds.
Add JWT rehydration from DB on every invocation so role/status changes
propagate immediately without requiring re-login.
```

Stop for user review.

---

## Task 3: `lib/permissions.ts` rewrite

**Files:**

- Modify: `lib/permissions.ts` (full rewrite)

- [ ] **Step 1: Replace the entire file contents**

Open `lib/permissions.ts` and replace everything with:

```ts
/**
 * Permission helpers for role-based access.
 *
 * Every helper takes a `PermissionSession` — a slim view of the NextAuth
 * session sufficient for access checks. Server components and API routes
 * can pass the whole `session` object; TypeScript structural typing lets
 * it match PermissionSession.
 *
 * Two primitives do the heavy lifting:
 *   - isMinistryHead(s, ministryId)   — head of this specific ministry, or admin
 *   - isMinistryMember(s, ministryId) — member (head or plain) of this ministry, or admin
 *
 * Every other helper is built on top of these.
 */

export interface PermissionSession {
  isAdmin: boolean;
  ministryIds: string[];
  headOfMinistryIds: string[];
}

// --- Primitives ---

export function isMinistryHead(s: PermissionSession, ministryId: string): boolean {
  return s.isAdmin || s.headOfMinistryIds.includes(ministryId);
}

export function isMinistryMember(s: PermissionSession, ministryId: string): boolean {
  return s.isAdmin || s.ministryIds.includes(ministryId);
}

// --- Top-level access ---

export function canAccessUsers(s: PermissionSession): boolean {
  return s.isAdmin || s.headOfMinistryIds.length > 0;
}

export function canAccessSettings(s: PermissionSession): boolean {
  return s.isAdmin;
}

export function canAccessForms(s: PermissionSession): boolean {
  return s.isAdmin || s.headOfMinistryIds.length > 0;
}

export function canAccessReports(s: PermissionSession): boolean {
  return s.isAdmin;
}

export function canAccessPrayers(): boolean {
  return true;
}

export function canAccessLineup(): boolean {
  return true;
}

// --- Settings management (admin only) ---

export function canManageInstrumentsAndSingers(s: PermissionSession): boolean {
  return s.isAdmin;
}

export function canManageMinistry(s: PermissionSession): boolean {
  return s.isAdmin;
}

// --- ARF/PRF ---

/** Members of the target ministry can create drafts (or admin). */
export function canCreateDraftARFOrPRF(s: PermissionSession, targetMinistryId: string): boolean {
  return isMinistryMember(s, targetMinistryId);
}

/** Only heads of the target ministry can create pending-state requests (or admin). */
export function canCreateARFOrPRF(s: PermissionSession, targetMinistryId: string): boolean {
  return isMinistryHead(s, targetMinistryId);
}

export function canApproveARFOrPRF(s: PermissionSession, targetMinistryId: string): boolean {
  return isMinistryHead(s, targetMinistryId);
}

// --- Lineup ---

export function canCreateLineup(s: PermissionSession, musicMinistryId: string): boolean {
  return isMinistryMember(s, musicMinistryId);
}

export function canApproveLineup(s: PermissionSession, musicMinistryId: string): boolean {
  return isMinistryHead(s, musicMinistryId);
}

export function canSeeDraftLineup(
  s: PermissionSession,
  createdById: string,
  currentUserId: string
): boolean {
  return s.isAdmin || createdById === currentUserId;
}

// --- Prayer (Parakletos-scoped) ---

export function canManagePrayer(
  s: PermissionSession,
  parakletosMinistryId: string,
  createdById: string,
  currentUserId: string
): { canView: boolean; canEdit: boolean; canDelete: boolean; canSetStatus: boolean } {
  if (s.isAdmin) {
    return { canView: true, canEdit: true, canDelete: true, canSetStatus: true };
  }
  if (createdById === currentUserId) {
    return { canView: true, canEdit: true, canDelete: true, canSetStatus: false };
  }
  if (isMinistryHead(s, parakletosMinistryId)) {
    return { canView: true, canEdit: false, canDelete: true, canSetStatus: true };
  }
  if (isMinistryMember(s, parakletosMinistryId)) {
    return { canView: true, canEdit: false, canDelete: false, canSetStatus: true };
  }
  return { canView: false, canEdit: false, canDelete: false, canSetStatus: false };
}

export function canViewAllPrayers(s: PermissionSession, parakletosMinistryId: string): boolean {
  return isMinistryMember(s, parakletosMinistryId);
}

// --- Multimedia checklist ---

export function canViewChecklistHistory(
  s: PermissionSession,
  multimediaMinistryId: string
): boolean {
  return isMinistryMember(s, multimediaMinistryId);
}

export function canToggleChecklistItem(
  s: PermissionSession,
  multimediaMinistryId: string
): boolean {
  return isMinistryMember(s, multimediaMinistryId);
}

export function canEditChecklistTemplate(
  s: PermissionSession,
  multimediaMinistryId: string
): boolean {
  return isMinistryHead(s, multimediaMinistryId);
}

export function canManageChecklistRuns(
  s: PermissionSession,
  multimediaMinistryId: string
): boolean {
  return isMinistryHead(s, multimediaMinistryId);
}
```

The old `RoleSlug` type export is gone. Every helper that previously took `(roleSlug, ministryIds, targetMinistryId)` now takes `(session, targetMinistryId)`.

- [ ] **Step 2: Type-check**

```bash
npm run type-check
```

Expected: `lib/permissions.ts` compiles clean. Many errors elsewhere (call sites using the old signatures) — those come in Tasks 14–18.

- [ ] **Step 3: Prepare commit**

```
feat(permissions): rewrite lib/permissions.ts for per-ministry role model

Introduces PermissionSession interface and two primitives
(isMinistryHead, isMinistryMember) that every other helper builds on.
All call signatures change from (roleSlug, ministryIds, targetId) to
(session, targetId). RoleSlug type export removed.
```

Stop for user review.

---

## Task 4: Notification recipients + checklist cleanup

**Files:**

- Modify: `lib/notificationRecipients.ts`
- Modify: `lib/checklist.ts`

- [ ] **Step 1: Read the current `lib/notificationRecipients.ts`**

Open the file to see its existing function exports. You'll replace the admin query and add a new head query, while keeping the same public surface (plus one addition).

- [ ] **Step 2: Rewrite `getAdminUserIds`**

Find the `getAdminUserIds` function and replace its body with:

```ts
export async function getAdminUserIds(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { isAdmin: true, status: "active" },
    select: { id: true },
  });
  return admins.map((u) => u.id);
}
```

Old implementation used a `role.slug === "admin"` join.

- [ ] **Step 3: Update `getMinistryMemberIds` to filter active users**

Find `getMinistryMemberIds` and update its body:

```ts
export async function getMinistryMemberIds(ministryId: string): Promise<string[]> {
  const rows = await prisma.userMinistry.findMany({
    where: {
      ministryId,
      user: { status: "active" },
    },
    select: { userId: true },
  });
  return rows.map((r) => r.userId);
}
```

The `status: "active"` filter is load-bearing: pending and inactive users must not receive notifications.

- [ ] **Step 4: Add new `getMinistryHeadIds`**

Append this new function near `getMinistryMemberIds`:

```ts
/** Returns active users who are heads of the given ministry. */
export async function getMinistryHeadIds(ministryId: string): Promise<string[]> {
  const rows = await prisma.userMinistry.findMany({
    where: {
      ministryId,
      role: "head",
      user: { status: "active" },
    },
    select: { userId: true },
  });
  return rows.map((r) => r.userId);
}
```

- [ ] **Step 5: Leave `getLineupParticipantIds` unchanged**

It operates on assignment tables, not role tables, so no changes needed.

- [ ] **Step 6: Simplify `getRunClosedRecipients` in `lib/checklist.ts`**

Find `getRunClosedRecipients` in `lib/checklist.ts`. Replace its body with:

```ts
export async function getRunClosedRecipients(
  multimediaMinistryId: string,
  actorUserId: string | null
): Promise<string[]> {
  const [adminIds, headIds] = await Promise.all([
    getAdminUserIds(),
    getMinistryHeadIds(multimediaMinistryId),
  ]);
  const all = new Set<string>([...adminIds, ...headIds]);
  if (actorUserId) all.delete(actorUserId);
  return Array.from(all);
}
```

And update the imports at the top of `lib/checklist.ts` to include the new helper:

```ts
import {
  getAdminUserIds,
  getMinistryMemberIds,
  getMinistryHeadIds,
} from "@/lib/notificationRecipients";
```

Remove the direct Prisma query on `prisma.user.findMany` with the `role.slug === "ministry_head"` condition that was previously inlined — that logic now lives in `getMinistryHeadIds`.

If `getTemplateChangeRecipients` is still defined in `lib/checklist.ts`, leave it alone — it uses `getMinistryMemberIds` which is already updated in Step 3.

- [ ] **Step 7: Type-check + lint**

```bash
npm run type-check && npm run lint
```

Expected: both clean. These two files are now consistent with the new schema; they don't depend on session shape.

- [ ] **Step 8: Prepare commit**

```
feat(notifications): update recipient helpers for new user model

- getAdminUserIds queries isAdmin: true + status: active
- getMinistryMemberIds filters active users (pending/inactive excluded)
- New getMinistryHeadIds centralizes "heads of ministry X" query
- Simplify lib/checklist.ts getRunClosedRecipients to use the helpers
```

Stop for user review.

---

## Task 5: Seed update + fresh reset verification

**Files:**

- Modify: `lib/db/seed.ts`

- [ ] **Step 1: Remove Role/Permission/RolePermission seeding**

Open `lib/db/seed.ts`. Near the top of `main()` there's a block that seeds roles with slugs `admin`, `ministry_head`, `user`. Delete the entire roles-seeding block and any variables it declares (e.g. `const roles = [...]` loop).

Also delete any `Permission` or `RolePermission` seeding if present. Grep for `prisma.permission` and `prisma.rolePermission` to find them.

- [ ] **Step 2: Update admin user creation**

Find the block that creates the admin user (search for `adminEmail` or `ADMIN_EMAIL`). The current code uses `role.connect: { slug: "admin" }`. Replace with `isAdmin: true` and set `status: "active"`:

```ts
// --- Admin user ---
const adminEmail = process.env.ADMIN_EMAIL ?? "admin@mndbd.com";
const adminPassword = process.env.ADMIN_PASSWORD ?? "ChangeMe123!";

const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
if (existingAdmin) {
  console.log(`Admin user already exists: ${adminEmail}`);
} else {
  const hashedPassword = await bcrypt.hash(adminPassword, 10);
  await prisma.user.create({
    data: {
      email: adminEmail,
      hashedPassword,
      name: "Admin",
      isAdmin: true,
      status: "active",
      updatedAt: now,
    },
  });
  console.log(`Admin user created: ${adminEmail}`);
  console.log("  (Change password after first login or set ADMIN_PASSWORD in .env)");
}
```

The admin has `isAdmin: true`, no ministry memberships by default (admin is global), and is immediately `active`. Note: there is no longer a `roleId` or `ministryId` field to set.

- [ ] **Step 3: Verify the Multimedia checklist seed block still compiles**

Later in `main()` there's a block starting `// --- Multimedia checklist starter template ---`. It uses `prisma.ministry.findUnique({ where: { slug: "multimedia" }})` and then upserts a `ChecklistTemplate`. This block is unchanged and should still compile — it doesn't reference User fields that were dropped.

Sanity check: there should be no `user.ministryId` or `role.slug` references anywhere in `lib/db/seed.ts` after your edits. Grep:

```bash
grep -n "roleId\|role\.\|ministryId" lib/db/seed.ts
```

Expected: the only matches should be inside the unchanged checklist block where `ministryId` refers to `multimediaMinistry.id` (a local variable), not the dropped `User.ministryId` column.

- [ ] **Step 4: Run the seed against the freshly reset DB**

The DB was already reset in Task 1 Step 6. Now run:

```bash
npm run db:seed
```

Expected final log lines:

```
Roles seeded.        ← NO! This line should NOT appear anymore (roles block was deleted)
Ministries seeded.
Instruments seeded.  ← or similar
Singer roles seeded.
Admin user created: admin@mndbd.com
Multimedia checklist starter template seeded.
```

If "Roles seeded." still appears, Step 1 wasn't complete — delete the roles block.

- [ ] **Step 5: Verify via inline script**

```bash
npx tsx -e "const {PrismaClient} = require('@prisma/client'); const p = new PrismaClient(); (async () => { const admin = await p.user.findFirst({where:{isAdmin:true}}); console.log('admin:', admin?.email, 'status:', admin?.status, 'isAdmin:', admin?.isAdmin); const count = await p.ministry.count(); console.log('ministries:', count); const template = await p.checklistTemplate.findFirst({include:{categories:{include:{items:true}}}}); console.log('checklist template:', template?.id, '- categories:', template?.categories.length); await p.$disconnect(); })();"
```

Expected:

```
admin: admin@mndbd.com status: active isAdmin: true
ministries: 12
checklist template: cm... - categories: 3
```

- [ ] **Step 6: Type-check + lint**

```bash
npm run type-check && npm run lint
```

Expected: still errors elsewhere (Tasks 14–18), but `lib/db/seed.ts` specifically should not contribute any.

- [ ] **Step 7: Prepare commit**

```
feat(seed): update seed script for new user model

- Remove Role/Permission/RolePermission seeding
- Create admin user with isAdmin: true + status: active
- Keep ministries, instruments, singer roles, and Multimedia
  checklist starter template seeding unchanged
```

Stop for user review.

---

## Task 6: Dashboard layout + Sidebar refactor to gates pattern

**Files:**

- Modify: `components/layout/Sidebar.tsx`
- Modify: `components/layout/DashboardShell.tsx`
- Modify: `app/(dashboard)/layout.tsx`

- [ ] **Step 1: Rewrite `Sidebar.tsx` to gates pattern**

Replace the existing `NavItem` interface and `navItems` array with a `show: (g) => boolean` pattern. Also add `FiMonitor` to the icon imports if not already present.

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

export interface SidebarGates {
  canAccessUsers: boolean;
  canAccessForms: boolean;
  canAccessSettings: boolean;
  canAccessReports: boolean;
  isMultimediaMember: boolean;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  show: (g: SidebarGates) => boolean;
}

const navItems: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: <FiHome className="size-5" />,
    show: () => true,
  },
  {
    href: "/dashboard/forms",
    label: "Forms",
    icon: <FiFileText className="size-5" />,
    show: (g) => g.canAccessForms,
  },
  {
    href: "/dashboard/lineup",
    label: "Music Lineup",
    icon: <FiMusic className="size-5" />,
    show: () => true,
  },
  {
    href: "/dashboard/multimedia-checklist",
    label: "Multimedia Checklist",
    icon: <FiMonitor className="size-5" />,
    show: (g) => g.isMultimediaMember,
  },
  {
    href: "/dashboard/calendar",
    label: "Calendar",
    icon: <FiCalendar className="size-5" />,
    show: () => true,
  },
  {
    href: "/dashboard/prayers",
    label: "Prayers",
    icon: <FiHeart className="size-5" />,
    show: () => true,
  },
  {
    href: "/dashboard/notifications",
    label: "Notifications",
    icon: <FiBell className="size-5" />,
    show: () => true,
  },
  {
    href: "/dashboard/users",
    label: "Users",
    icon: <FiUsers className="size-5" />,
    show: (g) => g.canAccessUsers,
  },
  {
    href: "/dashboard/reports",
    label: "Reports",
    icon: <FiBarChart2 className="size-5" />,
    show: (g) => g.canAccessReports,
  },
  {
    href: "/dashboard/settings",
    label: "System Settings",
    icon: <FiSettings className="size-5" />,
    show: (g) => g.canAccessSettings,
  },
];

export interface SidebarProps {
  gates: SidebarGates;
  collapsed?: boolean;
}

export function Sidebar({ gates, collapsed = false }: SidebarProps) {
  const pathname = usePathname();
  const visibleItems = navItems.filter((item) => item.show(gates));

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-30 flex w-56 flex-col border-r border-gray-200 bg-[var(--color-card-bg)] transition-[width] md:relative md:z-0 ${collapsed ? "hidden md:flex md:w-16" : "flex md:w-56"} `}
      aria-label="Main navigation"
    >
      <nav className="flex flex-1 flex-col gap-1 p-4">
        {visibleItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-[var(--radius)] px-3 py-2 text-sm font-medium transition ${
                isActive
                  ? "bg-[var(--color-primary)] text-white"
                  : "text-[var(--color-text-dark)] hover:bg-[var(--color-soft-blue-bg)]"
              } ${collapsed ? "justify-center" : ""}`}
              aria-current={isActive ? "page" : undefined}
            >
              <span className="shrink-0" aria-hidden>
                {item.icon}
              </span>
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

The `roleSlug` and `isMultimediaMember` props are both gone from the interface — they're bundled into `gates`. The `RoleSlug` import at the top is deleted.

- [ ] **Step 2: Update `DashboardShell.tsx`**

Open `components/layout/DashboardShell.tsx`. Find the `DashboardShellProps` interface and change it:

```tsx
import type { SidebarGates } from "@/components/layout/Sidebar";

interface DashboardShellProps {
  // ... existing props (user, notifications, etc.) unchanged
  gates: SidebarGates;
  // Remove: roleSlug, isMultimediaMember
}
```

Update the function signature to destructure `gates` instead of `roleSlug` + `isMultimediaMember`. Then update the `<Sidebar>` call site:

```tsx
<Sidebar gates={gates} collapsed={sidebarCollapsed} />
```

Remove any other `roleSlug` usage inside `DashboardShell` (e.g., in the Navbar prop — if `Navbar` needs to know admin status, pass `gates.canAccessSettings` or add a separate `isAdmin` prop). Check `Navbar` usage at the bottom of `DashboardShell.tsx` — if it takes `roleSlug`, change that call and fix `Navbar` in Task 18.

- [ ] **Step 3: Update `app/(dashboard)/layout.tsx`**

Rewrite the layout's body to compute the gates and pass them to `DashboardShell`. Replace the existing layout function with:

```tsx
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getMultimediaMinistryId } from "@/lib/checklist";
import {
  canAccessForms,
  canAccessReports,
  canAccessSettings,
  canAccessUsers,
  isMinistryMember,
  type PermissionSession,
} from "@/lib/permissions";
import { DashboardShell } from "@/components/layout/DashboardShell";
import type { SidebarGates } from "@/components/layout/Sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    redirect("/login?callbackUrl=/dashboard");
  }
  if (session.status === "pending") {
    redirect("/pending");
  }
  if (session.status === "inactive") {
    redirect("/login?error=inactive");
  }

  const permissionSession: PermissionSession = {
    isAdmin: session.isAdmin,
    ministryIds: session.ministryIds,
    headOfMinistryIds: session.headOfMinistryIds,
  };

  const multimediaMinistryId = await getMultimediaMinistryId();

  const gates: SidebarGates = {
    canAccessUsers: canAccessUsers(permissionSession),
    canAccessForms: canAccessForms(permissionSession),
    canAccessSettings: canAccessSettings(permissionSession),
    canAccessReports: canAccessReports(permissionSession),
    isMultimediaMember: multimediaMinistryId
      ? isMinistryMember(permissionSession, multimediaMinistryId)
      : false,
  };

  const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY ?? "";
  const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? "";

  return (
    <DashboardShell
      user={{
        name: session.user?.name ?? null,
        email: session.user?.email ?? null,
      }}
      gates={gates}
      pusherKey={pusherKey}
      pusherCluster={pusherCluster}
    >
      {children}
    </DashboardShell>
  );
}
```

Note: the `notifications` prop previously passed to `DashboardShell` — if the existing layout fetches and passes it, preserve that code. Only the role/ministry props change shape.

- [ ] **Step 4: Type-check**

```bash
npm run type-check
```

Expected: errors are decreasing but still present. Sidebar, DashboardShell, and the layout should compile clean; remaining errors are in feature route/page files.

- [ ] **Step 5: Prepare commit**

```
feat(layout): refactor Sidebar to gates pattern

- Sidebar takes SidebarGates prop instead of roleSlug + isMultimediaMember
- Each nav item declares show: (g) => boolean for visibility
- Dashboard layout computes gates from permission helpers and threads
  them through DashboardShell
- Add pending/inactive redirects to dashboard layout
- System Settings nav entry now gated on canAccessSettings (admin only)
```

Stop for user review.

---

## Task 7: Signup flow (schema, API, page)

**Files:**

- Modify: `schemas/user.ts`
- Modify: `app/api/auth/register/route.ts`
- Modify: `app/signup/page.tsx`

- [ ] **Step 1: Rewrite `signupSchema` in `schemas/user.ts`**

Replace the existing `signupSchema` block with:

```ts
export const signupSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required"),
    email: z.string().email("Invalid email"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
    ministryIds: z.array(z.string().min(1)).min(1, "Pick at least one ministry"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
```

Also update `userCreateSchema` (used by admin-create-user) and `userUpdateSchema` (used by admin-edit-user):

```ts
export const userCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  isAdmin: z.boolean().optional().default(false),
  ministryAssignments: z
    .array(
      z.object({
        ministryId: z.string().min(1),
        role: z.enum(["head", "member"]).default("member"),
      })
    )
    .optional()
    .default([]),
});

export const userUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  age: z.number().int().optional(),
  birthday: z.coerce.date().optional(),
  isAdmin: z.boolean().optional(),
  status: z.enum(["pending", "active", "inactive"]).optional(),
  ministryAssignments: z
    .array(
      z.object({
        ministryId: z.string().min(1),
        role: z.enum(["head", "member"]),
      })
    )
    .optional(),
});
```

Keep `loginSchema` unchanged.

- [ ] **Step 2: Rewrite `app/api/auth/register/route.ts`**

Replace the entire file contents with:

```ts
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signupSchema } from "@/schemas/user";
import { createNotificationsForUserIds } from "@/services/notificationService";
import { getAdminUserIds } from "@/lib/notificationRecipients";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = signupSchema.safeParse({
      ...body,
      confirmPassword: body.confirmPassword ?? body.password,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.errors[0]?.message ?? "Validation failed" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({
      where: { email: parsed.data.email },
    });
    if (existing) {
      return NextResponse.json({ message: "Email already registered." }, { status: 400 });
    }

    // Validate every ministry id exists — prevents injection of bogus ids
    const foundMinistries = await prisma.ministry.findMany({
      where: { id: { in: parsed.data.ministryIds } },
      select: { id: true },
    });
    if (foundMinistries.length !== parsed.data.ministryIds.length) {
      return NextResponse.json({ message: "Invalid ministry selection." }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(parsed.data.password, 10);
    const user = await prisma.user.create({
      data: {
        name: parsed.data.name.trim(),
        email: parsed.data.email,
        hashedPassword,
        isAdmin: false,
        status: "pending",
        updatedAt: new Date(),
        userMinistries: {
          create: parsed.data.ministryIds.map((mId) => ({
            ministryId: mId,
            role: "member" as const,
          })),
        },
      },
    });

    // Notify all admins
    const adminIds = await getAdminUserIds();
    if (adminIds.length > 0) {
      await createNotificationsForUserIds(adminIds, {
        type: "user_signup_pending",
        title: "New signup awaiting approval",
        body: `${user.name} has requested access`,
        link: "/dashboard/users?tab=pending",
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Register error:", e);
    return NextResponse.json({ message: "Registration failed." }, { status: 500 });
  }
}
```

- [ ] **Step 3: Rewrite `app/signup/page.tsx`**

Replace the existing signup page. It needs to: fetch ministries, render a checkbox grid for selection, validate at least one is picked, submit without auto-sign-in, and show a success screen.

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Input, Card } from "@/components/ui";

interface Ministry {
  id: string;
  name: string;
  description?: string | null;
}

interface FormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  ministryIds: string[];
}

export default function SignupPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [ministries, setMinistries] = useState<Ministry[]>([]);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    ministryIds: [],
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Redirect authenticated users
  useEffect(() => {
    if (status === "authenticated" && session?.userId) {
      if (session.status === "pending") {
        router.replace("/pending");
      } else {
        router.replace("/dashboard");
      }
    }
  }, [status, session?.userId, session?.status, router]);

  // Load ministries
  useEffect(() => {
    fetch("/api/options/ministries", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load ministries"))))
      .then((data: { ministries?: Ministry[] } | Ministry[]) => {
        const list = Array.isArray(data) ? data : (data.ministries ?? []);
        setMinistries(list);
      })
      .catch(() => setMinistries([]));
  }, []);

  const toggleMinistry = useCallback((id: string) => {
    setFormData((prev) => ({
      ...prev,
      ministryIds: prev.ministryIds.includes(id)
        ? prev.ministryIds.filter((m) => m !== id)
        : [...prev.ministryIds, id],
    }));
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitError(null);
      const nextErrors: Partial<Record<keyof FormData, string>> = {};
      if (!formData.name.trim()) nextErrors.name = "Name is required";
      if (!formData.email) nextErrors.email = "Email is required";
      if (formData.password.length < 8) nextErrors.password = "Min 8 characters";
      if (formData.password !== formData.confirmPassword) {
        nextErrors.confirmPassword = "Passwords do not match";
      }
      if (formData.ministryIds.length === 0) {
        nextErrors.ministryIds = "Pick at least one ministry";
      }
      setErrors(nextErrors);
      if (Object.keys(nextErrors).length > 0) return;

      setLoading(true);
      try {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { message?: string };
          throw new Error(data.message ?? "Signup failed");
        }
        setSuccess(true);
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "Signup failed");
      } finally {
        setLoading(false);
      }
    },
    [formData]
  );

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-md p-8 text-center">
          <h1 className="mb-2 text-xl font-semibold">Thanks for signing up</h1>
          <p className="mb-6 text-sm text-[var(--color-text-muted)]">
            An admin will review your request. You&apos;ll be able to sign in once your account is
            approved.
          </p>
          <Link
            href="/login"
            className="inline-block rounded-[var(--radius)] bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white"
          >
            Go to login
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md p-8">
        <h1 className="mb-6 text-xl font-semibold">Sign up</h1>
        {submitError ? (
          <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            {submitError}
          </div>
        ) : null}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            error={errors.name}
          />
          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            error={errors.email}
          />
          <Input
            label="Password"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            error={errors.password}
          />
          <Input
            label="Confirm password"
            type="password"
            value={formData.confirmPassword}
            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
            error={errors.confirmPassword}
          />

          <div>
            <label className="mb-2 block text-sm font-medium">
              Ministries <span className="text-[var(--color-text-muted)]">(pick one or more)</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ministries.map((m) => {
                const selected = formData.ministryIds.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleMinistry(m.id)}
                    className={`rounded border p-2 text-left text-xs transition ${
                      selected
                        ? "border-[var(--color-primary)] bg-[var(--color-soft-blue-bg)]"
                        : "border-[var(--color-border)]"
                    }`}
                  >
                    <div className="font-medium">{m.name}</div>
                    {m.description ? (
                      <div className="text-[var(--color-text-muted)]">{m.description}</div>
                    ) : null}
                  </button>
                );
              })}
            </div>
            {errors.ministryIds ? (
              <div className="mt-1 text-xs text-red-600">{errors.ministryIds}</div>
            ) : null}
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Submitting…" : "Sign up"}
          </Button>
          <p className="text-center text-xs text-[var(--color-text-muted)]">
            Already have an account?{" "}
            <Link href="/login" className="text-[var(--color-primary)] underline">
              Sign in
            </Link>
          </p>
        </form>
      </Card>
    </div>
  );
}
```

Notes:

- Uses the existing `components/ui` primitives (`Button`, `Input`, `Card`). If the actual component API differs (e.g., `Input` doesn't take `error` prop), adapt to the real API — read `components/ui/index.ts` first.
- The ministries picker is a checkbox grid. For v1 this is simpler than a fancy multi-select dropdown; matches the tech-ops aesthetic of the app.
- Success screen is inline in the same component (no navigation required).

- [ ] **Step 4: Type-check + lint**

```bash
npm run type-check && npm run lint
```

Expected: `schemas/user.ts`, `app/api/auth/register/route.ts`, and `app/signup/page.tsx` compile clean.

- [ ] **Step 5: Prepare commit**

```
feat(signup): multi-ministry signup with pending status

- signupSchema requires ministryIds (array, min 1)
- userCreateSchema / userUpdateSchema accept ministryAssignments
- /api/auth/register creates user with status "pending", isAdmin false,
  and UserMinistry rows with role "member"
- Notifies all admins via in-app notification bell
- /signup page now has a checkbox grid for ministry selection
- Success screen replaces auto-sign-in after submission
```

Stop for user review.

---

## Task 8: Pending approval page

**Files:**

- Create: `app/pending/page.tsx`
- Create: `app/pending/SignOutButton.tsx`

- [ ] **Step 1: Create `app/pending/SignOutButton.tsx`**

```tsx
"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="rounded border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-dark)] hover:bg-[var(--color-soft-blue-bg)]"
    >
      Sign out
    </button>
  );
}
```

- [ ] **Step 2: Create `app/pending/page.tsx`**

```tsx
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { SignOutButton } from "./SignOutButton";

export const dynamic = "force-dynamic";

export default async function PendingPage() {
  const session = await getServerSession(authOptions);

  if (!session?.userId) {
    redirect("/login");
  }
  if (session.status === "active") {
    redirect("/dashboard");
  }
  if (session.status === "inactive") {
    redirect("/login?error=inactive");
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border border-[var(--color-border)] bg-[var(--color-card-bg)] p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-soft-blue-bg)]">
          <span className="text-xl">⏳</span>
        </div>
        <h1 className="mb-2 text-xl font-semibold text-[var(--color-text-dark)]">
          Account pending approval
        </h1>
        <p className="mb-6 text-sm text-[var(--color-text-muted)]">
          Thanks for signing up. An admin will review your account shortly. You&apos;ll be able to
          sign in once your account is approved.
        </p>
        <p className="mb-6 text-xs text-[var(--color-text-muted)]">
          For questions, please contact your church admin directly.
        </p>
        <SignOutButton />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type-check + lint**

```bash
npm run type-check && npm run lint
```

Expected: clean for these two new files.

- [ ] **Step 4: Prepare commit**

```
feat(pending): add /pending approval screen for pending users

New top-level route shown to authenticated users whose status is
"pending". Includes sign-out button and a message directing users
to contact their admin.
```

Stop for user review.

---

## Task 9: Login page polish

**Files:**

- Modify: `app/login/page.tsx`

- [ ] **Step 1: Add pending-aware redirect + error query param handling**

Open `app/login/page.tsx`. Find the `useEffect` block that redirects authenticated users to `/dashboard` and change it to branch on `session.status`:

```tsx
useEffect(() => {
  if (status === "authenticated" && session?.userId) {
    if (session.status === "pending") {
      router.replace("/pending");
    } else if (session.status === "inactive") {
      // Should have been rejected at authorize; safety net
      return;
    } else {
      router.replace("/dashboard");
    }
  }
}, [status, session?.userId, session?.status, router]);
```

Also find where the existing page reads `useSearchParams` (or `searchParams`) for the `callbackUrl`. If it doesn't already use `useSearchParams`, add:

```tsx
import { useSearchParams } from "next/navigation";
```

Inside the component:

```tsx
const searchParams = useSearchParams();
const errorParam = searchParams.get("error");

const errorMessage = (() => {
  if (!errorParam) return null;
  if (errorParam === "inactive") {
    return "Your account has been deactivated. Contact your admin.";
  }
  if (errorParam === "rejected") {
    return "Your signup was rejected. You can sign up again or contact your admin.";
  }
  return null;
})();
```

And render `errorMessage` near the top of the login form, above the inputs:

```tsx
{
  errorMessage ? (
    <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
      {errorMessage}
    </div>
  ) : null;
}
```

This should be placed above any existing login error display (which handles invalid credentials).

- [ ] **Step 2: Type-check + lint**

```bash
npm run type-check && npm run lint
```

- [ ] **Step 3: Prepare commit**

```
feat(login): add error query params and pending-aware redirect

- Recognizes ?error=inactive and ?error=rejected query params with
  friendly messages
- Redirects authenticated pending users directly to /pending instead
  of bouncing through /dashboard
```

Stop for user review.

---

## Task 10: Users API rewrite (list + CRUD with per-ministry scoping)

**Files:**

- Modify: `app/api/users/route.ts`
- Modify: `app/api/users/[id]/route.ts`

### 10a. GET/POST `/api/users/route.ts`

- [ ] **Step 1: Replace the entire file contents**

```ts
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessUsers, type PermissionSession } from "@/lib/permissions";
import { userCreateSchema } from "@/schemas/user";

export const dynamic = "force-dynamic";

function permissionSessionFrom(s: {
  isAdmin: boolean;
  ministryIds: string[];
  headOfMinistryIds: string[];
}): PermissionSession {
  return {
    isAdmin: s.isAdmin,
    ministryIds: s.ministryIds,
    headOfMinistryIds: s.headOfMinistryIds,
  };
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ps = permissionSessionFrom(session);
  if (!canAccessUsers(ps)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tab = new URL(request.url).searchParams.get("tab") ?? "active";
  if (tab !== "active" && tab !== "pending") {
    return NextResponse.json({ message: "Invalid tab" }, { status: 400 });
  }

  // Pending tab is admin-only (no ministry head access per spec §6.2)
  if (tab === "pending" && !session.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Admin sees everyone; ministry head sees users whose memberships
  // intersect their headOfMinistryIds (Active tab only).
  const where = session.isAdmin
    ? { status: tab === "pending" ? ("pending" as const) : { not: "pending" as const } }
    : {
        status: { not: "pending" as const },
        userMinistries: {
          some: { ministryId: { in: session.headOfMinistryIds } },
        },
      };

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      userMinistries: {
        include: { ministry: { select: { id: true, name: true } } },
      },
    },
  });

  const shaped = users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    isAdmin: u.isAdmin,
    status: u.status,
    createdAt: u.createdAt.toISOString(),
    ministries: u.userMinistries.map((um) => ({
      id: um.ministry.id,
      name: um.ministry.name,
      role: um.role,
    })),
  }));

  return NextResponse.json({ users: shaped });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = userCreateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.errors[0]?.message ?? "Validation failed" },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return NextResponse.json({ message: "Email already registered." }, { status: 400 });
  }

  // Validate every ministry id exists
  const ministryIds = parsed.data.ministryAssignments.map((a) => a.ministryId);
  if (ministryIds.length > 0) {
    const found = await prisma.ministry.findMany({
      where: { id: { in: ministryIds } },
      select: { id: true },
    });
    if (found.length !== ministryIds.length) {
      return NextResponse.json({ message: "Invalid ministry selection." }, { status: 400 });
    }
  }

  const hashedPassword = await bcrypt.hash(parsed.data.password, 10);
  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      hashedPassword,
      isAdmin: parsed.data.isAdmin,
      status: "active", // admin-created users skip the pending queue
      updatedAt: new Date(),
      userMinistries: {
        create: parsed.data.ministryAssignments.map((a) => ({
          ministryId: a.ministryId,
          role: a.role,
        })),
      },
    },
  });

  return NextResponse.json({ id: user.id });
}
```

### 10b. GET/PUT/DELETE `/api/users/[id]/route.ts`

- [ ] **Step 2: Replace the entire file contents**

```ts
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessUsers, type PermissionSession } from "@/lib/permissions";
import { userUpdateSchema } from "@/schemas/user";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function permissionSessionFrom(s: {
  isAdmin: boolean;
  ministryIds: string[];
  headOfMinistryIds: string[];
}): PermissionSession {
  return {
    isAdmin: s.isAdmin,
    ministryIds: s.ministryIds,
    headOfMinistryIds: s.headOfMinistryIds,
  };
}

async function guard(id: string) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const ps = permissionSessionFrom(session);
  if (!canAccessUsers(ps)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  const target = await prisma.user.findUnique({
    where: { id },
    include: { userMinistries: { select: { ministryId: true, role: true } } },
  });
  if (!target) {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }

  // Ministry-head scoping: can only access users whose memberships
  // intersect with the editor's headOfMinistryIds
  if (!session.isAdmin) {
    const targetMinistryIds = new Set(target.userMinistries.map((um) => um.ministryId));
    const overlap = session.headOfMinistryIds.some((id) => targetMinistryIds.has(id));
    if (!overlap) {
      return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    }
  }

  return { session, target };
}

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const g = await guard(id);
  if ("error" in g) return g.error;

  const full = await prisma.user.findUnique({
    where: { id },
    include: {
      userMinistries: {
        include: { ministry: { select: { id: true, name: true } } },
      },
    },
  });
  if (!full) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    user: {
      id: full.id,
      email: full.email,
      name: full.name,
      address: full.address,
      age: full.age,
      birthday: full.birthday?.toISOString() ?? null,
      isAdmin: full.isAdmin,
      status: full.status,
      ministries: full.userMinistries.map((um) => ({
        id: um.ministry.id,
        name: um.ministry.name,
        role: um.role,
      })),
    },
  });
}

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const g = await guard(id);
  if ("error" in g) return g.error;

  const parsed = userUpdateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.errors[0]?.message ?? "Validation failed" },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const isAdminEditor = g.session.isAdmin;

  // --- Ministry head editors: filter payload to scoped fields only ---
  // Everything except ministryAssignments is silently dropped.
  const allowedBasic = isAdminEditor
    ? {
        name: data.name,
        email: data.email,
        address: data.address,
        age: data.age,
        birthday: data.birthday,
        isAdmin: data.isAdmin,
        status: data.status,
      }
    : {};

  // --- Ministry assignments diff (if provided) ---
  // Admin: replace the full set
  // Ministry head: merge — editor's headOfMinistryIds subset is replaced
  //   by the payload; ministries outside the editor's scope are preserved
  //   unchanged. Any payload entry that touches a ministry outside the
  //   editor's scope is rejected as 403.
  let ministryUpdates: { replace: Array<{ ministryId: string; role: "head" | "member" }> } | null =
    null;

  if (data.ministryAssignments !== undefined) {
    if (isAdminEditor) {
      ministryUpdates = { replace: data.ministryAssignments };
    } else {
      // Validate the editor only touches ministries they head
      const headSet = new Set(g.session.headOfMinistryIds);
      for (const a of data.ministryAssignments) {
        if (!headSet.has(a.ministryId)) {
          return NextResponse.json(
            { error: "Cannot modify ministries outside your scope" },
            { status: 403 }
          );
        }
      }
      // Merge: preserve out-of-scope memberships, replace in-scope ones
      const preserved = g.target.userMinistries.filter((um) => !headSet.has(um.ministryId));
      ministryUpdates = {
        replace: [
          ...preserved.map((um) => ({
            ministryId: um.ministryId,
            role: um.role as "head" | "member",
          })),
          ...data.ministryAssignments,
        ],
      };
    }
  }

  // Transactional update
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: {
        ...(allowedBasic.name !== undefined && { name: allowedBasic.name }),
        ...(allowedBasic.email !== undefined && { email: allowedBasic.email }),
        ...(allowedBasic.address !== undefined && { address: allowedBasic.address }),
        ...(allowedBasic.age !== undefined && { age: allowedBasic.age }),
        ...(allowedBasic.birthday !== undefined && { birthday: allowedBasic.birthday }),
        ...(allowedBasic.isAdmin !== undefined && { isAdmin: allowedBasic.isAdmin }),
        ...(allowedBasic.status !== undefined && { status: allowedBasic.status }),
        updatedAt: new Date(),
      },
    });

    if (ministryUpdates) {
      await tx.userMinistry.deleteMany({ where: { userId: id } });
      if (ministryUpdates.replace.length > 0) {
        await tx.userMinistry.createMany({
          data: ministryUpdates.replace.map((a) => ({
            userId: id,
            ministryId: a.ministryId,
            role: a.role,
          })),
        });
      }
    }
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    // P2003 = foreign key constraint violation (user has authored records)
    return NextResponse.json(
      {
        error:
          "This user has created records (ARFs, lineups, checks, etc.) that reference them. Deactivate instead of deleting.",
      },
      { status: 409 }
    );
  }
}
```

- [ ] **Step 3: Type-check + lint**

```bash
npm run type-check && npm run lint
```

Expected: `app/api/users/*` files compile clean. Other errors still exist (Tasks 14–18).

- [ ] **Step 4: Prepare commit**

```
feat(users): rewrite users API for per-ministry role model

- GET /api/users supports ?tab=active|pending (pending admin-only)
- Response includes ministries[].role per user
- Ministry-head scoping: only users sharing a headed ministry visible
- PUT enforces scoped diff for ministry heads: in-scope assignments
  replaced, out-of-scope preserved unchanged; touching out-of-scope
  returns 403
- DELETE returns 409 with clear message on FK constraint violation
```

Stop for user review.

---

## Task 11: Approve + Reject API routes

**Files:**

- Create: `app/api/users/[id]/approve/route.ts`
- Create: `app/api/users/[id]/reject/route.ts`

- [ ] **Step 1: Create `approve/route.ts`**

```ts
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const approveBodySchema = z.object({
  ministryIds: z.array(z.string().min(1)).min(1, "Pick at least one ministry"),
});

export async function POST(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const parsed = approveBodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.errors[0]?.message ?? "Validation failed" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (user.status !== "pending") {
    return NextResponse.json({ message: "User is not pending approval" }, { status: 409 });
  }

  // Validate every ministry id exists
  const found = await prisma.ministry.findMany({
    where: { id: { in: parsed.data.ministryIds } },
    select: { id: true },
  });
  if (found.length !== parsed.data.ministryIds.length) {
    return NextResponse.json({ message: "Invalid ministry selection." }, { status: 400 });
  }

  // Replace memberships and flip status in one transaction
  await prisma.$transaction(async (tx) => {
    await tx.userMinistry.deleteMany({ where: { userId: id } });
    await tx.userMinistry.createMany({
      data: parsed.data.ministryIds.map((mId) => ({
        userId: id,
        ministryId: mId,
        role: "member" as const,
      })),
    });
    await tx.user.update({
      where: { id },
      data: { status: "active", updatedAt: new Date() },
    });
  });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Create `reject/route.ts`**

```ts
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (user.status !== "pending") {
    return NextResponse.json({ message: "User is not pending approval" }, { status: 409 });
  }

  // Hard-delete — cascade removes UserMinistry rows automatically via FK
  await prisma.user.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Type-check + lint**

```bash
npm run type-check && npm run lint
```

- [ ] **Step 4: Prepare commit**

```
feat(users): add approve and reject endpoints for pending signups

- POST /api/users/[id]/approve accepts { ministryIds }, replaces
  memberships, flips status to active. 409 if not pending.
- DELETE /api/users/[id]/reject hard-deletes the pending user.
  409 if not pending. Cascade removes UserMinistry via FK.
- Both admin-only.
```

Stop for user review.

---

## Task 12: UserForm rewrite (ministry memberships section)

**Files:**

- Modify: `features/users/UserForm.tsx` (full rewrite)

- [ ] **Step 1: Read the current file first**

Open `features/users/UserForm.tsx` to understand its existing prop shape and how it's called from the users page. The rewrite below assumes it's a client component called with an optional `initialUser` prop for edit mode and a callback for submission. Adapt to the actual shape.

- [ ] **Step 2: Replace the component**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Input, Card } from "@/components/ui";

interface Ministry {
  id: string;
  name: string;
}

interface MinistryAssignment {
  ministryId: string;
  ministryName: string;
  role: "head" | "member";
}

export interface UserFormInitial {
  id?: string;
  name: string;
  email: string;
  address?: string | null;
  age?: number | null;
  birthday?: string | null;
  isAdmin: boolean;
  status: "pending" | "active" | "inactive";
  ministries: MinistryAssignment[];
}

export interface UserFormProps {
  /** Initial values in edit mode; undefined in create mode. */
  initial?: UserFormInitial;
  /** Full list of ministries for the add-picker. */
  allMinistries: Ministry[];
  /** Whether the current editor is admin (false = ministry head). */
  editorIsAdmin: boolean;
  /** Ministries the current editor heads (for head-scoped edit). */
  editorHeadOfMinistryIds: string[];
  /** Called with the validated form body to submit. */
  onSubmit: (body: {
    name?: string;
    email?: string;
    password?: string;
    address?: string;
    age?: number;
    birthday?: string;
    isAdmin?: boolean;
    status?: "pending" | "active" | "inactive";
    ministryAssignments?: MinistryAssignment[];
  }) => Promise<void>;
  submitLabel: string;
}

export function UserForm({
  initial,
  allMinistries,
  editorIsAdmin,
  editorHeadOfMinistryIds,
  onSubmit,
  submitLabel,
}: UserFormProps) {
  const isCreate = !initial;
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [password, setPassword] = useState("");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [age, setAge] = useState<string>(initial?.age != null ? String(initial.age) : "");
  const [birthday, setBirthday] = useState(initial?.birthday ?? "");
  const [isAdminFlag, setIsAdminFlag] = useState(initial?.isAdmin ?? false);
  const [status, setStatus] = useState<"pending" | "active" | "inactive">(
    initial?.status ?? "active"
  );
  const [assignments, setAssignments] = useState<MinistryAssignment[]>(initial?.ministries ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Scoping for ministry head editors ---
  const canEditBasicInfo = editorIsAdmin;
  const canEditIsAdmin = editorIsAdmin;
  const canEditStatus = editorIsAdmin;

  const isMinistryInEditorScope = useCallback(
    (mId: string): boolean => editorIsAdmin || editorHeadOfMinistryIds.includes(mId),
    [editorIsAdmin, editorHeadOfMinistryIds]
  );

  // Ministries visible in the memberships section:
  //   Admin: all of the user's current memberships
  //   Ministry head: only memberships in ministries they head
  const visibleAssignments = assignments.filter((a) => isMinistryInEditorScope(a.ministryId));

  // Ministries available in the "+ Add" picker:
  //   Admin: all ministries not already in assignments
  //   Ministry head: ministries they head that the user isn't already in
  const addableMinistries = allMinistries.filter((m) => {
    if (assignments.some((a) => a.ministryId === m.id)) return false;
    if (!editorIsAdmin && !editorHeadOfMinistryIds.includes(m.id)) return false;
    return true;
  });

  const [addPickerOpen, setAddPickerOpen] = useState(false);

  const toggleRole = useCallback((ministryId: string) => {
    setAssignments((prev) =>
      prev.map((a) =>
        a.ministryId === ministryId ? { ...a, role: a.role === "head" ? "member" : "head" } : a
      )
    );
  }, []);

  const removeAssignment = useCallback((ministryId: string) => {
    setAssignments((prev) => prev.filter((a) => a.ministryId !== ministryId));
  }, []);

  const addAssignment = useCallback((ministryId: string, ministryName: string) => {
    setAssignments((prev) => [...prev, { ministryId, ministryName, role: "member" }]);
    setAddPickerOpen(false);
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setBusy(true);
      try {
        const body: Parameters<typeof onSubmit>[0] = {};

        if (canEditBasicInfo) {
          body.name = name.trim();
          body.email = email;
          if (address) body.address = address;
          if (age) body.age = Number(age);
          if (birthday) body.birthday = birthday;
        }
        if (canEditIsAdmin) {
          body.isAdmin = isAdminFlag;
        }
        if (canEditStatus) {
          body.status = status;
        }
        if (isCreate && password) {
          body.password = password;
        }

        // Ministry assignments
        if (editorIsAdmin) {
          body.ministryAssignments = assignments;
        } else {
          // Only in-scope rows are submitted; server preserves out-of-scope
          body.ministryAssignments = assignments.filter((a) =>
            editorHeadOfMinistryIds.includes(a.ministryId)
          );
        }

        await onSubmit(body);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      } finally {
        setBusy(false);
      }
    },
    [
      canEditBasicInfo,
      canEditIsAdmin,
      canEditStatus,
      name,
      email,
      address,
      age,
      birthday,
      isAdminFlag,
      status,
      isCreate,
      password,
      editorIsAdmin,
      assignments,
      editorHeadOfMinistryIds,
      onSubmit,
    ]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error ? (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {/* Basic info */}
      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold">Basic info</h3>
        <div className="space-y-3">
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!canEditBasicInfo}
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={!canEditBasicInfo}
          />
          {isCreate ? (
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          ) : null}
          <Input
            label="Address"
            value={address ?? ""}
            onChange={(e) => setAddress(e.target.value)}
            disabled={!canEditBasicInfo}
          />
          <Input
            label="Age"
            type="number"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            disabled={!canEditBasicInfo}
          />
          <Input
            label="Birthday"
            type="date"
            value={birthday ?? ""}
            onChange={(e) => setBirthday(e.target.value)}
            disabled={!canEditBasicInfo}
          />
          {canEditStatus ? (
            <div>
              <label className="mb-1 block text-xs font-medium">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as "pending" | "active" | "inactive")}
                className="w-full rounded border border-[var(--color-border)] p-2 text-sm"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          ) : null}
          {canEditIsAdmin ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isAdminFlag}
                onChange={(e) => setIsAdminFlag(e.target.checked)}
              />
              <span>Admin (global access to all ministries)</span>
            </label>
          ) : null}
        </div>
      </Card>

      {/* Ministry memberships */}
      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold">
          Ministries{" "}
          {!editorIsAdmin ? (
            <span className="text-xs font-normal text-[var(--color-text-muted)]">
              (only showing ministries you head)
            </span>
          ) : null}
        </h3>
        {visibleAssignments.length === 0 ? (
          <div className="text-sm text-[var(--color-text-muted)]">No ministry memberships yet.</div>
        ) : (
          <div className="space-y-2">
            {visibleAssignments.map((a) => (
              <div
                key={a.ministryId}
                className="flex items-center gap-3 rounded border border-[var(--color-border)] p-2"
              >
                <span className="flex-1 text-sm">{a.ministryName}</span>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={a.role === "head"}
                    onChange={() => toggleRole(a.ministryId)}
                  />
                  <span>Head</span>
                </label>
                <button
                  type="button"
                  onClick={() => removeAssignment(a.ministryId)}
                  className="text-red-600 hover:text-red-800"
                  aria-label={`Remove ${a.ministryName}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {addableMinistries.length > 0 ? (
          <div className="mt-3">
            {!addPickerOpen ? (
              <button
                type="button"
                onClick={() => setAddPickerOpen(true)}
                className="rounded border border-dashed border-[var(--color-primary)] px-3 py-1 text-xs text-[var(--color-primary)]"
              >
                + Add ministry
              </button>
            ) : (
              <div className="space-y-2 rounded border border-[var(--color-border)] p-2">
                <div className="mb-1 text-xs font-medium">Pick a ministry:</div>
                <div className="flex flex-wrap gap-1">
                  {addableMinistries.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => addAssignment(m.id, m.name)}
                      className="rounded border border-[var(--color-border)] px-2 py-1 text-xs hover:bg-[var(--color-soft-blue-bg)]"
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setAddPickerOpen(false)}
                  className="text-xs text-[var(--color-text-muted)]"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        ) : null}
      </Card>

      <Button type="submit" disabled={busy}>
        {busy ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
```

- [ ] **Step 3: Type-check + lint**

```bash
npm run type-check && npm run lint
```

- [ ] **Step 4: Prepare commit**

```
feat(users): rewrite UserForm with ministry memberships section

- Ministry memberships list with head/member toggle per row
- Add ministry picker with scoped options
- Ministry-head editors: basic info fields disabled, only in-scope
  ministries visible, isAdmin/status hidden
- Admin editors: full form
```

Stop for user review.

---

## Task 13: UsersTableClient rewrite (tabs, pending, approve inline panel)

**Files:**

- Modify: `features/users/UsersTableClient.tsx` (full rewrite)

- [ ] **Step 1: Replace the component**

```tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

interface Ministry {
  id: string;
  name: string;
  role: "head" | "member";
}

interface UserRow {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  status: "pending" | "active" | "inactive";
  createdAt: string;
  ministries: Ministry[];
}

interface AllMinistry {
  id: string;
  name: string;
}

type Tab = "active" | "pending";

export interface UsersTableClientProps {
  /** Whether the current user is admin (controls Pending tab visibility + actions). */
  viewerIsAdmin: boolean;
  /** Full ministries list for the approve inline panel. */
  allMinistries: AllMinistry[];
}

export function UsersTableClient({ viewerIsAdmin, allMinistries }: UsersTableClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as Tab) || "active";

  const [tab, setTab] = useState<Tab>(
    initialTab === "pending" && viewerIsAdmin ? "pending" : "active"
  );
  const [activeUsers, setActiveUsers] = useState<UserRow[] | null>(null);
  const [pendingUsers, setPendingUsers] = useState<UserRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch users for the current tab
  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch(`/api/users?tab=${tab}`, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Failed to load users (${res.status})`);
      }
      const data = (await res.json()) as { users: UserRow[] };
      if (tab === "active") setActiveUsers(data.users);
      else setPendingUsers(data.users);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    }
  }, [tab]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Also load pending in the background (for badge count) if admin
  useEffect(() => {
    if (!viewerIsAdmin || tab === "pending") return;
    fetch("/api/users?tab=pending", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("badge load failed"))))
      .then((data: { users: UserRow[] }) => setPendingUsers(data.users))
      .catch(() => {
        /* silent */
      });
  }, [viewerIsAdmin, tab]);

  const pendingCount = pendingUsers?.length ?? 0;

  const switchTab = useCallback((next: Tab) => {
    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState({}, "", url.toString());
  }, []);

  return (
    <div>
      {/* Tab bar */}
      <div className="mb-4 flex gap-2 border-b border-[var(--color-border)]">
        <button
          type="button"
          onClick={() => switchTab("active")}
          className={`border-b-2 px-4 py-2 text-sm font-medium ${
            tab === "active"
              ? "border-[var(--color-primary)] text-[var(--color-primary)]"
              : "border-transparent text-[var(--color-text-muted)]"
          }`}
        >
          Active
          {activeUsers ? ` (${activeUsers.length})` : ""}
        </button>
        {viewerIsAdmin ? (
          <button
            type="button"
            onClick={() => switchTab("pending")}
            className={`border-b-2 px-4 py-2 text-sm font-medium ${
              tab === "pending"
                ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                : "border-transparent text-[var(--color-text-muted)]"
            }`}
          >
            Pending
            {pendingCount > 0 ? (
              <span className="ml-1 inline-flex items-center rounded-full bg-red-600 px-2 text-xs text-white">
                {pendingCount}
              </span>
            ) : null}
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {tab === "active" ? (
        <ActiveUsersTable users={activeUsers} />
      ) : (
        <PendingUsersTable
          users={pendingUsers}
          allMinistries={allMinistries}
          onChanged={() => {
            loadUsers();
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function ActiveUsersTable({ users }: { users: UserRow[] | null }) {
  if (users === null) {
    return <div className="text-[var(--color-text-muted)]">Loading…</div>;
  }
  if (users.length === 0) {
    return <div className="text-[var(--color-text-muted)]">No users found.</div>;
  }
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-text-muted)] uppercase">
          <th className="p-2">Name</th>
          <th className="p-2">Email</th>
          <th className="p-2">Ministries</th>
          <th className="p-2">Status</th>
          <th className="p-2" />
        </tr>
      </thead>
      <tbody>
        {users.map((u) => (
          <tr key={u.id} className="border-b border-[var(--color-border)]">
            <td className="p-2">
              <Link
                href={`/dashboard/users/${u.id}`}
                className="text-[var(--color-primary)] hover:underline"
              >
                {u.name}
              </Link>
              {u.isAdmin ? (
                <span className="ml-2 inline-flex items-center rounded bg-yellow-100 px-1 text-xs text-yellow-800">
                  admin
                </span>
              ) : null}
            </td>
            <td className="p-2 text-[var(--color-text-muted)]">{u.email}</td>
            <td className="p-2">
              <div className="flex flex-wrap gap-1">
                {u.ministries.map((m) => (
                  <span
                    key={m.id}
                    className={`rounded px-2 py-0.5 text-xs ${
                      m.role === "head"
                        ? "bg-[var(--color-primary)] text-white"
                        : "border border-[var(--color-border)] text-[var(--color-text-dark)]"
                    }`}
                  >
                    {m.name}
                    {m.role === "head" ? " · head" : ""}
                  </span>
                ))}
                {u.ministries.length === 0 ? (
                  <span className="text-xs text-[var(--color-text-muted)]">—</span>
                ) : null}
              </div>
            </td>
            <td className="p-2">
              {u.status === "inactive" ? (
                <span className="rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-700">
                  inactive
                </span>
              ) : null}
            </td>
            <td className="p-2 text-right">
              <Link
                href={`/dashboard/users/${u.id}`}
                className="text-xs text-[var(--color-primary)] hover:underline"
              >
                Edit
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PendingUsersTable({
  users,
  allMinistries,
  onChanged,
}: {
  users: UserRow[] | null;
  allMinistries: AllMinistry[];
  onChanged: () => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (users === null) {
    return <div className="text-[var(--color-text-muted)]">Loading…</div>;
  }
  if (users.length === 0) {
    return <div className="text-[var(--color-text-muted)]">No pending signups.</div>;
  }

  const approve = async (userId: string, ministryIds: string[]) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/users/${userId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ministryIds }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(d.message ?? "Approve failed");
      }
      setExpandedId(null);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setBusy(false);
    }
  };

  const reject = async (userId: string) => {
    if (
      !window.confirm(
        "Reject this signup? The user will be deleted. If they want to try again, they'll need to sign up from scratch."
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/users/${userId}/reject`, { method: "DELETE" });
      if (!res.ok) throw new Error("Reject failed");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reject failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {error ? (
        <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-text-muted)] uppercase">
            <th className="p-2">Name</th>
            <th className="p-2">Email</th>
            <th className="p-2">Requested ministries</th>
            <th className="p-2">Submitted</th>
            <th className="p-2" />
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <ApproveRow
              key={u.id}
              user={u}
              allMinistries={allMinistries}
              expanded={expandedId === u.id}
              busy={busy}
              onExpand={() => setExpandedId(expandedId === u.id ? null : u.id)}
              onApprove={(mIds) => approve(u.id, mIds)}
              onReject={() => reject(u.id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ApproveRow({
  user,
  allMinistries,
  expanded,
  busy,
  onExpand,
  onApprove,
  onReject,
}: {
  user: UserRow;
  allMinistries: AllMinistry[];
  expanded: boolean;
  busy: boolean;
  onExpand: () => void;
  onApprove: (ministryIds: string[]) => void;
  onReject: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(user.ministries.map((m) => m.id))
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <>
      <tr className="border-b border-[var(--color-border)]">
        <td className="p-2 font-medium">{user.name}</td>
        <td className="p-2 text-[var(--color-text-muted)]">{user.email}</td>
        <td className="p-2">
          <div className="flex flex-wrap gap-1">
            {user.ministries.map((m) => (
              <span
                key={m.id}
                className="rounded border border-[var(--color-border)] px-2 py-0.5 text-xs"
              >
                {m.name}
              </span>
            ))}
          </div>
        </td>
        <td className="p-2 text-xs text-[var(--color-text-muted)]">
          {new Date(user.createdAt).toLocaleString("en-US", {
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </td>
        <td className="p-2 text-right">
          <button
            type="button"
            onClick={onExpand}
            className="mr-2 rounded bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700"
          >
            Approve
          </button>
          <button
            type="button"
            onClick={onReject}
            disabled={busy}
            className="rounded border border-red-600 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
          >
            Reject
          </button>
        </td>
      </tr>
      {expanded ? (
        <tr>
          <td
            colSpan={5}
            className="border-b border-[var(--color-border)] bg-[var(--color-soft-blue-bg)] p-4"
          >
            <div className="mb-2 text-sm font-semibold">Approving {user.name}</div>
            <div className="mb-2 text-xs text-[var(--color-text-muted)]">
              Assign to which ministries? (pre-checked from request)
            </div>
            <div className="mb-3 grid grid-cols-2 gap-1 md:grid-cols-3">
              {allMinistries.map((m) => (
                <label key={m.id} className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={selected.has(m.id)}
                    onChange={() => toggle(m.id)}
                  />
                  <span>{m.name}</span>
                </label>
              ))}
            </div>
            <div className="mb-3 text-xs text-[var(--color-text-muted)]">
              Note: all assignments default to &quot;member&quot;. You can promote to head from the
              user&apos;s edit page after approval.
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onExpand}
                disabled={busy}
                className="rounded border border-[var(--color-border)] px-3 py-1 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => onApprove(Array.from(selected))}
                disabled={busy || selected.size === 0}
                className="rounded bg-green-600 px-3 py-1 text-xs text-white disabled:opacity-50"
              >
                Confirm approve
              </button>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
```

- [ ] **Step 2: Update the `/dashboard/users/page.tsx`**

Open `app/(dashboard)/dashboard/users/page.tsx`. The server page needs to:

1. Compute `permissionSession` from session and gate with `canAccessUsers`
2. Load the ministries list for the approve inline panel
3. Pass `viewerIsAdmin` and `allMinistries` to `UsersTableClient`

Replace its body with:

```tsx
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessUsers, type PermissionSession } from "@/lib/permissions";
import { UsersTableClient } from "@/features/users/UsersTableClient";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login?callbackUrl=/dashboard/users");

  const ps: PermissionSession = {
    isAdmin: session.isAdmin,
    ministryIds: session.ministryIds,
    headOfMinistryIds: session.headOfMinistryIds,
  };
  if (!canAccessUsers(ps)) redirect("/dashboard");

  const allMinistries = await prisma.ministry.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="p-page">
      <h1 className="mb-4 text-xl font-semibold">Users</h1>
      <UsersTableClient viewerIsAdmin={session.isAdmin} allMinistries={allMinistries} />
    </div>
  );
}
```

- [ ] **Step 3: Type-check + lint**

```bash
npm run type-check && npm run lint
```

- [ ] **Step 4: Prepare commit**

```
feat(users): tabs, chip display, and pending approve inline panel

- Active tab with ministry chips (head gets filled chip)
- Pending tab (admin only) with badge count
- Approve inline panel with ministry multi-select
- Reject with confirmation prompt
- Users page server component gates on canAccessUsers
```

Stop for user review.

---

## Task 14: Call-site sweep — Forms (ARF + PRF)

**Files:**

- Modify: `app/api/forms/arf/route.ts`
- Modify: `app/api/forms/arf/[id]/route.ts`
- Modify: `app/api/forms/arf/[id]/pdf/route.ts`
- Modify: `app/api/forms/prf/route.ts`
- Modify: `app/api/forms/prf/[id]/route.ts`
- Modify: `app/api/forms/prf/[id]/pdf/route.ts`
- Modify: `app/(dashboard)/dashboard/forms/**/page.tsx` (all form pages)
- Modify: `features/arf/ARFForm.tsx`, `ARFTableClient.tsx`
- Modify: `features/prf/PRFForm.tsx`, `PRFTableClient.tsx`
- Modify: `features/shared/**/*.tsx` (any that read session.roleSlug)

### The mechanical sweep pattern

Every file that reads `session.roleSlug` needs the same transformation. Learn the pattern once, apply everywhere:

**Old pattern (delete):**

```ts
import type { RoleSlug } from "@/lib/permissions";

const roleSlug = (session.roleSlug ?? "user") as RoleSlug;
const ministryIds = session.ministryIds ?? [];
if (!canCreateARFOrPRF(roleSlug)) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
// Later: if (roleSlug === "admin") ...
```

**New pattern (use):**

```ts
import { canAccessForms, canCreateARFOrPRF, type PermissionSession } from "@/lib/permissions";

const ps: PermissionSession = {
  isAdmin: session.isAdmin,
  ministryIds: session.ministryIds,
  headOfMinistryIds: session.headOfMinistryIds,
};
if (!canCreateARFOrPRF(ps, parsed.data.ministryId)) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
// Later: if (session.isAdmin) ...
```

Key substitutions:

- `session.roleSlug === "admin"` → `session.isAdmin`
- `session.roleSlug === "ministry_head"` → `isMinistryHead(ps, ministryId)` for a specific ministry, OR `session.headOfMinistryIds.length > 0` for "any head"
- `session.roleSlug === "user"` → `!session.isAdmin && session.headOfMinistryIds.length === 0` (rare; usually you just don't check this)
- `canCreateARFOrPRF(roleSlug)` → `canCreateARFOrPRF(ps, ministryId)` (now takes ministry id)
- `canCreateDraftARFOrPRF(roleSlug)` → `canCreateDraftARFOrPRF(ps, ministryId)` (new signature too)
- `import type { RoleSlug } ...` → **delete the line**

### 14.1 ARF routes

- [ ] **Step 1: Update `app/api/forms/arf/route.ts`**

Read the file first. Find every `roleSlug` read, every helper call, and every `session.roleSlug` comparison. Apply the sweep pattern. Here's the POST handler as an example — adapt every handler:

```ts
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  canAccessForms,
  canCreateDraftARFOrPRF,
  canCreateARFOrPRF,
  type PermissionSession,
} from "@/lib/permissions";
import { arfSchema } from "@/schemas/arf";
import { getAdminUserIds, getMinistryMemberIds } from "@/lib/notificationRecipients";
import { createNotificationsForUserIds } from "@/services/notificationService";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ps: PermissionSession = {
    isAdmin: session.isAdmin,
    ministryIds: session.ministryIds,
    headOfMinistryIds: session.headOfMinistryIds,
  };
  if (!canAccessForms(ps)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = arfSchema.safeParse({
    ...body,
    requestedDate: body.requestedDate ? new Date(body.requestedDate) : undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.errors[0]?.message ?? "Validation failed" },
      { status: 400 }
    );
  }

  const wantsPending = body.status === "pending" || body.createAsDraft === false;

  // Drafts: any member of the target ministry can create
  // Pending (submitted for approval): only heads of the target ministry
  if (wantsPending) {
    if (!canCreateARFOrPRF(ps, parsed.data.ministryId)) {
      return NextResponse.json(
        { error: "Only ministry heads can submit for approval" },
        { status: 403 }
      );
    }
  } else {
    if (!canCreateDraftARFOrPRF(ps, parsed.data.ministryId)) {
      return NextResponse.json(
        { error: "You can only create drafts for your ministries" },
        { status: 403 }
      );
    }
  }

  const status = wantsPending ? "pending" : "draft";

  const arf = await prisma.aRF.create({
    data: {
      ministryId: parsed.data.ministryId,
      eventName: parsed.data.eventName,
      requestedDate: parsed.data.requestedDate,
      what: parsed.data.what,
      when: parsed.data.when,
      where: parsed.data.where,
      why: parsed.data.why,
      justification: parsed.data.justification,
      status,
      createdById: session.userId,
      updatedAt: new Date(),
    },
    include: { ministry: { select: { name: true } } },
  });

  // Notify admin + ministry members (exclude creator)
  const [adminIds, ministryMemberIds] = await Promise.all([
    getAdminUserIds(),
    getMinistryMemberIds(arf.ministryId),
  ]);
  const recipientIds = [...new Set([...adminIds, ...ministryMemberIds])].filter(
    (uid) => uid !== session.userId
  );
  if (recipientIds.length > 0) {
    await createNotificationsForUserIds(recipientIds, {
      type: "arf_created",
      title: "New ARF created",
      body: `${arf.eventName} (${arf.ministry.name})`,
      link: `/dashboard/forms/arf/${arf.id}`,
      ministryId: arf.ministryId,
    }).catch(() => {});
  }

  return NextResponse.json(arf);
}
```

- [ ] **Step 2: Update `app/api/forms/arf/[id]/route.ts`**

Apply the same sweep. Every handler (GET, PUT, DELETE if present) needs:

- Import `canApproveARFOrPRF`, `PermissionSession`
- Build `ps` from session
- Replace `roleSlug === "admin"` with `session.isAdmin`
- Replace `roleSlug === "ministry_head"` + ministry check with `canApproveARFOrPRF(ps, arf.ministryId)`
- Delete `RoleSlug` import

- [ ] **Step 3: Update `app/api/forms/arf/[id]/pdf/route.ts`**

Same sweep. PDF route only needs `canAccessForms` or a per-ministry `canCreateARFOrPRF` check depending on the existing logic.

- [ ] **Step 4: Update PRF routes identically**

`app/api/forms/prf/route.ts`, `[id]/route.ts`, `[id]/pdf/route.ts` — mirror the ARF changes. PRF uses the same helpers (`canCreateARFOrPRF`, `canApproveARFOrPRF`).

- [ ] **Step 5: Update the dashboard forms pages**

For each `app/(dashboard)/dashboard/forms/**/page.tsx`:

1. Compute `ps` from session
2. Add `if (!canAccessForms(ps)) redirect("/dashboard")` gate
3. Replace any `session.roleSlug` reads

Example pattern for a forms list page:

```tsx
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { canAccessForms, type PermissionSession } from "@/lib/permissions";

export default async function ArfListPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login?callbackUrl=/dashboard/forms/arf");
  const ps: PermissionSession = {
    isAdmin: session.isAdmin,
    ministryIds: session.ministryIds,
    headOfMinistryIds: session.headOfMinistryIds,
  };
  if (!canAccessForms(ps)) redirect("/dashboard");

  // ... rest of the page
}
```

- [ ] **Step 6: Update the feature client components**

`features/arf/ARFForm.tsx`, `features/arf/ARFTableClient.tsx`, `features/prf/PRFForm.tsx`, `features/prf/PRFTableClient.tsx`, and any shared components like `features/shared/FormDetailActions.tsx`. Client components typically receive permission-related props from the server page rather than reading `session` directly, so the changes here are usually just swapping `canEdit: boolean` prop inputs — the computation happens on the server side. Grep for `roleSlug` in `features/arf` and `features/prf` and fix each site.

- [ ] **Step 7: Type-check + lint**

```bash
npm run type-check && npm run lint
```

Expected: forms-related errors gone. Errors still present in lineup, prayers, settings, checklist, options.

- [ ] **Step 8: Prepare commit**

```
refactor(forms): update ARF/PRF routes and pages for new session shape

Every call site replaces (roleSlug, ministryIds, ministryId) helper
calls with (permissionSession, ministryId). Draft creation now requires
the user to be a member of the target ministry (was: any user). Pending
submission requires head of the target ministry (was: any ministry_head).
```

Stop for user review.

---

## Task 15: Call-site sweep — Lineup

**Files:**

- Modify: `app/api/lineup/route.ts`
- Modify: `app/api/lineup/[id]/route.ts`
- Modify: `app/api/lineup/[id]/chat/route.ts`
- Modify: `app/api/lineup/[id]/instruments/route.ts`
- Modify: `app/api/lineup/[id]/singers/route.ts`
- Modify: `app/(dashboard)/dashboard/lineup/**/page.tsx`
- Modify: `features/lineup/**/*.tsx`

- [ ] **Step 1: Apply the sweep pattern from Task 14 to every lineup route**

Same substitutions:

- Build `ps` from session at the top of each handler
- `canCreateLineup(roleSlug, ministryIds, musicId)` → `canCreateLineup(ps, musicId)`
- `canApproveLineup(roleSlug)` → `canApproveLineup(ps, musicId)` — **note: signature changed**; it now requires the Music ministry id
- `canSeeDraftLineup(roleSlug, createdById, userId)` → `canSeeDraftLineup(ps, createdById, userId)`
- `session.roleSlug === "admin"` → `session.isAdmin`

For routes that need the Music ministry id, fetch it via `getMusicMinistryId()` — if no such helper exists, use:

```ts
const musicMinistry = await prisma.ministry.findUnique({
  where: { slug: "music" },
  select: { id: true },
});
if (!musicMinistry) {
  return NextResponse.json({ error: "Music ministry not found" }, { status: 500 });
}
```

Or (recommended): add a helper to `lib/checklist.ts` or a new `lib/ministries.ts`:

```ts
export async function getMusicMinistryId(): Promise<string | null> {
  const m = await prisma.ministry.findUnique({
    where: { slug: "music" },
    select: { id: true },
  });
  return m?.id ?? null;
}
```

Place next to `getMultimediaMinistryId` in `lib/checklist.ts` (or move both to `lib/ministries.ts` if you prefer a cleaner namespace — minor refactor, not required).

- [ ] **Step 2: Update lineup dashboard pages**

`app/(dashboard)/dashboard/lineup/page.tsx` + any sub-pages. `canAccessLineup()` is now a 0-arg function that always returns true, so the gate is trivial — you can even delete the gate entirely since the dashboard layout already ensures the user is authenticated. Keep the existing gate style consistent with other pages for clarity.

Update any `session.roleSlug` reads in page bodies (e.g., showing different content to admins).

- [ ] **Step 3: Update lineup client components**

`features/lineup/LineupForm.tsx`, `LineupTableClient.tsx`, `LineupDetailClient.tsx`, `LineupAssignmentsClient.tsx`, etc. Grep for `roleSlug` in `features/lineup` and fix each site.

- [ ] **Step 4: Type-check + lint**

```bash
npm run type-check && npm run lint
```

- [ ] **Step 5: Prepare commit**

```
refactor(lineup): update lineup routes and components for new session shape

All call sites switched to PermissionSession helpers. canApproveLineup
now takes the Music ministry id explicitly. canSeeDraftLineup simplified
to admin + creator check.
```

Stop for user review.

---

## Task 16: Call-site sweep — Prayers

**Files:**

- Modify: `app/api/prayers/route.ts`
- Modify: `app/api/prayers/[id]/route.ts`
- Modify: `app/(dashboard)/dashboard/prayers/**/page.tsx`
- Modify: `features/prayer/**/*.tsx`

- [ ] **Step 1: Apply sweep to prayer routes**

The prayer helpers have the most intricate signatures. Pattern:

```ts
import { canManagePrayer, canViewAllPrayers, type PermissionSession } from "@/lib/permissions";

// Need the Parakletos ministry id
const parakletosMinistry = await prisma.ministry.findUnique({
  where: { slug: "parakletos" },
  select: { id: true },
});
if (!parakletosMinistry) {
  return NextResponse.json({ error: "Parakletos ministry not found" }, { status: 500 });
}

const ps: PermissionSession = {
  isAdmin: session.isAdmin,
  ministryIds: session.ministryIds,
  headOfMinistryIds: session.headOfMinistryIds,
};

const caps = canManagePrayer(ps, parakletosMinistry.id, prayer.createdById, session.userId);
if (!caps.canView) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
// Later: if (!caps.canEdit) → reject edit; if (!caps.canSetStatus) → reject status change
```

Delete the old `isParakletosMinistryHead` / `isParakletosMember` imports — those are no longer exported from `lib/permissions.ts`.

Consider adding a `getParakletosMinistryId()` helper alongside `getMultimediaMinistryId` for consistency.

- [ ] **Step 2: Update prayer dashboard pages**

`app/(dashboard)/dashboard/prayers/**/page.tsx` — compute `ps`, fetch parakletos id, gate with `canAccessPrayers()` (trivial — returns true) or `canViewAllPrayers(ps, parakletosId)` depending on which page view.

- [ ] **Step 3: Update prayer client components**

`features/prayer/PrayerForm.tsx`, `PrayerTableClient.tsx`, `PrayerDetailActions.tsx` — grep for `roleSlug` and fix.

- [ ] **Step 4: Type-check + lint**

```bash
npm run type-check && npm run lint
```

- [ ] **Step 5: Prepare commit**

```
refactor(prayers): update prayer routes and components for new session shape

All call sites switched to PermissionSession helpers. canManagePrayer
returns the same capability object shape as before; call sites destructure
the same {canView, canEdit, canDelete, canSetStatus} properties.
```

Stop for user review.

---

## Task 17: Call-site sweep — Checklist (11 files from previous feature)

**Files:**

- Modify: `app/api/checklist/items/[itemId]/check/route.ts`
- Modify: `app/api/checklist/items/route.ts`
- Modify: `app/api/checklist/items/[itemId]/route.ts`
- Modify: `app/api/checklist/categories/route.ts`
- Modify: `app/api/checklist/categories/[id]/route.ts`
- Modify: `app/api/checklist/runs/start/route.ts`
- Modify: `app/api/checklist/runs/close/route.ts`
- Modify: `app/api/checklist/runs/route.ts`
- Modify: `app/api/checklist/runs/[id]/route.ts`
- Modify: `app/api/checklist/stats/route.ts`
- Modify: `app/(dashboard)/dashboard/multimedia-checklist/page.tsx`
- Modify: `app/(dashboard)/dashboard/multimedia-checklist/template/page.tsx`
- Modify: `app/(dashboard)/dashboard/multimedia-checklist/history/page.tsx`
- Modify: `app/(dashboard)/dashboard/multimedia-checklist/history/[runId]/page.tsx`

- [ ] **Step 1: Apply the sweep to every checklist route**

Every route currently reads:

```ts
const roleSlug = (session.roleSlug ?? "user") as RoleSlug;
const ministryIds = session.ministryIds ?? [];
// ... then
if (!canEditChecklistTemplate(roleSlug, ministryIds, multimediaMinistryId)) {
```

Change to:

```ts
const ps: PermissionSession = {
  isAdmin: session.isAdmin,
  ministryIds: session.ministryIds,
  headOfMinistryIds: session.headOfMinistryIds,
};
// ... then
if (!canEditChecklistTemplate(ps, multimediaMinistryId)) {
```

Delete the `RoleSlug` import from every file.

The `canViewChecklistHistory`, `canToggleChecklistItem`, `canEditChecklistTemplate`, `canManageChecklistRuns` helpers all now take `(ps, multimediaMinistryId)`.

- [ ] **Step 2: Update `/api/checklist/current/route.ts`**

This one is the public endpoint — it doesn't read session at all. **No changes needed.** Verify: grep for `roleSlug` in `app/api/checklist/current/route.ts` — expect zero hits.

- [ ] **Step 3: Update the checklist dashboard pages**

`app/(dashboard)/dashboard/multimedia-checklist/page.tsx`, `template/page.tsx`, `history/page.tsx`, `history/[runId]/page.tsx`. Each computes `ps` and uses the new helper signatures. The `canManage` computation for the landing page:

```ts
// Old
const canManage =
  roleSlug === "admin" ||
  (roleSlug === "ministry_head" && ministryIds.includes(multimediaMinistryId));

// New — replaced with the helper
const canManage = canManageChecklistRuns(ps, multimediaMinistryId);
```

(It becomes just `isMinistryHead` under the hood — which is exactly what the old expression computed, but the helper names the intent.)

- [ ] **Step 4: Type-check + lint**

```bash
npm run type-check && npm run lint
```

- [ ] **Step 5: Prepare commit**

```
refactor(checklist): update routes and pages for new session shape

All 10+ checklist routes and 4 dashboard pages switch from the old
(roleSlug, ministryIds, multimediaId) helper signature to the new
(permissionSession, multimediaId) signature. No runtime behavior change
for checklist feature itself — same permissions, cleaner call sites.
```

Stop for user review.

---

## Task 18: Call-site sweep — Settings, Options, Search, Notifications, Navbar, misc

**Files:**

- Modify: `app/api/settings/ministries/route.ts`
- Modify: `app/api/settings/instruments/route.ts`
- Modify: `app/api/settings/singer-roles/route.ts`
- Modify: `app/api/options/ministries/route.ts`
- Modify: `app/api/options/users/route.ts`
- Modify: `app/api/search/route.ts`
- Modify: `app/api/notifications/read/route.ts`
- Modify: `app/api/profile/route.ts` (if it reads roleSlug)
- Modify: `app/(dashboard)/dashboard/settings/**/page.tsx`
- Modify: `app/(dashboard)/dashboard/calendar/page.tsx`
- Modify: `app/(dashboard)/dashboard/notifications/page.tsx`
- Modify: `app/(dashboard)/dashboard/reports/page.tsx` (add admin gate)
- Modify: `app/(dashboard)/dashboard/profile/page.tsx`
- Modify: `components/layout/Navbar.tsx`

- [ ] **Step 1: Settings routes — tighten to admin-only**

Each of `app/api/settings/ministries/route.ts`, `instruments/route.ts`, `singer-roles/route.ts` currently uses `canManageMinistry` or `canManageInstrumentsAndSingers`. Under the new model both return `s.isAdmin` — no behavior change for admin, but ministry heads who had access before now don't.

Apply the sweep:

```ts
import { canAccessSettings, type PermissionSession } from "@/lib/permissions";

const ps: PermissionSession = {
  isAdmin: session.isAdmin,
  ministryIds: session.ministryIds,
  headOfMinistryIds: session.headOfMinistryIds,
};
if (!canAccessSettings(ps)) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

- [ ] **Step 2: Options routes**

`app/api/options/ministries/route.ts`, `options/users/route.ts`:

- Both require authenticated session
- `options/ministries` returns active ministries — no permission check beyond auth
- `options/users` returns users for dropdowns — admin sees all; ministry heads see members of their ministries. Apply scoping similar to `GET /api/users`.

- [ ] **Step 3: Delete `app/api/options/roles/route.ts`**

Verify nothing still imports it:

```bash
grep -r "options/roles" app/ features/ components/ lib/
```

Expected: zero hits. If there are hits, fix those call sites (they're stale references to the old "pick a role at signup" flow). Then delete the file:

```bash
rm app/api/options/roles/route.ts
```

- [ ] **Step 4: Search + notifications + profile**

- `app/api/search/route.ts` — scoping stays the same (ministryIds-based), just session shape update
- `app/api/notifications/read/route.ts` — no permission changes, just session shape if it reads roleSlug (grep to confirm)
- `app/api/profile/route.ts` — self-edit, no role check changes (but still update session shape reads if any)

- [ ] **Step 5: Dashboard pages — add gates + sweep**

- `dashboard/settings/**/page.tsx` — add `canAccessSettings` gate
- `dashboard/calendar/page.tsx` — no gate needed (public within dashboard), just session shape
- `dashboard/notifications/page.tsx` — no gate, session shape
- `dashboard/reports/page.tsx` — add `canAccessReports` gate (admin only)
- `dashboard/profile/page.tsx` — no gate, session shape

- [ ] **Step 6: Navbar**

`components/layout/Navbar.tsx` — if it reads `session.roleSlug` anywhere (e.g., to show admin-specific links), swap to `session.isAdmin`. The existing sign-out button, notification bell, and search modal do not depend on roles, so changes are minimal.

- [ ] **Step 7: Final grep for stragglers**

```bash
grep -rn "roleSlug" app/ features/ components/ lib/ services/
```

Expected: zero hits outside of `lib/auth.ts` module augmentation (which explicitly does NOT declare `roleSlug` anymore). If any results come back, fix those files — they're the last stragglers.

Also:

```bash
grep -rn "RoleSlug" app/ features/ components/ lib/ services/
```

Expected: zero hits. `RoleSlug` type export was deleted in Task 3.

```bash
grep -rn "ministry_head" app/ features/ components/ lib/ services/
```

Expected: zero hits in TypeScript files. The only matches should be in the Prisma schema or migrations (unrelated historical rows). Any TS file still using the string `"ministry_head"` is a bug.

- [ ] **Step 8: Type-check + lint + format**

```bash
npm run check
```

Expected: **zero errors across type-check, lint, and format:check.** This is the big moment where the mechanical sweep is complete.

If errors remain, they're stragglers in files not on the sweep list. Grep, fix, re-run.

- [ ] **Step 9: Prepare commit**

```
refactor(sweep): complete session-shape migration across all routes and pages

- Settings routes tighten to admin-only (canAccessSettings)
- Options/search/notifications routes switch to new session shape
- Dashboard pages (settings, reports, calendar, notifications, profile)
  add explicit route gates
- Navbar session reads updated
- Delete app/api/options/roles/route.ts (dead)
- Final grep confirms zero roleSlug/RoleSlug/"ministry_head" stragglers
- npm run check passes clean
```

Stop for user review.

---

## Task 19: Dead-code sweep + final cleanup

**Files:**

- Various (depends on what grep finds)

- [ ] **Step 1: Delete any remaining references to the old Role table**

Grep:

```bash
grep -rn "prisma\.role\|prisma\.permission\|prisma\.rolePermission" app/ features/ components/ lib/ services/ schemas/ prisma/
```

Expected: zero hits. If any remain, delete those call sites — they're broken by the schema change.

- [ ] **Step 2: Delete unused imports from seed**

Open `lib/db/seed.ts` once more. Confirm no imports or variables are leftover from the deleted roles/permissions seeding.

- [ ] **Step 3: Check for unused helper exports**

Grep for each removed helper:

```bash
grep -rn "isParakletosMinistryHead\|isParakletosMember" app/ features/ components/ lib/ services/
```

These were internal prayer helpers — ensure they're truly unused now that the prayer helpers were rewritten. Zero hits expected.

- [ ] **Step 4: Run full `npm run check` again**

```bash
npm run check
```

Expected: clean.

- [ ] **Step 5: Run fresh seed one more time to confirm nothing broke along the way**

```bash
npm run db:seed
```

Expected: success, admin user created, ministries seeded, checklist template seeded.

- [ ] **Step 6: Prepare commit (if anything changed)**

If Steps 1–3 found stragglers and you deleted them, prepare a commit:

```
chore: delete dead references to old Role model

Final sweep removes any stale imports, helpers, or variables referencing
the dropped Role/Permission/RolePermission tables.
```

If nothing changed, skip the commit step.

Stop for user review.

---

## Task 20: Final verification — the manual dry-run

**Files:**

- None modified — this is a verification gate.

Per spec §11.2, execute every manual step in order and produce a final status report.

- [ ] **Step 1: Clean slate**

```bash
PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="Final verification reset" npx prisma migrate reset --force --skip-seed
npm run db:seed
```

Confirm: admin user created with `isAdmin: true`, `status: "active"`, 12 ministries seeded, Multimedia checklist starter template present.

- [ ] **Step 2: Start dev server in background**

```bash
npm run dev
```

Use `run_in_background: true` on the Bash tool call. Poll until ready:

```bash
for i in 1 2 3 4 5 6 7 8 9 10; do code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null); if [ "$code" != "000" ]; then echo "up after ${i}s: HTTP $code"; break; fi; sleep 1; done
```

- [ ] **Step 3: Walkthrough — admin login**

Browser: http://localhost:3000/login. Sign in as admin (email/password from `.env`). Verify dashboard loads, sidebar shows admin nav items (Users, Reports, Settings, etc.), not routed to /pending.

- [ ] **Step 4: Walkthrough — signup flow**

1. Open incognito window → http://localhost:3000/signup
2. Fill in name, email, password, confirm password
3. Pick 2 ministries (e.g., Multimedia + Yaps)
4. Submit
5. Verify success screen appears: "Thanks for signing up..."
6. Attempt to sign in with the new credentials
7. Verify redirect to `/pending`
8. Verify sign-out button works and returns to `/login`

- [ ] **Step 5: Walkthrough — admin approval**

1. In the admin tab, check the notification bell — expect a "New signup awaiting approval" entry
2. Navigate to `/dashboard/users?tab=pending`
3. Expect the pending user row with their requested ministries displayed as chips
4. Click **Approve** — inline panel expands with ministries pre-checked
5. Uncheck Yaps, keep Multimedia only
6. Click **Confirm approve** — row disappears from Pending, badge decrements

- [ ] **Step 6: Walkthrough — approved user signs in**

1. Back to the incognito tab, sign in with the approved user
2. Expect redirect to `/dashboard` (not `/pending`)
3. Sidebar: Multimedia Checklist entry visible; Forms/Users/Settings entries **NOT** visible (they're not a head yet)
4. Navigate to `/checklist` — should be able to tap checkboxes (Multimedia member)
5. Navigate to `/dashboard/multimedia-checklist` — should see the read-only landing (no Start/Close buttons because they're not a head)

- [ ] **Step 7: Walkthrough — admin promotes to head**

1. As admin, navigate to `/dashboard/users`, open the approved user's edit form
2. In the Ministries section, toggle **Head** on for Multimedia
3. Save
4. (Optional) Reload the non-admin tab without signing out — session rehydration should pick up the new head role
5. Navigate to `/dashboard/multimedia-checklist/template` — should now be accessible

- [ ] **Step 8: Walkthrough — per-ministry scoping**

1. As admin, create another user directly via `POST /api/users` (or via the admin UI if wired) with ministries Multimedia + Yaps
2. Make that user head of Multimedia but member of Yaps
3. Have them log in
4. Verify they can edit Multimedia checklist template
5. Verify they cannot access Yaps admin actions (if any exist for Yaps)

- [ ] **Step 9: Walkthrough — ministry head UX in users panel**

1. Sign in as the head user from Step 7
2. Navigate to `/dashboard/users`
3. Verify: only users sharing a Multimedia membership are visible
4. Verify: Pending tab is **hidden** (ministry heads can't approve)
5. Click a user to edit: verify basic info fields are disabled, Ministries section shows only Multimedia, no isAdmin checkbox, no status dropdown

- [ ] **Step 10: Walkthrough — reject flow**

1. Sign out, create another pending signup
2. As admin, click **Reject** in the Pending tab
3. Confirmation prompt appears; click OK
4. Verify row disappears, pending count decrements
5. Sign up again with the same email — should succeed (re-registration allowed)

- [ ] **Step 11: Walkthrough — deactivate flow**

1. As admin, deactivate the approved user (via edit form Status dropdown → Inactive)
2. Save
3. Try to sign in as that user — should fail with "Your account has been deactivated. Contact your admin." on the login form (via `?error=inactive` query param)
4. As admin, reactivate them
5. Verify they can sign in again

- [ ] **Step 12: Walkthrough — session rehydration**

With a non-admin active user signed in:

1. As admin, change their role from head to member in Multimedia
2. Without the affected user re-signing in, have them navigate to `/dashboard/multimedia-checklist/template` — verify they're now redirected/blocked (session rehydration took effect)

- [ ] **Step 13: Walkthrough — permission gates (negative tests)**

Sign in as a plain-member user. Direct-navigate to:

- `/dashboard/users` → redirects to `/dashboard`
- `/dashboard/settings` → redirects to `/dashboard`
- `/dashboard/reports` → redirects to `/dashboard`
- `/dashboard/multimedia-checklist/template` → redirects to `/dashboard/multimedia-checklist` (if they're a Multimedia member but not a head)

- [ ] **Step 14: Walkthrough — sidebar visibility**

Verify sidebar entries for each role type:

- **Admin**: sees Dashboard, Forms, Music Lineup, Multimedia Checklist (if applicable), Calendar, Prayers, Notifications, Users, Reports, System Settings
- **Ministry head (any ministry)**: sees Dashboard, Forms, Music Lineup, Calendar, Prayers, Notifications, Users (without Pending tab)
- **Plain member**: sees Dashboard, Music Lineup, Calendar, Prayers, Notifications (no Forms, Users, Settings)
- **Multimedia member (not head)**: additionally sees Multimedia Checklist

- [ ] **Step 15: Stop the dev server**

Use TaskStop on the background Bash task ID from Step 2.

- [ ] **Step 16: Produce the final report**

Write a short report listing every step that passed and every step that failed (with observations). If any step fails, create a follow-up task; do not mark the plan complete.

- [ ] **Step 17: Run the full automated check one last time**

```bash
npm run check
```

Expected: zero errors.

- [ ] **Step 18: Prepare final verification commit (if anything was tweaked during the walkthrough)**

```
chore(verify): final fixups from user roles rework dry-run
```

Only needed if something was fixed during the walkthrough. Otherwise report "No changes from verification" and stop.

---

## Self-review checklist (for the executing agent)

Before declaring the plan complete:

- [ ] Every section of the spec is covered (§3 data → Task 1; §4 auth → Task 2; §5 permissions → Task 3; §6 users panel → Tasks 10–13; §7 signup → Task 7; §8 sidebar → Task 6; §9 notifications → Task 4; §10 call-site sweep → Tasks 14–18; §11 verification → Task 20)
- [ ] No placeholders in any code block
- [ ] All helper names consistent across tasks: `canAccessUsers`, `canAccessForms`, `canAccessSettings`, `canAccessReports`, `canAccessPrayers`, `canCreateDraftARFOrPRF`, `canCreateARFOrPRF`, `canApproveARFOrPRF`, `canCreateLineup`, `canApproveLineup`, `canSeeDraftLineup`, `canManagePrayer`, `canViewAllPrayers`, `canViewChecklistHistory`, `canToggleChecklistItem`, `canEditChecklistTemplate`, `canManageChecklistRuns`, `isMinistryHead`, `isMinistryMember`, `canManageMinistry`, `canManageInstrumentsAndSingers`
- [ ] Session shape consistent: `session.isAdmin`, `session.status`, `session.ministryIds`, `session.headOfMinistryIds`, `session.userId`
- [ ] `PermissionSession` interface consistent (isAdmin, ministryIds, headOfMinistryIds — no extras)
- [ ] Every commit step says "stop for user review" — no task runs `git commit` directly
