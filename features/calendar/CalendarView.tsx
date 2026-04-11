"use client";

import { useState } from "react";
import Link from "next/link";

interface CalendarEvent {
  id: string;
  type: "lineup" | "arf";
  title: string;
  date: Date | string;
  ministryName: string;
}

export function CalendarView({ events }: { events: CalendarEvent[] }) {
  const [current, setCurrent] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const start = new Date(current.year, current.month, 1);
  const end = new Date(current.year, current.month + 1, 0);
  const startDay = start.getDay();
  const daysInMonth = end.getDate();
  const days = Array.from({ length: 42 }, (_, i) => {
    const offset = i - startDay;
    if (offset < 0) return null;
    if (offset >= daysInMonth) return null;
    return offset + 1;
  });

  const eventsByDay: Record<string, CalendarEvent[]> = {};
  events.forEach((ev) => {
    const d = typeof ev.date === "string" ? new Date(ev.date) : ev.date;
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!eventsByDay[key]) eventsByDay[key] = [];
    eventsByDay[key].push(ev);
  });

  function prevMonth() {
    setCurrent((c) =>
      c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 }
    );
  }
  function nextMonth() {
    setCurrent((c) =>
      c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 }
    );
  }

  // custom format — not in lib/dates.ts
  const monthLabel = new Date(current.year, current.month).toLocaleString("default", {
    timeZone: "Asia/Manila",
    month: "long",
    year: "numeric",
  });

  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--color-text-dark)]">{monthLabel}</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={prevMonth}
            className="rounded px-2 py-1 text-[var(--color-primary)] hover:bg-[var(--color-soft-blue-bg)]"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={nextMonth}
            className="rounded px-2 py-1 text-[var(--color-primary)] hover:bg-[var(--color-soft-blue-bg)]"
          >
            Next
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-sm">
        {weekdays.map((d) => (
          <div key={d} className="py-1 font-medium text-[var(--color-text-muted)]">
            {d}
          </div>
        ))}
        {days.map((day, i) => {
          if (day === null) {
            return <div key={`empty-${i}`} />;
          }
          const key = `${current.year}-${current.month}-${day}`;
          const dayEvents = eventsByDay[key] ?? [];
          return (
            <div key={key} className="min-h-[80px] rounded border border-gray-200 p-1 text-left">
              <span className="text-[var(--color-text-dark)]">{day}</span>
              <ul className="mt-1 space-y-0.5">
                {dayEvents.slice(0, 3).map((ev) => (
                  <li key={ev.id}>
                    <Link
                      href={
                        ev.type === "lineup"
                          ? `/dashboard/lineup/${ev.id}`
                          : `/dashboard/forms/arf/${ev.id}`
                      }
                      className="block truncate rounded bg-[var(--color-soft-blue-bg)] px-1 py-0.5 text-xs text-[var(--color-primary)] hover:underline"
                    >
                      {ev.title}
                    </Link>
                  </li>
                ))}
                {dayEvents.length > 3 && (
                  <li className="text-xs text-[var(--color-text-muted)]">
                    +{dayEvents.length - 3} more
                  </li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
