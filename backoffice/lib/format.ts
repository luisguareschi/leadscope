const LOCALE = "es-UY";

const relative = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
const numberFormat = new Intl.NumberFormat(LOCALE);
const timeFormat = new Intl.DateTimeFormat(LOCALE, { hour: "2-digit", minute: "2-digit" });
const dateTimeFormat = new Intl.DateTimeFormat(LOCALE, { dateStyle: "short", timeStyle: "short" });
const shortDateFormat = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short" });
const longDateFormat = new Intl.DateTimeFormat(LOCALE, { weekday: "long", day: "numeric", month: "long" });

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** "hace 5 minutos", "ayer", "3 oct" */
export function formatRelative(value: string | null, now = new Date()): string {
  if (!value) return "—";
  const date = new Date(value);
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  if (Math.abs(seconds) < 60) return "recién";
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return relative.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24 && startOfDay(date) === startOfDay(now)) return relative.format(hours, "hour");
  const days = Math.round((startOfDay(date) - startOfDay(now)) / 86_400_000);
  if (days === -1) return "ayer";
  return shortDateFormat.format(date);
}

export function formatTime(value: string): string {
  return timeFormat.format(new Date(value));
}

export function formatDateTime(value: string | null): string {
  return value ? dateTimeFormat.format(new Date(value)) : "—";
}

export function formatDayLabel(value: string, now = new Date()): string {
  const date = new Date(value);
  const days = Math.round((startOfDay(date) - startOfDay(now)) / 86_400_000);
  if (days === 0) return "Hoy";
  if (days === -1) return "Ayer";
  const label = longDateFormat.format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${numberFormat.format(Math.round(bytes / 102.4) / 10)} KB`;
  return `${numberFormat.format(Math.round(bytes / (1024 * 102.4)) / 10)} MB`;
}

/** +59899123456 → +598 99 123 456. Other countries are shown as stored. */
export function formatPhone(e164: string): string {
  const uruguay = /^\+598(\d{2})(\d{3})(\d{3})$/.exec(e164);
  return uruguay ? `+598 ${uruguay[1]} ${uruguay[2]} ${uruguay[3]}` : e164;
}

export function initials(value: string): string {
  const letters = value
    .replace(/@.*/, "")
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "");
  return letters.join("") || "?";
}
