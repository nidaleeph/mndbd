# Church Ministry Management System

A production-ready app for managing Sunday worship lineups, Activity Request Forms (ARF), Purchase Request Forms (PRF), ministries, members, notifications, and events.

## Project Documentation

For AI assistants and developers: **[docs/PROJECT_DOCUMENTATION.md](docs/PROJECT_DOCUMENTATION.md)** – full context on architecture, code standards, features, access rights, auth, and API reference. Feed this to AI before prompts for accurate project understanding.

## Tech Stack

- Next.js 16 (App Router), TypeScript, Tailwind CSS, Framer Motion
- Prisma, PostgreSQL
- NextAuth (credentials), Pusher (chat + notifications), SendGrid (email)
- Zod, React Icons

## Getting Started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Environment**

   Configure `.env` with:
   - `DATABASE_URL` – PostgreSQL connection string
   - `NEXTAUTH_SECRET` – random string for sessions
   - `NEXTAUTH_URL` – e.g. `http://localhost:3000`
   - `PUSHER_APP_ID`, `PUSHER_KEY`, `PUSHER_SECRET`, `PUSHER_CLUSTER`
   - `NEXT_PUBLIC_PUSHER_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER` (for client)
   - Optional: `SENDGRID_API_KEY`, `APP_EMAIL_FROM` for email
   - Optional: `CRON_SECRET` for reminder cron

3. **Database**

   Migrations are in `prisma/migrations`. If the DB is empty, run:

   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```

   Seed default roles (Admin, Ministry Head, User):

   ```bash
   npx tsx prisma/seed.ts
   ```

   Or insert roles manually: `Role` with `slug` values `admin`, `ministry_head`, `user`.

4. **Run the dev server**

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000). Use **Sign up** to create an account (ensure at least one Role exists and choose a role). Then sign in and open the **Dashboard**.

## Features

- **Dashboard** – Role-based widgets (pending approvals, lineups, assignments)
- **Forms** – ARF and PRF with CRUD, approval history timeline
- **Music Lineup** – Create lineups with Joyful/Solemn songs, YouTube links; draft/approval; real-time chat (Pusher)
- **Calendar** – Monthly view of lineups and ARF events
- **Notifications** – Bell with unread count; mark as read
- **Global search** – Users, ministries, ARFs, PRFs, lineups, songs
- **Users** – List by role (Admin: all; Ministry Head: own ministry)
- **System Settings** (Admin) – Ministries, instruments, singer roles
- **Reminders** – Cron endpoint `/api/cron/reminders` (24h/2h before events) with in-app + email

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
