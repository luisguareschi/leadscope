import { z } from "zod";
import { badRequest } from "../../lib/http-error.js";
import { addCalendarDays, localParts, zonedDayStart } from "./time-zone.js";

/**
 * One timezone for the comparison table: day boundaries and the default range
 * use America/Montevideo. Each company's own timezone still decides its hours,
 * weeks, and WhatsApp months.
 */
export const COMPARISON_TIME_ZONE = "America/Montevideo";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const dayParam = z
  .string("Usa el formato AAAA-MM-DD.")
  .regex(DATE, "Usa el formato AAAA-MM-DD.");

export const metricsRangeQuerySchema = z.object({
  from: dayParam.optional(),
  to: dayParam.optional(),
});

export const companiesMetricsQuerySchema = metricsRangeQuerySchema.extend({
  status: z
    .enum(["active", "all"], "El estado tiene que ser active o all.")
    .default("active"),
});

export type MetricsRangeQuery = z.infer<typeof metricsRangeQuerySchema>;
export type CompaniesMetricsQuery = z.infer<typeof companiesMetricsQuerySchema>;

export type MetricsRange = {
  from: string;
  to: string;
  /** Inclusive UTC instant of 00:00 on `from` in the range's timezone. */
  start: Date;
  /** Exclusive UTC instant of 00:00 on the day after `to`. */
  end: Date;
};

const DEFAULT_INCLUSIVE_DAYS = 30;
const MAX_INCLUSIVE_DAYS = 366;

export function parseMetricsInput<T extends z.ZodType>(
  schema: T,
  value: unknown,
): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw badRequest(result.error.issues[0]?.message ?? "Datos inválidos.");
  }
  return result.data;
}

function isRealCalendarDate(dateStr: string): boolean {
  if (!DATE.test(dateStr)) return false;
  const year = Number(dateStr.slice(0, 4));
  const month = Number(dateStr.slice(5, 7));
  const day = Number(dateStr.slice(8, 10));
  const utc = new Date(Date.UTC(year, month - 1, day));
  return (
    utc.getUTCFullYear() === year &&
    utc.getUTCMonth() === month - 1 &&
    utc.getUTCDate() === day
  );
}

/**
 * `to` defaults to today in `timeZone`. `from` defaults to 29 days earlier,
 * so the range is 30 days inclusive. Both ends are calendar days in that zone.
 */
export function resolveMetricsRange(
  query: MetricsRangeQuery,
  timeZone: string,
  now: Date,
): MetricsRange {
  const to = query.to ?? localParts(now, timeZone).dateStr;
  const from = query.from ?? addCalendarDays(to, -(DEFAULT_INCLUSIVE_DAYS - 1));
  if (!isRealCalendarDate(from) || !isRealCalendarDate(to)) {
    throw badRequest("La fecha no existe.");
  }
  if (from > to) {
    throw badRequest(
      "La fecha inicial tiene que ser anterior o igual a la final.",
    );
  }
  const span =
    Math.round(
      (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
        86_400_000,
    ) + 1;
  if (span > MAX_INCLUSIVE_DAYS) {
    throw badRequest("El período no puede superar 366 días.");
  }
  return {
    from,
    to,
    start: zonedDayStart(from, timeZone),
    end: zonedDayStart(addCalendarDays(to, 1), timeZone),
  };
}
