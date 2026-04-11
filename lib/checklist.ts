/**
 * Shared helpers for the Multimedia checklist feature.
 *
 * Timezone note: all "Sunday" rollover logic is in Asia/Manila. Spec §8 is the
 * canonical reference — do not change these helpers without updating the spec.
 */

import { prisma } from "@/lib/prisma";
import {
  getAdminUserIds,
  getMinistryMemberIds,
  getMinistryHeadIds,
} from "@/lib/notificationRecipients";
import { createNotificationsForUserIds } from "@/services/notificationService";

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

/** Look up the Music ministry id fresh on every call. */
export async function getMusicMinistryId(): Promise<string | null> {
  const m = await prisma.ministry.findUnique({
    where: { slug: "music" },
    select: { id: true },
  });
  return m?.id ?? null;
}

/** Look up the Parakletos ministry id fresh on every call. */
export async function getParakletosMinistryId(): Promise<string | null> {
  const m = await prisma.ministry.findUnique({
    where: { slug: "parakletos" },
    select: { id: true },
  });
  return m?.id ?? null;
}

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

/** Start-of-today in Asia/Manila, returned as a UTC instant. */
export function startOfTodayManila(now: Date = new Date()): Date {
  const parts = getManilaParts(now);
  const manilaMidnightAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0);
  return new Date(manilaMidnightAsUtc - getManilaOffsetMinutes(now) * 60 * 1000);
}

/** Extract Manila wall-clock components from a UTC Date, independent of system TZ. */
function getManilaParts(at: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: CHECKLIST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const out: Record<string, string> = {};
  for (const p of fmt.formatToParts(at)) {
    if (p.type !== "literal") out[p.type] = p.value;
  }
  return {
    year: Number(out.year),
    month: Number(out.month),
    day: Number(out.day),
    // Intl may emit "24" for midnight — normalize to 0.
    hour: Number(out.hour) % 24,
    minute: Number(out.minute),
    second: Number(out.second),
  };
}

/**
 * Manila is UTC+08:00 year-round (no DST). Returning a constant is correct
 * and stable; we keep the function signature in case this ever changes.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- param reserved in case DST or regional changes ever apply
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

/** Multimedia members minus the actor — used for template-change notifications. */
export async function getTemplateChangeRecipients(
  multimediaMinistryId: string,
  actorUserId: string
): Promise<string[]> {
  const memberIds = await getMinistryMemberIds(multimediaMinistryId);
  return memberIds.filter((id) => id !== actorUserId);
}

/** Admin ∪ Multimedia ministry heads, minus the actor (if any — cron-closed runs have no actor). */
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

/**
 * Fire a template-changed notification to Multimedia members (excluding the actor),
 * but ONLY if a run is currently open. Template edits during prep are silent;
 * template edits during service are loud. Spec §12.1.
 */
export async function notifyTemplateChangeIfRunOpen(params: {
  multimediaMinistryId: string;
  templateId: string;
  actorUserId: string;
  actorName: string;
}): Promise<void> {
  const openRun = await prisma.checklistRun.findFirst({
    where: { templateId: params.templateId, closedAt: null },
    select: { id: true },
  });
  if (!openRun) return;

  const recipients = await getTemplateChangeRecipients(
    params.multimediaMinistryId,
    params.actorUserId
  );
  if (recipients.length === 0) return;

  await createNotificationsForUserIds(recipients, {
    type: "checklist_template_changed",
    title: "Multimedia checklist updated",
    body: `Template updated by ${params.actorName}`,
    link: "/checklist",
    ministryId: params.multimediaMinistryId,
  }).catch(() => {});
}
