# Church Ministry Management System – Project Documentation

> **Purpose**: Feed this document to AI before prompts so it understands the project architecture, code standards, features, access rights, and auth. Read this first for context.

> **⚠️ STALE SECTIONS:** This document was written before the **per-ministry role rework** (April 2026). The sections on session shape, the `Role` table, `roleSlug`, `ministry_head` as a global role, and the permission helper signatures are **out of date**. The current authoritative reference for the role model, session shape, and permission helpers is **[CLAUDE.md](../CLAUDE.md)** in the repo root, plus the specs at [docs/superpowers/specs/2026-04-12-user-roles-and-signup-approval-design.md](superpowers/specs/2026-04-12-user-roles-and-signup-approval-design.md). The high-level feature descriptions (sections 5, 6, 8, 9, 10, 11, 12, 13) below are still accurate; only the auth/role/session sections (3, 4, 7) are stale.

> **Quick reality check:** roles are now per-ministry (`UserMinistry.role: "head" | "member"`); admin is a global `User.isAdmin` boolean; signups land in `pending` status and require admin approval. There is no longer a `Role` table.

---

## 1. Project Overview

**Name**: Church Ministry Management System (mndbd)

**Tech Stack**:

- Next.js 16 (App Router), TypeScript, Tailwind CSS, Framer Motion
- Prisma ORM, PostgreSQL
- NextAuth (credentials provider), JWT sessions
- Pusher (real-time chat + notifications)
- SendGrid (optional email)
- Zod (validation)
- React Icons

**Purpose**: Manage Sunday worship lineups, Activity Request Forms (ARF), Purchase Request Forms (PRF), ministries, members, prayers, notifications, and events.

---

## 2. Project Architecture

### 2.1 Directory Structure

```
app/
├── (dashboard)/           # Protected dashboard routes
│   ├── layout.tsx         # Auth check, fetches notifications, passes to DashboardShell
│   └── dashboard/
│       ├── page.tsx       # Role-based dashboard
│       ├── forms/         # ARF, PRF list/detail/edit/new
│       ├── lineup/        # Music lineup list/detail/edit/new
│       ├── calendar/      # Monthly calendar view
│       ├── prayers/       # Prayer requests
│       ├── notifications/
│       ├── users/         # User management (admin/ministry_head only)
│       ├── settings/      # System settings (admin) / Music setup (ministry_head)
│       ├── reports/       # Admin only
│       └── profile/       # Self-edit profile
├── api/                   # API routes
│   ├── auth/              # NextAuth, register
│   ├── forms/arf/         # ARF CRUD, PDF
│   ├── forms/prf/         # PRF CRUD, PDF
│   ├── lineup/            # Lineup CRUD, chat, instruments, singers
│   ├── prayers/
│   ├── users/
│   ├── options/           # ministries, roles, users (for dropdowns)
│   ├── settings/          # ministries, instruments, singer-roles
│   ├── notifications/read/
│   ├── profile/           # GET/PUT own profile
│   ├── search/            # Global search
│   └── cron/reminders/    # Cron endpoint for reminders
├── login/
├── signup/
└── layout.tsx             # Root layout, SessionProvider

components/
├── layout/                 # DashboardShell, Sidebar, Navbar
├── ui/                     # Reusable UI (Button, Input, Card, etc.)
├── providers/              # SessionProvider
└── ApprovalHistoryTimeline

features/                   # Feature-specific components
├── arf/                    # ARFForm, ARFTableClient
├── prf/                    # PRFForm, PRFTableClient
├── lineup/                  # LineupForm, LineupTableClient, LineupAssignmentsClient
├── prayer/                 # PrayerForm, PrayerTableClient, PrayerDetailActions
├── users/                  # UserForm, UsersTableClient
├── profile/                # ProfileForm
├── settings/               # SettingsMinistries, SettingsInstruments, SettingsSingerRoles
└── shared/                 # FormDetailActions, FormActionsCell, ExpandableTable

lib/
├── auth.ts                 # NextAuth config
├── prisma.ts               # Prisma client singleton
├── permissions.ts          # Role-based access helpers
├── notificationRecipients.ts # getAdminUserIds, getMinistryMemberIds, getLineupParticipantIds, etc.
├── pusher.ts               # Pusher server instance
└── sendgrid.ts             # Optional email

schemas/                    # Zod schemas (arf, prf, lineup, user, prayer, profile)
services/                   # notificationService
hooks/                      # useDebounce
```

### 2.2 Data Flow

- **Server Components**: Pages fetch data with `getServerSession`, `prisma`, pass to client components
- **Client Components**: `"use client"` for interactivity, forms, real-time updates
- **API Routes**: REST-style, `getServerSession` for auth, return JSON
- **Real-time**: Pusher channels `notifications-{userId}` and `chat-{lineupId}`

---

## 3. Authentication

### 3.1 NextAuth Configuration

- **Provider**: Credentials (email + password)
- **Strategy**: JWT (30-day max age)
- **Session extension**: `userId`, `roleId`, `roleSlug`, `ministryId`, `ministryIds` added to session

### 3.2 Session Shape

```ts
session.userId; // string
session.roleSlug; // "admin" | "ministry_head" | "user"
session.ministryIds; // string[] (from UserMinistry + User.ministryId)
```

### 3.3 Auth Flow

1. **Login** (`/login`): `POST /api/auth/callback/credentials` via NextAuth
2. **Signup** (`/signup`): `POST /api/auth/register` – creates user, admin role cannot be chosen
3. **Protected routes**: `dashboard` layout checks `session?.userId`, redirects to `/login` if missing

### 3.4 User Model (relevant fields)

- `id`, `email`, `hashedPassword`, `name`, `address`, `age`, `birthday`
- `status` ("active" | "inactive")
- `roleId` → Role
- `ministryId` (primary ministry, optional)
- `userMinistries` (many-to-many with Ministry)

---

## 4. Roles and Access Rights

### 4.1 Roles

| Role          | Slug            | Description        |
| ------------- | --------------- | ------------------ |
| Admin         | `admin`         | Full system access |
| Ministry Head | `ministry_head` | Own ministry only  |
| User          | `user`          | Regular member     |

### 4.2 Permission Helpers (`lib/permissions.ts`)

| Function                         | Returns true when                                                          |
| -------------------------------- | -------------------------------------------------------------------------- |
| `canAccessUsers`                 | admin, ministry_head                                                       |
| `canAccessSettings`              | admin only                                                                 |
| `canManageInstrumentsAndSingers` | admin, ministry_head                                                       |
| `canAccessForms`                 | admin, ministry_head                                                       |
| `canCreateARFOrPRF`              | admin, ministry_head                                                       |
| `canAccessLineup`                | **always true** (everyone can view)                                        |
| `canCreateLineup`                | admin OR user in Music ministry                                            |
| `canManageMinistry`              | admin OR ministry_head of target ministry                                  |
| `canApproveLineup`               | admin, ministry_head                                                       |
| `canAccessPrayers`               | always true                                                                |
| `canSeeDraftLineup`              | admin OR creator                                                           |
| `canManagePrayer`                | admin / creator / Parakletos head / Parakletos member (see Prayer section) |
| `canViewAllPrayers`              | admin OR Parakletos head OR Parakletos member                              |

### 4.3 Feature Access Matrix

| Feature               | Admin | Ministry Head       | User                |
| --------------------- | ----- | ------------------- | ------------------- |
| Dashboard             | ✓     | ✓                   | ✓                   |
| Forms (ARF/PRF)       | ✓     | ✓                   | ✗                   |
| Music Lineup (view)   | ✓     | ✓                   | ✓                   |
| Music Lineup (create) | ✓     | Music ministry only | Music ministry only |
| Calendar              | ✓     | ✓                   | ✓                   |
| Prayers               | ✓     | ✓                   | ✓                   |
| Notifications         | ✓     | ✓                   | ✓                   |
| Users                 | ✓     | Own ministry        | ✗                   |
| Reports               | ✓     | ✗                   | ✗                   |
| System Settings       | ✓     | ✓ (Music setup)     | ✗                   |
| Profile (self-edit)   | ✓     | ✓                   | ✓                   |

### 4.4 Dashboard Layout

- Auth enforced in `app/(dashboard)/layout.tsx` via `getServerSession`
- Unauthenticated users redirect to `/login?callbackUrl=/dashboard`

---

## 5. Features (How They Work)

### 5.1 Forms (ARF / PRF)

**ARF**: Activity Request Form – event name, date, what/when/where/why, justification

**PRF**: Purchase Request Form – ministry, request date, amount, purpose, justification

**Status flow**: draft → pending → approved | rejected

**Access**:

- Create: admin, ministry_head
- Draft: creator + admin can edit
- Pending/Approved/Rejected: ministry head of that ministry or admin can approve/reject

**Notifications**:

- On create: admin + ministry members
- On status change: admin + ministry members (exclude actor)

### 5.2 Music Lineup

**Entities**: Lineup (event, date, ministry), Songs (Joyful/Solemn, title, YouTube link), InstrumentAssignment, SingerAssignment

**Status flow**: Draft → Pending Approval → Approved

**Access**:

- **View**: Everyone (all roles) can view the lineup list and detail
- **Create**: Only Music ministry members or admin
- **Draft**: Only creator and admin can see/edit
- **Edit/Approve**: Admin or ministry head of Music ministry

**Create flow**:

- "Create as draft" or "Create lineup" (submit for approval)
- Assign instruments and singers (from ministry users)

**Chat**: Real-time (Pusher) per lineup. Participants = creator + musicians + singers. New messages notify participants.

**Notifications**:

- Lineup approved: creator + musicians + singers
- Chat message: participant IDs (exclude sender)
- Assignment: when user is assigned as musician/singer, they get notified

### 5.3 Prayers

**Parakletos** ministry: ministry slug `parakletos`

**Access**:

- Creator: can view, edit, delete; cannot set status
- Parakletos ministry head: can view, delete, set status
- Parakletos member: can view, set status (e.g. mark prayed)
- Admin: full access

**Notifications**:

- On create: all Parakletos members
- On "prayed for": creator

### 5.4 Calendar

- Monthly view of lineups and ARF events
- Fetches events from lineup and ARF tables
- Filtered by role (admin sees all; ministry head sees own ministry)

### 5.5 Notifications

- Stored in `Notification` table
- Pusher channel `notifications-{userId}` for real-time delivery
- Bell icon in Navbar with unread count
- Mark read: `POST /api/notifications/read` with `{ id }`

### 5.6 Users

- Admin: all users
- Ministry head: users in their ministry(s)
- Create: `POST /api/users` (admin/ministry_head)
- Edit: `PUT /api/users/[id]` (admin/ministry_head, ministry head can only assign to own ministries)

### 5.7 Profile

- `GET /api/profile` – current user's profile
- `PUT /api/profile` – update name, email, address, age, birthday, password (optional)
- Read-only display of role and ministries

### 5.8 Global Search

- `GET /api/search?q=...` – search users, ministries, ARFs, PRFs, lineups, songs
- Debounced search modal in DashboardShell

### 5.9 Reminders

- Cron: `GET /api/cron/reminders` (protected by cron secret)
- 24h and 2h before lineup events
- In-app + optional email

---

## 6. Database Schema (Summary)

**Core models**:

- `Role`, `Permission`, `RolePermission`
- `User`, `Ministry`, `UserMinistry`
- `ARF`, `PRF`, `Lineup`, `Song`, `Instrument`, `InstrumentAssignment`, `SingerRole`, `SingerAssignment`
- `ApprovalHistory`, `ChatMessage`, `Notification`, `Reminder`, `Prayer`, `EmailTemplate`

**Key enums**:

- `RequestType`: ARF, PRF, LINEUP
- `ApprovalAction`: approved, rejected
- `SongSection`: Joyful, Solemn
- `ReminderChannel`: in_app, email

---

## 7. Code Standards

### 7.1 User Rules (from .cursorrules)

- Use valid anchors
- Form labels must be associated with controls
- Visible elements with click handlers need keyboard listeners
- Do not use array index as React key
- Avoid `.bind()` or arrow functions in JSX props
- Avoid `any` type
- Non-interactive elements with click handlers need `role` attribute
- Prefer template literals over string concatenation
- Fragments should contain more than one child
- Include comments for new programmers

### 7.2 Styling

- CSS variables in `app/globals.css`: `--color-primary`, `--color-soft-blue-bg`, `--color-text-dark`, etc.
- Tailwind: use `var(--color-primary)` etc.

### 7.3 Validation

- Zod schemas in `schemas/` for all forms and API payloads
- Use `safeParse` and return 400 with error message on failure

### 7.4 API Conventions

- Auth: `getServerSession(authOptions)` at start of handler
- Return `NextResponse.json({ error: "..." }, { status: 401 })` for 401
- Return `NextResponse.json({ message: "..." }, { status: 400 })` for validation errors
- Use `router.refresh()` after mutations in client components

### 7.5 Components

- UI components in `components/ui/` – exported from `components/ui/index.ts`
- Feature components in `features/` – organized by domain (arf, prf, lineup, etc.)

---

## 8. Real-Time (Pusher)

**Channels**:

- `notifications-{userId}` – event `notification` (payload: id, type, title, body, link, ministryId, createdAt)
- `chat-{lineupId}` – event `message` (payload: id, body, userId, userName, createdAt)

**Client**: `pusher-js` in `LineupDetailClient` (chat) and `DashboardShell` (notifications)

**Server**: `lib/pusher.ts` – `getPusher()`, `getPusherChannelName()`

---

## 9. Environment Variables

```
DATABASE_URL
NEXTAUTH_SECRET
NEXTAUTH_URL
PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, PUSHER_CLUSTER
NEXT_PUBLIC_PUSHER_KEY, NEXT_PUBLIC_PUSHER_CLUSTER
SENDGRID_API_KEY, APP_EMAIL_FROM  (optional)
CRON_SECRET  (optional, for reminders cron)
ADMIN_EMAIL, ADMIN_PASSWORD  (optional, for db seed)
```

---

## 10. Key File Reference

| Purpose                 | File                              |
| ----------------------- | --------------------------------- |
| Auth config             | `lib/auth.ts`                     |
| Permissions             | `lib/permissions.ts`              |
| Notification recipients | `lib/notificationRecipients.ts`   |
| Create notifications    | `services/notificationService.ts` |
| ARF schema              | `schemas/arf.ts`                  |
| PRF schema              | `schemas/prf.ts`                  |
| Lineup schema           | `schemas/lineup.ts`               |
| User schema             | `schemas/user.ts`                 |
| Profile schema          | `schemas/profile.ts`              |
| Prayer schema           | `schemas/prayer.ts`               |
| Dashboard layout        | `app/(dashboard)/layout.tsx`      |
| Sidebar nav             | `components/layout/Sidebar.tsx`   |

---

## 11. Seed Data

- **Roles**: Admin, Ministry Head, User
- **Ministries**: Music, Parakletos, Youth, Yaps, Kaloob, JSS, etc.
- **Permissions**: CRUD for ministries, users, lineup, etc.
- **Admin user**: Set via `ADMIN_EMAIL`, `ADMIN_PASSWORD` in .env; created by `npm run db:seed` (uses `lib/db/seed.ts`)

---

## 12. API Routes Quick Reference

| Route                          | Methods                 | Auth                           | Purpose                  |
| ------------------------------ | ----------------------- | ------------------------------ | ------------------------ |
| `/api/auth/register`           | POST                    | Public                         | Sign up                  |
| `/api/auth/[...nextauth]`      | \*                      | NextAuth                       | Login, session           |
| `/api/profile`                 | GET, PUT                | Session                        | Own profile              |
| `/api/users`                   | GET, POST               | canAccessUsers                 | List, create users       |
| `/api/users/[id]`              | GET, PUT, DELETE        | canAccessUsers                 | User CRUD                |
| `/api/forms/arf`               | GET, POST               | canAccessForms                 | ARF list, create         |
| `/api/forms/arf/[id]`          | GET, PUT                | Role-based                     | ARF detail, update       |
| `/api/forms/arf/[id]/pdf`      | GET                     | Role-based                     | ARF PDF                  |
| `/api/forms/prf`               | GET, POST               | canAccessForms                 | PRF list, create         |
| `/api/forms/prf/[id]`          | GET, PUT                | Role-based                     | PRF detail, update       |
| `/api/forms/prf/[id]/pdf`      | GET                     | Role-based                     | PRF PDF                  |
| `/api/lineup`                  | GET, POST               | Session, canCreateLineup       | Lineup list, create      |
| `/api/lineup/[id]`             | GET, PUT, PATCH, DELETE | Session, role-based            | Lineup CRUD              |
| `/api/lineup/[id]/chat`        | GET, POST               | Session, canSeeDraftLineup     | Chat messages            |
| `/api/lineup/[id]/instruments` | POST, DELETE            | canSeeDraftLineup              | Assign instruments       |
| `/api/lineup/[id]/singers`     | POST, DELETE            | canSeeDraftLineup              | Assign singers           |
| `/api/prayers`                 | GET, POST               | Session                        | Prayer list, create      |
| `/api/prayers/[id]`            | GET, PUT, PATCH, DELETE | canManagePrayer                | Prayer CRUD              |
| `/api/options/ministries`      | GET                     | Session                        | Ministries for dropdowns |
| `/api/options/roles`           | GET                     | Session                        | Roles for dropdowns      |
| `/api/options/users`           | GET                     | Session                        | Users for dropdowns      |
| `/api/settings/ministries`     | GET, POST, PUT, DELETE  | canAccessSettings              | Ministry CRUD            |
| `/api/settings/instruments`    | GET, POST, PUT, DELETE  | canManageInstrumentsAndSingers | Instrument CRUD          |
| `/api/settings/singer-roles`   | GET, POST, PUT, DELETE  | canManageInstrumentsAndSingers | Singer role CRUD         |
| `/api/notifications/read`      | POST                    | Session                        | Mark notification read   |
| `/api/search`                  | GET                     | Session                        | Global search            |
| `/api/cron/reminders`          | GET                     | Cron secret                    | Trigger reminders        |

---

## 13. Shared Components

- **FormDetailActions**: Edit, Delete, Submit/Approve/Reject buttons for ARF/PRF/Lineup detail pages
- **FormActionsCell**: Inline actions for table rows (edit, delete, status)
- **ExpandableTable**: Table with expandable rows for nested content
- **PageContainer**: Page title, description, wrapper
- **Section**: Section title + optional Card wrapper
- **ApprovalHistoryTimeline**: Timeline of approval events

---

_End of Project Documentation. Use this as context before making changes or answering questions about the project._
