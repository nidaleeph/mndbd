/**
 * Shared TypeScript types.
 * Extend from Prisma types where useful.
 */

import type { Session } from "next-auth";

export type { Session };

export type RoleSlug = "admin" | "ministry_head" | "user";

export interface SessionUser {
  userId: string;
  roleId: string;
  roleSlug: RoleSlug;
  ministryId: string | null;
  name?: string | null;
  email?: string | null;
}
