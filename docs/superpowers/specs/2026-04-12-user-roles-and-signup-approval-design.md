# User Roles & Signup Approval — Design Spec

**Date:** 2026-04-12
**Status:** Approved in brainstorming, pending implementation plan
**Scope:** End-to-end rework of the user/role model, signup flow, and admin approval workflow. Touches data model, authentication, session shape, every permission helper, every API route that reads `session.roleSlug`, the sidebar, and the users panel UI.

---

## 1. Goal

Three interlocking problems to solve, shipped as one cohesive change:

1. **Per-ministry roles.** Today, if Joshua is marked as `ministry_head`, he's automatically head of _every_ ministry he belongs to. He should be able to be head of Multimedia but a plain member in Yaps. Roles must live per-ministry-membership, not globally on the user.

2. **Multi-ministry signup.** New users should be able to pick multiple ministries at signup, not just one primary.

3. **Admin approval workflow.** Signups should land in a `pending` state. Admin reviews the users panel, confirms (or rejects) each signup before the account becomes usable.

**Why together:** (2) and (3) both depend on the data model in (1). Shipping them in stages means rewriting the same files twice.

---

## 2. Decisions locked during brainstorming

| Decision                                 | Choice                                                                                                                                                                                                                     |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin as a concept                       | Global `User.isAdmin: boolean` — **not** a per-ministry role. Admin bypasses all ministry scoping.                                                                                                                         |
| Role table                               | Dropped entirely. `Role`, `Permission`, `RolePermission` tables all removed (no runtime code reads `Permission`/`RolePermission`; `Role` is only read via the old session).                                                |
| Per-ministry role storage                | New Prisma enum `MinistryRole { head, member }` as a column on `UserMinistry`.                                                                                                                                             |
| Heads per ministry                       | Multiple heads allowed (no unique constraint on `(ministryId, role)`).                                                                                                                                                     |
| Pending login UX                         | Pending users **authenticate successfully** and are routed to a dedicated `/pending` screen; dashboard layout rejects them.                                                                                                |
| Who can approve                          | Admin only. Ministry heads cannot approve signups (v1).                                                                                                                                                                    |
| Reject behavior                          | Hard-delete the user row. Re-registration with the same email is allowed.                                                                                                                                                  |
| Where admin sees pending users           | New "Pending" tab on `/dashboard/users`, with inline approve/reject buttons.                                                                                                                                               |
| Signup notifications                     | In-app bell notification to all admins on new signup. No email (SendGrid skipped for v1). No notification on approve/reject.                                                                                               |
| Existing user migration                  | None — clean `prisma migrate reset` + reseed. No production data to preserve.                                                                                                                                              |
| Session shape                            | Split arrays: `isAdmin` + `status` + `ministryIds[]` (all memberships) + `headOfMinistryIds[]` (subset).                                                                                                                   |
| Session rehydration                      | JWT callback re-reads user state from DB on every invocation so role/status changes propagate immediately (no re-login required). Cost: one Prisma query per server request resolving a session. Acceptable at this scale. |
| Signup ministry picker                   | Required. User must pick at least one ministry. Admin can adjust during approve.                                                                                                                                           |
| Ministry promotion                       | Happens in the user edit form after approval, not during approval. Approve only flips status to `active`.                                                                                                                  |
| Head-edit scoping                        | Ministry heads editing users are restricted to their own ministries: cannot edit basic info, cannot touch ministries they don't head, cannot toggle `isAdmin`, cannot change `status`.                                     |
| System Settings access                   | Tightened to admin-only (was admin + ministry_head under old model).                                                                                                                                                       |
| Notifications for pending/inactive users | Suppressed — recipient helpers filter on `status = "active"`.                                                                                                                                                              |

### Assumptions flagged

- **Single admin flag is sufficient.** No "sub-admin" or "super-admin" distinction. If a tier system is ever needed, a tiered `AdminLevel` enum is a straightforward later migration.
- **Ministry heads managing users is a per-ministry scope**, not a global "I can manage anyone". The scoping rules in §6.7 encode this.
- **No email notifications in v1.** The notification bell is the only channel. Email deliverability, opt-out, and production config are a separate project.

---

## 3. Data model

### 3.1 Schema diff

```prisma
// REMOVED entirely (dropped tables)
// model Role { ... }
// model Permission { ... }
// model RolePermission { ... }

// NEW
enum MinistryRole {
  head
  member
}

enum UserStatus {
  pending
  active
  inactive
}

model User {
  id              String     @id @default(cuid())
  email           String     @unique
  hashedPassword  String
  name            String
  address         String?
  age             Int?
  birthday        DateTime?
  status          UserStatus @default(pending)   // default changes from "active" string → pending enum
  isAdmin         Boolean    @default(false)     // NEW, replaces roleId
  resetToken      String?
  resetTokenExp   DateTime?
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt

  // DROPPED columns:
  //   roleId        String   (FK to Role)
  //   ministryId    String?  (primary ministry — single source of truth is now UserMinistry)

  // DROPPED relation:
  //   role          Role

  userMinistries  UserMinistry[]
  arfsCreated     ARF[]               @relation("ARFCreatedBy")
  prfsCreated     PRF[]               @relation("PRFCreatedBy")
  approvalHistory ApprovalHistory[]
  lineupsCreated  Lineup[]            @relation("LineupCreatedBy")
  instrumentAssignments InstrumentAssignment[]
  singerAssignments     SingerAssignment[]
  chatMessages    ChatMessage[]
  notifications   Notification[]
  prayersCreated  Prayer[]            @relation("PrayerCreatedBy")
  checklistRunsStarted  ChecklistRun[] @relation("ChecklistRunStartedBy")
  checklistRunsClosed   ChecklistRun[] @relation("ChecklistRunClosedBy")
  itemChecks            ItemCheck[]    @relation("ItemChecksBy")
}

model Ministry {
  id             String @id @default(cuid())
  name           String
  slug           String @unique
  description    String?
  active         Boolean @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  // DROPPED relation: users User[] (backref of User.ministryId, which no longer exists)

  userMinistries    UserMinistry[]
  arfs              ARF[]
  prfs              PRF[]
  lineups           Lineup[]
  prayers           Prayer[]
  checklistTemplate ChecklistTemplate?
}

model UserMinistry {
  userId     String
  ministryId String
  role       MinistryRole @default(member)  // NEW
  createdAt  DateTime     @default(now())
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  ministry   Ministry @relation(fields: [ministryId], references: [id], onDelete: Cascade)

  @@id([userId, ministryId])
  @@index([ministryId, role])   // NEW — fast "all heads of ministry X" queries
}
```

### 3.2 Migration path

Because there are no production users yet:

1. `prisma migrate reset --force --skip-seed` drops everything
2. Fresh migration with the new schema (name: `user_roles_rework`)
3. `npm run db:seed` recreates:
   - Seed ministries (unchanged — from `lib/db/seed.ts`)
   - Seed admin user with `isAdmin: true`, `status: "active"`, no ministry memberships
   - Multimedia checklist starter template (from the previous feature; unchanged)
4. No data migration script, no backfill, no compatibility shim

### 3.3 What does NOT change

`ARF`, `PRF`, `Lineup`, `Prayer`, `ChecklistRun`, `ItemCheck`, `Notification`, `Reminder`, `ApprovalHistory`, `ChatMessage`, `Instrument`, `InstrumentAssignment`, `SingerRole`, `SingerAssignment`, `ChecklistTemplate`, `ChecklistCategory`, `ChecklistItem`, `EmailTemplate` — all untouched.

---

## 4. Authentication & session

### 4.1 `lib/auth.ts` — the NextAuth config

**`authorize` callback:**

```ts
async authorize(credentials) {
  if (!credentials?.email || !credentials?.password) return null;

  const user = await prisma.user.findUnique({
    where: { email: credentials.email },
    include: {
      userMinistries: { select: { ministryId: true, role: true } },
    },
  });
  if (!user) return null;

  const valid = await bcrypt.compare(credentials.password, user.hashedPassword);
  if (!valid) return null;

  // Inactive users are rejected at this layer. Pending users are allowed
  // through so the dashboard layout can redirect them to /pending with a
  // clear message (better UX than a generic "invalid credentials").
  if (user.status === "inactive") return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    isAdmin: user.isAdmin,
    status: user.status,
    ministryIds: user.userMinistries.map((um) => um.ministryId),
    headOfMinistryIds: user.userMinistries
      .filter((um) => um.role === "head")
      .map((um) => um.ministryId),
  };
}
```

**`jwt` callback — rehydrates from DB on every invocation:**

```ts
async jwt({ token, user }) {
  if (user) {
    // Initial login
    token.userId = user.id;
    token.isAdmin = user.isAdmin;
    token.status = user.status;
    token.ministryIds = user.ministryIds;
    token.headOfMinistryIds = user.headOfMinistryIds;
    return token;
  }
  // Subsequent requests — re-read fresh state so role/status changes
  // propagate immediately. Cost: one findUnique per server request.
  if (token.userId) {
    const fresh = await prisma.user.findUnique({
      where: { id: token.userId },
      select: {
        isAdmin: true,
        status: true,
        userMinistries: { select: { ministryId: true, role: true } },
      },
    });
    if (!fresh) return {}; // user deleted — invalidate the token
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

**`session` callback:**

```ts
async session({ session, token }) {
  if (session.user && token.userId) {
    (session.user as { id?: string }).id = token.userId;
    session.userId = token.userId;
    session.isAdmin = token.isAdmin;
    session.status = token.status;
    session.ministryIds = token.ministryIds ?? [];
    session.headOfMinistryIds = token.headOfMinistryIds ?? [];
  }
  return session;
},
```

**Module augmentation:**

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

Removed: `roleId`, `roleSlug`, `ministryId` on session/JWT. Added: `isAdmin`, `status`, `headOfMinistryIds`.

### 4.2 Dashboard layout gate

`app/(dashboard)/layout.tsx` gets a status-aware redirect block:

```ts
const session = await getServerSession(authOptions);
if (!session?.userId) redirect("/login?callbackUrl=/dashboard");
if (session.status === "pending") redirect("/pending");
if (session.status === "inactive") redirect("/login?error=inactive");
```

### 4.3 Login page polish

- New query-param error handling: `?error=inactive` shows `"Your account has been deactivated. Contact your admin."`, `?error=rejected` shows `"Your signup was rejected. You can sign up again or contact your admin."`
- Already-authenticated redirect logic checks `session.status`: `pending → /pending`, `active → /dashboard`

---

## 5. Permission helpers

### 5.1 New shape — helpers take a session-like object

`lib/permissions.ts` is rewritten. Every helper takes a `PermissionSession` (a slim subset of `Session` for ease of testing and unambiguous typing):

```ts
export interface PermissionSession {
  isAdmin: boolean;
  ministryIds: string[];
  headOfMinistryIds: string[];
}
```

### 5.2 Primitives

```ts
/** Head of this specific ministry (or admin). */
export function isMinistryHead(s: PermissionSession, ministryId: string): boolean {
  return s.isAdmin || s.headOfMinistryIds.includes(ministryId);
}

/** Member (head or plain member) of this ministry (or admin). */
export function isMinistryMember(s: PermissionSession, ministryId: string): boolean {
  return s.isAdmin || s.ministryIds.includes(ministryId);
}
```

### 5.3 Feature helpers (full list)

```ts
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
  return true; // everyone can view the prayers list; per-prayer access is gated by canManagePrayer
}

// --- Settings management (admin-only surface) ---
export function canManageInstrumentsAndSingers(s: PermissionSession): boolean {
  return s.isAdmin; // tightened from "admin + ministry_head" under the old global-role model
}
export function canManageMinistry(s: PermissionSession): boolean {
  return s.isAdmin; // tightened: settings page is admin-only
}

// --- ARF/PRF (per-ministry) ---
/** Members of the target ministry can create drafts for that ministry (or admin). */
export function canCreateDraftARFOrPRF(s: PermissionSession, targetMinistryId: string): boolean {
  return isMinistryMember(s, targetMinistryId);
}
/** Only heads of the target ministry can create a request in "pending" state ready for approval. */
export function canCreateARFOrPRF(s: PermissionSession, targetMinistryId: string): boolean {
  return isMinistryHead(s, targetMinistryId);
}
export function canApproveARFOrPRF(s: PermissionSession, targetMinistryId: string): boolean {
  return isMinistryHead(s, targetMinistryId);
}

// --- Lineup ---
export function canAccessLineup(): boolean {
  return true;
}
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
  if (s.isAdmin) return { canView: true, canEdit: true, canDelete: true, canSetStatus: true };
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

// --- Checklist ---
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

### 5.4 Behavior changes worth naming

- **`canCreateARFOrPRF` is now per-ministry.** A ministry head can only create requests for ministries they head, not for ministries where they're a plain member. Matches the spec's intent; tightening from today's "any ministry_head can create ARFs for any ministry they're in".
- **`canCreateDraftARFOrPRF` tightens from "everyone" to "members of the target ministry".** Previously any logged-in user could create a draft ARF/PRF for any ministry. Under the new model, drafts are scoped to ministries the user belongs to. This prevents a user in Yaps from drafting Music ARFs they have no context on.
- **`canAccessSettings`, `canManageInstrumentsAndSingers`, `canManageMinistry` all tighten to admin-only.** Previously `ministry_head` globally had access. Under the new model there's no global ministry-head, so system settings (ministries list, instruments, singer roles) is admin-only.
- **All checklist helpers now use `isMinistryHead(s, multimediaMinistryId)`** instead of the ad-hoc `ministryIds.includes(...) && roleSlug === "ministry_head"` pattern. Tighter and correct: a Multimedia _member_ can no longer edit the template just because they're in the ministry — only Multimedia _heads_ can.

### 5.5 Call-site pattern

Every API route changes from:

```ts
const roleSlug = (session.roleSlug ?? "user") as RoleSlug;
const ministryIds = session.ministryIds ?? [];
if (!canEditChecklistTemplate(roleSlug, ministryIds, multimediaMinistryId)) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

to:

```ts
if (!canEditChecklistTemplate(session, multimediaMinistryId)) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

The `RoleSlug` type export is deleted. The session _is_ the permission context.

---

## 6. Users panel & admin workflows

### 6.1 Access gates

- **Sidebar entry "Users":** visible when `canAccessUsers(session)` — admin OR at least one ministry head role
- **Route `/dashboard/users`:** server page redirects to `/dashboard` if not allowed

### 6.2 Tabbed layout

```
[ Active (27) ] [ Pending (3) ]
```

- **Active tab** — default, visible to admin + ministry heads. Lists users whose `status !== "pending"`. Scoping: admin sees all; ministry heads see users whose `userMinistries` intersect with their `headOfMinistryIds`.
- **Pending tab** — admin only. Hidden entirely for ministry heads. Badge shows count; hidden if zero.

### 6.3 Active tab columns

| Column             | Notes                                                                                                                         |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Name               | Clickable row → opens edit form                                                                                               |
| Email              | Plain text                                                                                                                    |
| Ministries + roles | Chip list. Heads get `· head` suffix or a filled cyan chip; members get an outline chip. Example: `Multimedia · head`, `Yaps` |
| Status             | `active` (no badge) or `inactive` (gray pill)                                                                                 |
| Actions            | Edit, Deactivate (if active) / Reactivate (if inactive). No delete in the row — only in the edit form.                        |

### 6.4 Pending tab columns (admin only)

| Column               | Notes                                  |
| -------------------- | -------------------------------------- |
| Name                 | Plain text                             |
| Email                | Plain text                             |
| Requested ministries | Chip list of what the applicant picked |
| Submitted            | Relative time                          |
| Actions              | Approve (green) / Reject (outline red) |

Empty state: "No pending signups."

### 6.5 Approve flow — inline confirmation panel

Clicking **Approve** expands an inline panel under the row:

```
Approving Joshua Dela Cruz
─────────────────────────
Assign to which ministries? (pre-checked from request)

  [✓] Multimedia
  [✓] Yaps
  [ ] Music
  [ ] Parakletos
  ...

Note: All assignments default to "member". You can promote to head
from the user's edit page after approval.

                       [ Cancel ]  [ Confirm approve ]
```

- Admin can add/remove ministries before confirming
- On confirm: `POST /api/users/[id]/approve { ministryIds }` — transaction deletes existing `UserMinistry` rows, inserts fresh ones with `role: "member"`, flips `status` to `active`
- Row fades out of Pending tab; `router.refresh()` reconciles badge counts and the Active tab if it's visible

### 6.6 Reject flow

Confirmation prompt:

> "Reject this signup? The user will be deleted. If they want to try again, they'll need to sign up from scratch."

On OK → `DELETE /api/users/[id]/reject` → row hard-deleted, pending count decrements.

### 6.7 Edit user form (`features/users/UserForm.tsx`)

**Basic info section:**

- Name, Email, Address, Age, Birthday
- Status dropdown (active / inactive) — admin only
- `isAdmin` checkbox — admin only

**Ministry memberships section:**

A list of the user's ministries, each row:

```
Multimedia   [● Head]  [× remove]
Yaps         [○ Head]  [× remove]
```

- `Head` toggle flips between `head` and `member`
- `× remove` drops the user from that ministry
- Below the list: `+ Add ministry` opens a picker of ministries not already in the list

**Scoping for ministry-head editors (not admin):**

| Field                               | Ministry head editor                                                      |
| ----------------------------------- | ------------------------------------------------------------------------- |
| Name, email, address, age, birthday | Read-only                                                                 |
| Status                              | Hidden                                                                    |
| `isAdmin` checkbox                  | Hidden                                                                    |
| Ministries list                     | Shows **only** ministries the editor heads (subset of user's memberships) |
| Head toggle on a row                | Allowed (editor heads that ministry)                                      |
| Remove button on a row              | Allowed (editor heads that ministry)                                      |
| + Add ministry picker               | Shows only ministries the editor heads AND the user isn't already in      |

**Admin editors see the full form unchanged.**

Server enforcement in `PUT /api/users/[id]` (see 6.8) rejects any payload from a ministry head that tries to touch fields outside their scope — the client restrictions are UX; the server is the guard.

### 6.8 Users API routes

| Method   | Path                      | Auth                       | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------- | ------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/api/users`              | `canAccessUsers`           | Query scoping: admin → all users; ministry head → users with at least one ministry intersecting `headOfMinistryIds`. Response shape adds `ministries: Array<{id, name, role}>` per user. Optional `?tab=pending` filter (admin only) returns pending users; `?tab=active` (default) returns non-pending.                                                                                                                                                                                                                                                                                                                                                                              |
| `POST`   | `/api/users`              | admin only                 | Create user directly (skips pending queue). Body: `{ name, email, password, isAdmin, ministryAssignments: [{ministryId, role}] }`. `status` is `active`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `GET`    | `/api/users/[id]`         | `canAccessUsers` + scoping | Returns user with `ministries` array. Scoping: admin → any user; ministry head → only users sharing at least one ministry with them.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `PUT`    | `/api/users/[id]`         | `canAccessUsers` + scoping | Body: `{ name?, email?, address?, age?, birthday?, isAdmin?, status?, ministryAssignments?: [{ministryId, role}] }`. Admin: all fields accepted. Ministry head: only `ministryAssignments` is accepted (all other fields silently dropped). The server computes the diff against the user's existing memberships and rejects with 403 if any added, removed, or role-changed ministry falls outside the editor's `headOfMinistryIds`. The `ministryAssignments` payload is treated as the **authoritative list for the subset of ministries in scope**: ministries the editor doesn't head are preserved unchanged from the existing user record regardless of what's in the payload. |
| `DELETE` | `/api/users/[id]`         | admin only                 | Hard-delete. Only reachable from the edit form (no row action).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `POST`   | `/api/users/[id]/approve` | admin only                 | New. Body: `{ ministryIds: string[] }`. Transactional: delete existing `UserMinistry` rows, insert new ones with `role: "member"`, flip `status` to `active`. 409 if user isn't pending.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `DELETE` | `/api/users/[id]/reject`  | admin only                 | New. Hard-delete pending user. 409 if user isn't pending.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

### 6.9 Deactivate / delete / reject — three distinct exits

| Action     | Who                       | Result                                                       | Recoverable?                                       |
| ---------- | ------------------------- | ------------------------------------------------------------ | -------------------------------------------------- |
| Reject     | Admin, pending users only | Hard-delete user row                                         | No — re-signup allowed                             |
| Deactivate | Admin, active users only  | `status = "inactive"`, row preserved, historical data intact | Yes — admin flips back                             |
| Delete     | Admin, any user           | Hard-delete row                                              | No — may fail if FK `onDelete: Restrict` blocks it |

Inactive users can't log in (NextAuth rejects at `authorize`). Their historical data (checks, lineups created, ARF creator, etc.) stays intact with their name attached.

**Note on hard-delete failures:** `ARF.createdBy`, `PRF.createdBy`, `Lineup.createdBy`, and `ItemCheck.checkedBy` all use `onDelete: Restrict`. Deleting a user who has authored any of those rows will fail with a Prisma `P2003` error. This is correct behavior — it protects against data loss. The UI must surface this clearly: if delete fails, show a toast like "This user has created records that reference them. Deactivate instead of deleting." Admins should use **Deactivate** for users who have any activity; **Delete** is reserved for users created by mistake with no data.

---

## 7. Signup flow

### 7.1 Signup page (`app/signup/page.tsx`)

**Removed:**

- Role dropdown

**Added:**

- Multi-select ministries (checkbox grid or chip-toggle list). At least one required. Fetched from `GET /api/options/ministries`.

**Unchanged:**

- Name, email, password, confirm password

**Submission:**

- `POST /api/auth/register` with `{ name, email, password, confirmPassword, ministryIds }`
- On success: show a success screen ("Thanks for signing up. An admin will review your request. You'll be able to sign in once approved.") with a link to `/login`. Does **not** auto-sign-in.

### 7.2 Signup schema (`schemas/user.ts`)

```ts
export const signupSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required"),
    email: z.string().email("Invalid email"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
    ministryIds: z.array(z.string().min(1)).min(1, "Pick at least one ministry"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
```

`roleId` and `ministryId` are removed from the signup schema entirely.

### 7.3 Register API (`app/api/auth/register/route.ts`)

Key changes from today:

- Validates `ministryIds` is non-empty and every id corresponds to a real ministry
- Creates user with `status: "pending"`, `isAdmin: false`
- Creates `UserMinistry` rows (nested create) with `role: "member"` for each selected ministry
- Sends an in-app notification to all admins (`getAdminUserIds`) via `createNotificationsForUserIds` with type `"user_signup_pending"`, title `"New signup awaiting approval"`, body with the applicant name, link to `/dashboard/users?tab=pending`
- Returns `{ ok: true }` without auto-auth

### 7.4 Pending approval page (`app/pending/page.tsx`)

New top-level route (not under `(dashboard)`). Accessible only to authenticated users whose `session.status === "pending"`. Redirects:

- `active` → `/dashboard`
- `inactive` → `/login?error=inactive`
- unauthenticated → `/login`

Content: a centered card with "Account pending approval" heading, short explanation, "For questions, contact your church admin", and a sign-out button (tiny client component that calls `signOut({ callbackUrl: "/login" })`).

---

## 8. Sidebar & dashboard layout

### 8.1 Sidebar visibility changes

The existing `navItems` filter in `components/layout/Sidebar.tsx` is refactored from role-array matching to a gates-object pattern:

```ts
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
  { href: "/dashboard",                  label: "Dashboard",             icon: <FiHome />,       show: () => true },
  { href: "/dashboard/forms",            label: "Forms",                 icon: <FiFileText />,   show: (g) => g.canAccessForms },
  { href: "/dashboard/lineup",           label: "Music Lineup",          icon: <FiMusic />,      show: () => true },
  { href: "/dashboard/multimedia-checklist", label: "Multimedia Checklist", icon: <FiMonitor />, show: (g) => g.isMultimediaMember },
  { href: "/dashboard/calendar",         label: "Calendar",              icon: <FiCalendar />,   show: () => true },
  { href: "/dashboard/prayers",          label: "Prayers",               icon: <FiHeart />,      show: () => true },
  { href: "/dashboard/notifications",    label: "Notifications",         icon: <FiBell />,       show: () => true },
  { href: "/dashboard/users",            label: "Users",                 icon: <FiUsers />,      show: (g) => g.canAccessUsers },
  { href: "/dashboard/reports",          label: "Reports",               icon: <FiBarChart2 />,  show: (g) => g.canAccessReports },
  { href: "/dashboard/settings",         label: "System Settings",       icon: <FiSettings />,   show: (g) => g.canAccessSettings },
];
```

Sidebar filter becomes `navItems.filter((i) => i.show(gates))`.

### 8.2 Gates computed in dashboard layout

`app/(dashboard)/layout.tsx` computes the gates once and threads them through `DashboardShell → Sidebar`:

```ts
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
```

### 8.3 Every dashboard route gets an explicit guard

Currently some dashboard pages rely on the sidebar to hide themselves but don't guard the server route. This rework closes those holes. Every `app/(dashboard)/dashboard/<feature>/page.tsx`:

1. `getServerSession(authOptions)`
2. Compute `PermissionSession` from it
3. Call the appropriate `canAccess*` helper
4. `redirect("/dashboard")` on false

Pages to audit and gate:

- `dashboard/forms/**`
- `dashboard/users/**`
- `dashboard/settings/**`
- `dashboard/reports/**`
- `dashboard/multimedia-checklist/**` (existing, confirm helpers updated)
- Everything else stays open within the dashboard

---

## 9. Notifications & recipient helpers

### 9.1 `lib/notificationRecipients.ts` changes

```ts
// Admin query migrates from Role join to isAdmin flag + active-only filter
export async function getAdminUserIds(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { isAdmin: true, status: "active" },
    select: { id: true },
  });
  return admins.map((u) => u.id);
}

// Ministry members — adds active-only filter so pending/inactive users don't receive notifications
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

// NEW — centralizes "heads of ministry X" in the recipient helpers file
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

// getLineupParticipantIds unchanged (operates on assignment tables, not role tables)
```

**Status filter is load-bearing:** pending and inactive users must not receive notifications. They have no dashboard to read them on and it would be noise.

### 9.2 Checklist notification cleanup

The `getRunClosedRecipients` helper currently inlined in `lib/checklist.ts` (from the previous feature's Task 23) becomes a 2-line wrapper around `getAdminUserIds` + `getMinistryHeadIds`:

```ts
export async function getRunClosedRecipients(
  multimediaMinistryId: string,
  actorUserId: string | null
): Promise<string[]> {
  const [adminIds, headIds] = await Promise.all([
    getAdminUserIds(),
    getMinistryHeadIds(multimediaMinistryId),
  ]);
  const all = new Set([...adminIds, ...headIds]);
  if (actorUserId) all.delete(actorUserId);
  return Array.from(all);
}
```

The raw Prisma query lives in `getMinistryHeadIds`; `lib/checklist.ts` orchestrates.

### 9.3 New notification type

- `"user_signup_pending"` — fired when a new signup lands. Recipients: `getAdminUserIds()`. Title: `"New signup awaiting approval"`. Body: `"${name} has requested access"`. Link: `/dashboard/users?tab=pending`.

No notifications on approve or reject (per decision).

---

## 10. Call-site sweep — every file that reads `session.roleSlug` changes

This is the scope of the mechanical refactor. Every file listed below gets a small, local edit to switch from `(roleSlug, ministryIds, ...)` helper calls to `(session, ...)` helper calls, plus any direct `session.roleSlug` reads replaced with `session.isAdmin` or membership checks.

### 10.1 Library code

- `lib/auth.ts` — major rewrite (callbacks + module augmentation)
- `lib/permissions.ts` — full rewrite
- `lib/notificationRecipients.ts` — rewrites per §9.1
- `lib/checklist.ts` — `getRunClosedRecipients` simplified per §9.2; `notifyTemplateChangeIfRunOpen` unchanged in logic but call-site switches to the new recipient helpers
- `lib/db/seed.ts` — seed admin user uses `isAdmin: true` + `status: "active"` instead of `role.connect: { slug: "admin" }`. Drops all Role/Permission/RolePermission seeding.

### 10.2 API routes (approximately 25 files)

- `app/api/auth/register/route.ts` — major rewrite (§7.3)
- `app/api/users/route.ts` — rewrite scoping + response shape (§6.8)
- `app/api/users/[id]/route.ts` — rewrite with new body shape and scoping
- `app/api/users/[id]/approve/route.ts` — new
- `app/api/users/[id]/reject/route.ts` — new
- `app/api/forms/arf/route.ts` + `[id]/route.ts` + `[id]/pdf/route.ts` — mechanical session shape
- `app/api/forms/prf/route.ts` + `[id]/route.ts` + `[id]/pdf/route.ts` — mechanical session shape
- `app/api/lineup/route.ts` + `[id]/route.ts` + `[id]/chat/route.ts` + `[id]/instruments/route.ts` + `[id]/singers/route.ts` — mechanical session shape
- `app/api/prayers/route.ts` + `[id]/route.ts` — mechanical session shape
- `app/api/settings/ministries/route.ts` + `instruments/route.ts` + `singer-roles/route.ts` — mechanical session shape
- `app/api/profile/route.ts` — unchanged (self-edit, no role check)
- `app/api/options/ministries/route.ts`, `options/users/route.ts` — mechanical session shape
- `app/api/options/roles/route.ts` — **delete** (no `Role` table anymore; nothing queries this)
- `app/api/search/route.ts` — mechanical session shape
- `app/api/notifications/read/route.ts` — mechanical session shape
- `app/api/checklist/current/route.ts` — unchanged (public, no session)
- `app/api/checklist/items/[itemId]/check/route.ts` — mechanical session shape
- `app/api/checklist/items/route.ts` + `[itemId]/route.ts` — mechanical session shape
- `app/api/checklist/categories/route.ts` + `[id]/route.ts` — mechanical session shape
- `app/api/checklist/runs/start/route.ts` + `close/route.ts` + `route.ts` + `[id]/route.ts` — mechanical session shape
- `app/api/checklist/stats/route.ts` — mechanical session shape
- `app/api/cron/checklist-reset/route.ts` — unchanged (no session)
- `app/api/cron/reminders/route.ts` — unchanged

### 10.3 Server pages (approximately 15 files)

- `app/(dashboard)/layout.tsx` — pending redirect, gates computation, session shape (§4.2, §8.2)
- `app/(dashboard)/dashboard/page.tsx` — mechanical session shape
- `app/(dashboard)/dashboard/forms/**/page.tsx` — add gate + mechanical session shape
- `app/(dashboard)/dashboard/users/page.tsx` — major rewrite (tabs, scoping)
- `app/(dashboard)/dashboard/users/[id]/page.tsx` (if exists) — mechanical
- `app/(dashboard)/dashboard/lineup/**/page.tsx` — mechanical
- `app/(dashboard)/dashboard/calendar/page.tsx` — mechanical
- `app/(dashboard)/dashboard/prayers/**/page.tsx` — mechanical
- `app/(dashboard)/dashboard/notifications/page.tsx` — mechanical
- `app/(dashboard)/dashboard/settings/**/page.tsx` — add admin gate + mechanical
- `app/(dashboard)/dashboard/reports/page.tsx` — admin gate
- `app/(dashboard)/dashboard/multimedia-checklist/**/page.tsx` — mechanical (helpers already in place, just signature switch)
- `app/login/page.tsx` — error query params + authenticated-redirect logic
- `app/signup/page.tsx` — major rewrite (ministry multi-select, remove role dropdown, success screen)

### 10.4 New routes

- `app/pending/page.tsx` (top-level)

### 10.5 Client components

- `features/users/UserForm.tsx` — major rewrite (§6.7)
- `features/users/UsersTableClient.tsx` — tabs, chip list for ministries+roles
- `features/arf/ARFForm.tsx`, `features/prf/PRFForm.tsx`, `features/arf/ARFTableClient.tsx`, `features/prf/PRFTableClient.tsx` — any `session.roleSlug` reads replaced with membership/head checks
- `features/lineup/**` — same mechanical sweep
- `features/prayer/**` — same mechanical sweep
- `features/checklist/**` — the checklist client components don't read session directly (they take `canCheck` / `canManage` as props), so they're unchanged
- `features/shared/**` — any permission-aware components get the session shape update

### 10.6 Components

- `components/layout/Sidebar.tsx` — refactor to `SidebarGates` + `show(g)` pattern (§8.1)
- `components/layout/DashboardShell.tsx` — accept `gates: SidebarGates` prop and forward to Sidebar
- `components/layout/Navbar.tsx` — read `session.isAdmin` instead of `session.roleSlug === "admin"` if any admin-specific UI exists

### 10.7 Schemas

- `schemas/user.ts` — `signupSchema` rewrite, `userCreateSchema` / `userUpdateSchema` add `ministryAssignments` field
- All other schemas unchanged

### 10.8 Seed

- `lib/db/seed.ts` — drop Role/Permission/RolePermission seeding; seed admin user with `isAdmin: true` + `status: "active"`; keep ministries and checklist starter template unchanged

---

## 11. Verification

No test runner configured. Verification is `npm run check` + a scripted manual walkthrough.

### 11.1 Automated

1. `npm run type-check` — zero errors (expected to be the longest tail of the rework — every session-shape change shows up here)
2. `npm run lint` — zero errors
3. `npm run format:check` — clean

### 11.2 Manual dry-run

Against a freshly-reset DB with `npm run db:seed`:

1. **Seed sanity:** admin user exists, can log in, sees the dashboard (not `/pending`)
2. **Signup flow:**
   - Sign up as a new user with a ministry multi-select (pick Multimedia + Yaps)
   - Verify success screen appears, no auto-sign-in
   - Attempt to sign in with the new credentials
   - Verify redirect to `/pending` after successful auth
   - Verify sign-out button works and returns to `/login`
3. **Admin approval:**
   - As admin, see the bell notification for the new signup
   - Navigate to `/dashboard/users?tab=pending`
   - See the pending row with the applicant's requested ministries
   - Click Approve, adjust ministries (remove Yaps, keep Multimedia)
   - Confirm approval; verify row moves to Active tab, badge decrements
4. **New user post-approval:**
   - Sign in as the approved user
   - Verify dashboard access, sidebar shows only the ministries they're in
   - Verify they can view `/checklist` and check items (Multimedia member, `canCheck: true`)
   - Verify they cannot edit the checklist template (`canEdit...` requires head)
5. **Promotion to head:**
   - As admin, edit the new user in the Active tab
   - Toggle the Multimedia "Head" switch on
   - Save
   - Sign in as the promoted user (or stay signed in and reload — session rehydration should pick up the change)
   - Verify the template editor is now accessible
6. **Per-ministry scoping:**
   - Promote the user to head of Multimedia, member of Yaps (no head role in Yaps)
   - Verify they can edit Multimedia checklist template
   - Verify they cannot access Yaps-related admin actions (if Yaps had any)
7. **Ministry head UX:**
   - As a ministry head (not admin), navigate to `/dashboard/users`
   - Verify only users in ministries they head are visible
   - Verify Pending tab is hidden
   - Edit a user: verify basic info is read-only, only the head-scoped ministries are editable
8. **Reject flow:**
   - Create another pending signup
   - As admin, click Reject, confirm
   - Verify the user row is deleted
   - Try to sign up again with the same email — should succeed (re-registration allowed)
9. **Deactivate flow:**
   - As admin, deactivate an active user
   - Verify they can no longer sign in (NextAuth `authorize` rejects `inactive`)
   - Reactivate — verify they can sign in again
10. **Session rehydration:**
    - With an active user logged in, have the admin change their ministry role
    - Without the affected user re-logging in, have them navigate to a permission-gated page — verify the new permissions apply immediately
11. **Permission gates:**
    - As a plain-member user, direct-navigate to `/dashboard/users`, `/dashboard/settings`, `/dashboard/reports`, `/dashboard/multimedia-checklist/template` — all should redirect to `/dashboard`
12. **Sidebar visibility:**
    - Admin: sees everything
    - Ministry head of any ministry: sees Forms, Users (but not Pending tab)
    - Plain member: no Forms, no Users, no Settings
    - Multimedia member: sees Multimedia Checklist

---

## 12. Out of scope / deferred

- **Email notifications** for signup/approve/reject. SendGrid wiring exists but is unused for v1. Add later if needed.
- **Distributed approval** (ministry heads approve signups for their own ministry). v1 is admin-only. Distribute later if a bottleneck emerges.
- **Audit log for rejections.** Hard-delete means no paper trail. If compliance ever needs this, add a `RejectionLog` table.
- **Tiered admin roles** (super-admin vs. regular admin). One `isAdmin` flag is sufficient; tiering is a later migration.
- **Self-service ministry join** (existing active user requests to join another ministry). v1 requires admin to add memberships. Add a request flow later.
- **Password strength meter** on signup. Current `min(8)` is fine for v1.
- **2FA / SSO.** NextAuth JWT + credentials only for v1.

---

## 13. Assumptions tucked in that are worth flagging again

1. **One admin flag, no tiering.** Simple and correct for a single-church app. Trivially extensible to an enum later.
2. **Session rehydrates on every request via one Prisma findUnique.** Trade 15–30ms latency per request for instant propagation. At this scale it's fine; if scale grows, introduce a version counter + cache.
3. **Clean migration with `prisma migrate reset`.** The user confirmed no production data to preserve.
4. **`NEXTAUTH_SECRET` does not need to be rotated.** JWT shape changes between deployments, but since all existing sessions are dev-only, no rotation strategy is needed.
5. **`canCreateARFOrPRF` tightens.** A ministry head can only create requests for ministries they _head_, not ministries they're members of. This is the intentional correction implicit in the whole rework.
6. **System Settings is admin-only.** Previously ministry heads could access it; this is a scope tightening.
