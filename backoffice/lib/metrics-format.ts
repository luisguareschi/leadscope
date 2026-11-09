/** Fallback when the company timezone is not known yet. The comparison table uses this too. */
export const METRICS_FALLBACK_TIMEZONE = "America/Montevideo";

export const RANGE_PRESETS = [
  { id: "7d", label: "Últimos 7 días" },
  { id: "30d", label: "Últimos 30 días" },
  { id: "90d", label: "Últimos 90 días" },
  { id: "month", label: "Este mes" },
  { id: "prev-month", label: "Mes pasado" },
] as const;

export type RangePreset = (typeof RANGE_PRESETS)[number]["id"];

export function isRangePreset(value: string | null): value is RangePreset {
  return RANGE_PRESETS.some((preset) => preset.id === value);
}

const countFormat = new Intl.NumberFormat("es");
const percentFormat = new Intl.NumberFormat("es", {
  style: "percent",
  maximumFractionDigits: 1,
});
const usdFormat = new Intl.NumberFormat("es", {
  style: "currency",
  currency: "USD",
  currencyDisplay: "code",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const dayFormat = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const dayYearFormat = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatCount(value: number): string {
  return countFormat.format(value);
}

/** `rate` is 0..1. Null (no leads) is an em dash. */
export function formatPercent(rate: number | null): string {
  if (rate == null) return "—";
  return percentFormat.format(rate);
}

export function formatUsd(amount: number | null): string {
  if (amount == null) return "—";
  return usdFormat.format(amount);
}

/** `45 min`, `3 h 20 min`, `2 d 4 h`. */
export function formatDuration(minutes: number | null): string {
  if (minutes == null) return "—";
  const rounded = Math.max(0, Math.round(minutes));
  if (rounded < 60) return `${rounded} min`;
  const hoursTotal = Math.floor(rounded / 60);
  const mins = rounded % 60;
  if (hoursTotal < 24) {
    return mins === 0 ? `${hoursTotal} h` : `${hoursTotal} h ${mins} min`;
  }
  const days = Math.floor(hoursTotal / 24);
  const hours = hoursTotal % 24;
  return hours === 0 ? `${days} d` : `${days} d ${hours} h`;
}

/** Y-axis ticks for a duration stored in minutes and drawn in hours. */
export function formatHoursAxis(hours: number): string {
  const text = hours.toLocaleString("es", { maximumFractionDigits: 1 });
  return `${text} h`;
}

/** `date` is `YYYY-MM-DD`. Formatted as a calendar day, not an instant. */
export function formatDay(date: string, withYear = false): string {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return date;
  const utc = new Date(Date.UTC(year, month - 1, day));
  return (withYear ? dayYearFormat : dayFormat).format(utc);
}

export function formatRangeLabel(from: string, to: string): string {
  return `${formatDay(from, true)} – ${formatDay(to, true)}`;
}

/** "hoy", "hace 1 día", "hace 12 días". */
export function formatDaysAgo(days: number | null): string {
  if (days == null) return "—";
  if (days <= 0) return "hoy";
  if (days === 1) return "hace 1 día";
  return `hace ${countFormat.format(days)} días`;
}

export function leadsLabel(count: number): string {
  return count === 1 ? "1 lead" : `${formatCount(count)} leads`;
}

/** Today as `YYYY-MM-DD` in `timeZone`. */
export function zonedToday(timeZone: string, now = new Date()): string {
  let zone = timeZone;
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
  } catch {
    zone = METRICS_FALLBACK_TIMEZONE;
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
  }
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

/**
 * Inclusive calendar range for a preset, in `timeZone`.
 * `30d` is null: the request omits `from` and `to` so the API applies its own
 * default (30 days inclusive in the company timezone).
 */
export function rangeForPreset(
  preset: RangePreset,
  timeZone: string,
  now = new Date(),
): { from: string; to: string } | null {
  if (preset === "30d") return null;
  const today = zonedToday(timeZone, now);
  if (preset === "7d") return { from: addDays(today, -6), to: today };
  if (preset === "90d") return { from: addDays(today, -89), to: today };
  const monthStart = `${today.slice(0, 8)}01`;
  if (preset === "month") return { from: monthStart, to: today };
  const previousEnd = addDays(monthStart, -1);
  return { from: `${previousEnd.slice(0, 8)}01`, to: previousEnd };
}
