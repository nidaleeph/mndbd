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
