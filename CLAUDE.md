# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Church Ministry Management System (`mndbd`) — Next.js 16 App Router app for managing Sunday worship lineups, Activity Request Forms (ARF), Purchase Request Forms (PRF), ministries, members, prayers, notifications, and events.

**Full architectural reference**: [docs/PROJECT_DOCUMENTATION.md](docs/PROJECT_DOCUMENTATION.md) — read this first for access-rights matrices, API route table, data flow, and notification recipient rules. It is the canonical spec and should be kept in sync with code changes.

## Commands

```bash
npm run dev             # Next dev server (http://localhost:3000)
npm run build           # Next build + prisma generate + migrate deploy + seed
npm run lint            # ESLint (eslint.config.mjs)
npm run lint:fix
npm run type-check      # tsc --noEmit (strict)
npm run format          # Prettier write
npm run check           # type-check + lint + format:check (run before finishing work)
npm run fix             # format:fix + lint:fix

# Prisma / DB
npm run db:generate     # prisma migrate dev (creates a new migration)
npm run db:migrate      # prisma migrate deploy (apply existing migrations)
npm run db:push         # prisma db push (no migration file; dev only)
npm run db:seed         # tsx lib/db/seed.ts
npm run db:refresh      # migrate reset --force --skip-seed, then re-seed
npm run db:studio       # prisma studio
```

There is no test runner configured — do not invent `npm test`. Verify changes via `npm run check` and manual exercise in the dev server.

## Git workflow

**Never auto-commit.** Do not run `git commit`, `git push`, or create PRs on your own — not at the end of a task, not after a skill workflow (brainstorming, executing-plans, finishing-a-development-branch, etc.), not after a "successful" verification. The user reviews every change manually and commits by hand. If a superpowers skill's default flow ends in a commit step, stop before that step and hand control back. Only commit when the user explicitly says so in the current turn (e.g. "commit this", "/commit").

## Architecture

### Route groups and auth boundary

- [app/(dashboard)/layout.tsx](<app/(dashboard)/layout.tsx>) is the **only** auth gate. It calls `getServerSession(authOptions)` and redirects to `/login?callbackUrl=...` if `session?.userId` is missing.
- [middleware.ts](middleware.ts) has an **empty matcher** and deliberately does nothing. Edge middleware was dropped because it couldn't see the NextAuth session cookie after login (caused 307 loops to `/login`). Do not re-enable it to enforce auth — use the layout.
- `app/(public)/` is for unauthenticated pages; `app/login`, `app/signup`, `app/forgot-password`, `app/reset-password` live at the root.

### Session shape (extended NextAuth JWT)

After login, `session` includes: `userId`, `roleId`, `roleSlug` (`"admin" | "ministry_head" | "user"`), `ministryId` (primary), and `ministryIds` (aggregated from `UserMinistry` + `User.ministryId`). Always read `session.ministryIds` for ministry scoping — never just `ministryId`.

### Permission model

All role/ministry gates live in [lib/permissions.ts](lib/permissions.ts) as pure helpers (e.g. `canAccessForms`, `canCreateLineup`, `canManagePrayer`, `canSeeDraftLineup`). API routes and server components must call these rather than re-checking roles inline. Notable rules:

- **Lineup view** is public to all authenticated users; **lineup create** requires admin OR membership in the Music ministry.
- **Draft lineups** are visible only to creator + admin (ministry heads deliberately excluded).
- **Prayer** access is Parakletos-ministry-scoped and returns a `{canView, canEdit, canDelete, canSetStatus}` capability object — destructure it, don't boolean-AND your own logic.

### Feature layout

- `app/(dashboard)/dashboard/<feature>/` — server pages that fetch via `prisma` and hand off to a client component.
- `features/<domain>/` — client components (`*Form`, `*TableClient`, `*DetailClient`). New feature UI goes here, not in `components/`.
- `components/ui/` — generic primitives re-exported from `components/ui/index.ts`.
- `components/layout/` — `DashboardShell`, `Sidebar`, `Navbar` (the Pusher notifications client lives here).
- `schemas/` — Zod schemas shared between forms and API routes. Server handlers must `safeParse` and return `NextResponse.json({ message }, { status: 400 })` on failure.
- `services/notificationService.ts` + `lib/notificationRecipients.ts` — when a mutation needs to notify users, resolve recipient IDs via the `notificationRecipients` helpers (`getAdminUserIds`, `getMinistryMemberIds`, `getLineupParticipantIds`, etc.) and create notifications through the service. Do not hand-roll Pusher triggers or `prisma.notification.create` inline — the service also publishes to the Pusher channel.

### Real-time (Pusher)

- Server: `lib/pusher.ts` exports `getPusher()` and `getPusherChannelName()`.
- Channels: `notifications-{userId}` (event `notification`) and `chat-{lineupId}` (event `message`).
- Client subscribers: `DashboardShell` (notifications bell) and `LineupDetailClient` (chat).

### Database

- Schema: [prisma/schema.prisma](prisma/schema.prisma); migrations in `prisma/migrations/`.
- Single Prisma client is exported from [lib/prisma.ts](lib/prisma.ts) — always import from there, never `new PrismaClient()` in route code.
- Seed entry point is `lib/db/seed.ts` (not `prisma/seed.ts` despite what older READMEs suggest). `package.json` `prisma.seed` points at it.
- Role slugs `admin`, `ministry_head`, `user` must exist before signup will work; ministry slug `parakletos` is special-cased by prayer permissions; a ministry with slug matching the Music ministry is required for `canCreateLineup`.

### Reminders cron

`GET /api/cron/reminders` fires 24h/2h reminders for lineup events. It is gated by the `CRON_SECRET` env var (not NextAuth) and dispatches in-app + optional SendGrid email.

## Code conventions

- **TypeScript strict** is on. Avoid `any`; prefer typed Prisma results and Zod-inferred types.
- **React 19 + React Compiler** is enabled via [next.config.ts](next.config.ts) (`reactCompiler: true`) and `babel-plugin-react-compiler`. Don't add manual `useMemo`/`useCallback` churn unless there's a measured reason — the compiler handles it.
- **Path alias**: `@/*` → repo root (see [tsconfig.json](tsconfig.json)). Import as `@/lib/prisma`, `@/components/ui`, etc.
- **Prettier**: 100-col, double quotes, semi, trailing ES5 commas, Tailwind class sort plugin enabled. Run `npm run format` before committing.
- **Styling**: Tailwind v4 with design tokens as CSS vars in `app/globals.css` (`--color-primary`, `--color-soft-blue-bg`, `--color-text-dark`, etc.). Reference as `bg-[var(--color-primary)]` etc. instead of hardcoding hex.
- **Accessibility rules enforced by lint**: label-for-control association, keyboard listener beside click handler on visible elements, `role` attribute on non-interactive clickables, no array index as React key, no inline arrow/`.bind()` in JSX props, no single-child fragments, template literals over string concat. [features/arf/ARFForm.tsx](features/arf/ARFForm.tsx) and [features/prf/PRFForm.tsx](features/prf/PRFForm.tsx) have `react-hooks/exhaustive-deps` disabled — preserve that override when editing those two files.
- **API route shape**: `getServerSession(authOptions)` → permission helper → Zod `safeParse` → Prisma → `NextResponse.json(...)`. Return `{ error }` with 401/403 for auth failures and `{ message }` with 400 for validation errors (existing handlers are inconsistent but new code should follow this).
- **Client mutations**: call `router.refresh()` after a successful `fetch` to re-run the server component and pick up new data, rather than maintaining parallel client state.

## Environment variables

Required: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `PUSHER_APP_ID`, `PUSHER_KEY`, `PUSHER_SECRET`, `PUSHER_CLUSTER`, `NEXT_PUBLIC_PUSHER_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER`.
Optional: `SENDGRID_API_KEY`, `APP_EMAIL_FROM` (email), `CRON_SECRET` (reminders endpoint), `ADMIN_EMAIL`, `ADMIN_PASSWORD` (seed).
