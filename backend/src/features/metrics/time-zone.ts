export type LocalParts = {
  dateStr: string;
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number;
  /** 0–23. */
  hour: number;
};

const WEEKDAYS: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

type WallClock = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
};

function wallClock(date: Date, timeZone: string): WallClock {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
  }).formatToParts(date);
  const part: Record<string, string> = {};
  for (const piece of formatted) {
    if (piece.type !== "literal") part[piece.type] = piece.value;
  }
  let hour = Number(part.hour);
  // Some engines still report midnight as 24 with hourCycle h23.
  if (hour === 24) hour = 0;
  const weekday = WEEKDAYS[part.weekday ?? ""];
  if (weekday === undefined) {
    throw new Error(`Unknown weekday from ${timeZone}: ${part.weekday}`);
  }
  return {
    year: Number(part.year),
    month: Number(part.month),
    day: Number(part.day),
    hour,
    minute: Number(part.minute),
    second: Number(part.second),
    weekday,
  };
}

/** Milliseconds to add to this UTC instant to reach the zone's wall clock. */
function offsetMs(date: Date, timeZone: string): number {
  const clock = wallClock(date, timeZone);
  const asUtc = Date.UTC(
    clock.year,
    clock.month - 1,
    clock.day,
    clock.hour,
    clock.minute,
    clock.second,
  );
  return asUtc - date.getTime();
}

/**
 * UTC instant of 00:00 on `dateStr` in `timeZone`. The offset is read from
 * `formatToParts` and applied once more at the candidate instant, which is
 * enough to land on the right side of a DST change.
 */
export function zonedDayStart(dateStr: string, timeZone: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) throw new Error(`Invalid date: ${dateStr}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utcMidnight = Date.UTC(year, month - 1, day);
  const firstOffset = offsetMs(new Date(utcMidnight), timeZone);
  let instant = new Date(utcMidnight - firstOffset);
  const secondOffset = offsetMs(instant, timeZone);
  if (secondOffset !== firstOffset) {
    instant = new Date(utcMidnight - secondOffset);
  }
  return instant;
}

export function localParts(date: Date, timeZone: string): LocalParts {
  const clock = wallClock(date, timeZone);
  const month = String(clock.month).padStart(2, "0");
  const day = String(clock.day).padStart(2, "0");
  return {
    dateStr: `${clock.year}-${month}-${day}`,
    weekday: clock.weekday,
    hour: clock.hour,
  };
}

export function addCalendarDays(dateStr: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) throw new Error(`Invalid date: ${dateStr}`);
  const utc = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days),
  );
  return utc.toISOString().slice(0, 10);
}

export function eachDate(from: string, to: string): string[] {
  const dates: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    dates.push(cursor);
    cursor = addCalendarDays(cursor, 1);
  }
  return dates;
}

/** Monday of the ISO week that contains this instant, as YYYY-MM-DD in the zone. */
export function weekStart(date: Date, timeZone: string): string {
  const { dateStr, weekday } = localParts(date, timeZone);
  const sinceMonday = weekday === 0 ? 6 : weekday - 1;
  return addCalendarDays(dateStr, -sinceMonday);
}

/** Every Monday (company timezone) of a week that overlaps `from`…`to`. */
export function eachWeekStart(
  from: string,
  to: string,
  timeZone: string,
): string[] {
  const first = weekStart(zonedDayStart(from, timeZone), timeZone);
  const last = weekStart(zonedDayStart(to, timeZone), timeZone);
  const weeks: string[] = [];
  let cursor = first;
  while (cursor <= last) {
    weeks.push(cursor);
    cursor = addCalendarDays(cursor, 7);
  }
  return weeks;
}
