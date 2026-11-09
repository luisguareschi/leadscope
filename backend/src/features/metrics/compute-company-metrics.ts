import { CALL_NOW_TIME } from "../../engine/turn.js";
import type { AppContext } from "../../context.js";
import { parseCompanyConfig } from "../../companies/company-config.js";
import type { Prisma } from "../../generated/prisma/client.js";
import type { MetricsRange } from "./metrics-range.js";
import {
  anthropicSpend,
  roundUsd,
  whatsappSpend,
  type AnthropicSpend,
  type WhatsappSpend,
} from "./pricing.js";
import { eachDate, eachWeekStart, localParts, weekStart } from "./time-zone.js";

/**
 * `config.businessHours` is free text, so "Fuera de horario" uses this fixed
 * window for every company: weekdays 09:00 inclusive to 18:00 exclusive, in
 * the company timezone. Saturday, Sunday, and 18:00 itself count as out.
 */
export const OFFICE_HOURS = {
  startHour: 9,
  endHour: 18,
  weekdays: [1, 2, 3, 4, 5],
} as const;

const OFFICE_WEEKDAYS = new Set<number>(OFFICE_HOURS.weekdays);

const NEEDS_HUMAN_REASONS = new Set([
  "forbidden_topic",
  "model_failure",
  "send_failed",
  "lead_needs_human",
  "empty_reply",
  "channel_unavailable",
]);

export const metricsCompanySelect = {
  id: true,
  name: true,
  slug: true,
  config: true,
  hubspotEnabled: true,
  archivedAt: true,
} satisfies Prisma.CompanySelect;

export type MetricsCompany = Prisma.CompanyGetPayload<{
  select: typeof metricsCompanySelect;
}>;

type DayRow = {
  date: string;
  qualifying: number;
  to_contact: number;
  contacted: number;
  not_interested: number;
};

export type CompanyMetrics = {
  company: { id: string; name: string; slug: string; timezone: string };
  range: { from: string; to: string };
  generatedAt: string;
  leads: number;
  leadsBySource: { whatsapp: number; form: number };
  leadsPerDay: DayRow[];
  qualified: number;
  qualificationRate: number | null;
  notInterested: number;
  notInterestedRate: number | null;
  callNow: number;
  outOfHours: number;
  outOfHoursRate: number | null;
  timeToContact: {
    count: number;
    medianMinutes: number | null;
    p90Minutes: number | null;
  };
  timeToContactPerWeek: {
    weekStart: string;
    count: number;
    medianMinutes: number | null;
  }[];
  queue: {
    toContact: number;
    unassigned: number;
    unassignedOver24h: number;
    oldestWaitingMinutes: number | null;
  };
  needsHuman: { total: number; byReason: Record<string, number> };
  messages: {
    inbound: number;
    assistant: number;
    advisor: number;
    templates: number;
    failed: number;
  };
  knowledge: {
    files: number;
    lastUploadAt: string | null;
    daysSinceLastUpload: number | null;
  };
  hubspot: { enabled: boolean; pending: number; failing: number };
  spend: {
    anthropic: AnthropicSpend;
    whatsapp: WhatsappSpend;
    totalUsd: number;
    perLeadUsd: number | null;
  };
};

function rate(part: number, whole: number): number | null {
  return whole === 0 ? null : part / whole;
}

function isOutOfHours(date: Date, timeZone: string): boolean {
  const { weekday, hour } = localParts(date, timeZone);
  if (!OFFICE_WEEKDAYS.has(weekday)) return true;
  return hour < OFFICE_HOURS.startHour || hour >= OFFICE_HOURS.endHour;
}

/** Nearest-rank percentile. `percentile` is 0–100; the list is sorted ascending. */
function nearestRank(sorted: number[], percentile: number): number | null {
  if (sorted.length === 0) return null;
  const rank = Math.ceil((percentile / 100) * sorted.length);
  const index = Math.min(sorted.length, Math.max(rank, 1)) - 1;
  return sorted[index] ?? null;
}

function minutesBetween(later: Date, earlier: Date): number {
  return Math.round((later.getTime() - earlier.getTime()) / 60_000);
}

function reasonCategory(reason: string | null): string {
  const category = reason?.split(":")[0]?.trim() ?? "";
  return NEEDS_HUMAN_REASONS.has(category) ? category : "other";
}

function emptyDay(date: string): DayRow {
  return {
    date,
    qualifying: 0,
    to_contact: 0,
    contacted: 0,
    not_interested: 0,
  };
}

export async function computeCompanyMetrics(
  ctx: AppContext,
  company: MetricsCompany,
  range: MetricsRange,
): Promise<CompanyMetrics> {
  const timeZone = parseCompanyConfig(company.config).timezone;
  const createdInRange = {
    companyId: company.id,
    createdAt: { gte: range.start, lt: range.end },
  };
  const sentInRange = {
    companyId: company.id,
    sentAt: { gte: range.start, lt: range.end },
  };
  const unassignedToContact = {
    companyId: company.id,
    stage: "to_contact" as const,
    assignedToId: null,
  };
  const dayAgo = new Date(ctx.now().getTime() - 24 * 60 * 60 * 1000);
  // Status is null until Meta reports one; `NOT { status: "failed" }` would drop those rows in SQL.
  const notFailed = {
    OR: [{ status: null }, { status: { not: "failed" } }],
  } satisfies Prisma.MessageWhereInput;
  const countMessages = (where: Prisma.MessageWhereInput) =>
    ctx.db.message.count({ where: { AND: [sentInRange, where] } });

  const [
    threads,
    contacts,
    toContact,
    unassigned,
    unassignedOver24h,
    oldestWaiting,
    needsHumanRows,
    inbound,
    assistant,
    advisor,
    templates,
    failed,
    billableTemplates,
    serviceSends,
    knowledgeCount,
    knowledgeLatest,
    hubspotCounts,
    usageRows,
  ] = await Promise.all([
    ctx.db.thread.findMany({
      where: createdInRange,
      select: {
        createdAt: true,
        stage: true,
        source: true,
        handedOffAt: true,
        callTime: true,
      },
    }),
    ctx.db.thread.findMany({
      where: {
        companyId: company.id,
        contactedAt: { gte: range.start, lt: range.end },
        handedOffAt: { not: null },
      },
      select: { contactedAt: true, handedOffAt: true },
    }),
    ctx.db.thread.count({
      where: { companyId: company.id, stage: "to_contact" },
    }),
    ctx.db.thread.count({ where: unassignedToContact }),
    ctx.db.thread.count({
      where: { ...unassignedToContact, handedOffAt: { lt: dayAgo } },
    }),
    ctx.db.thread.findFirst({
      where: { ...unassignedToContact, handedOffAt: { not: null } },
      orderBy: { handedOffAt: "asc" },
      select: { handedOffAt: true },
    }),
    ctx.db.thread.findMany({
      where: { companyId: company.id, needsHuman: true },
      select: { needsHumanReason: true },
    }),
    countMessages({ direction: "inbound" }),
    countMessages({
      direction: "outbound",
      NOT: { type: "template" },
      sentByEmail: null,
    }),
    countMessages({ direction: "outbound", sentByEmail: { not: null } }),
    countMessages({ direction: "outbound", type: "template" }),
    countMessages({ direction: "outbound", status: "failed" }),
    countMessages({
      direction: "outbound",
      type: "template",
      ...notFailed,
    }),
    ctx.db.message.findMany({
      where: {
        AND: [
          sentInRange,
          { direction: "outbound" },
          { NOT: { type: "template" } },
          notFailed,
        ],
      },
      select: { sentAt: true },
    }),
    ctx.db.knowledgeFile.count({ where: { companyId: company.id } }),
    ctx.db.knowledgeFile.aggregate({
      where: { companyId: company.id },
      _max: { updatedAt: true },
    }),
    company.hubspotEnabled === true
      ? Promise.all([
          ctx.db.thread.count({
            where: { companyId: company.id, crmPendingAction: { not: null } },
          }),
          ctx.db.thread.count({
            where: {
              companyId: company.id,
              crmPendingAction: { not: null },
              crmLastError: { not: null },
            },
          }),
        ])
      : Promise.resolve([0, 0] as const),
    ctx.db.llmUsage.groupBy({
      by: ["model"],
      where: {
        companyId: company.id,
        createdAt: { gte: range.start, lt: range.end },
      },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        cacheReadTokens: true,
        cacheWriteTokens: true,
      },
      _count: { _all: true },
    }),
  ]);

  const days = new Map<string, DayRow>(
    eachDate(range.from, range.to).map((date) => [date, emptyDay(date)]),
  );
  const leadsBySource = { whatsapp: 0, form: 0 };
  let qualified = 0;
  let notInterested = 0;
  let callNow = 0;
  let outOfHours = 0;
  for (const thread of threads) {
    leadsBySource[thread.source] += 1;
    const day = days.get(localParts(thread.createdAt, timeZone).dateStr);
    if (day) day[thread.stage] += 1;
    if (
      thread.handedOffAt !== null ||
      thread.stage === "to_contact" ||
      thread.stage === "contacted"
    ) {
      qualified += 1;
    }
    if (thread.stage === "not_interested") notInterested += 1;
    if (thread.callTime === CALL_NOW_TIME) callNow += 1;
    if (isOutOfHours(thread.createdAt, timeZone)) outOfHours += 1;
  }
  const leads = threads.length;

  const waitedMinutes: number[] = [];
  const minutesByWeek = new Map<string, number[]>(
    eachWeekStart(range.from, range.to, timeZone).map((start) => [start, []]),
  );
  for (const contact of contacts) {
    if (!contact.contactedAt || !contact.handedOffAt) continue;
    if (contact.contactedAt < contact.handedOffAt) continue;
    const minutes = minutesBetween(contact.contactedAt, contact.handedOffAt);
    waitedMinutes.push(minutes);
    minutesByWeek.get(weekStart(contact.contactedAt, timeZone))?.push(minutes);
  }
  waitedMinutes.sort((a, b) => a - b);
  const timeToContact =
    waitedMinutes.length === 0
      ? { count: 0, medianMinutes: null, p90Minutes: null }
      : {
          count: waitedMinutes.length,
          medianMinutes: nearestRank(waitedMinutes, 50),
          p90Minutes: nearestRank(waitedMinutes, 90),
        };

  const byReason: Record<string, number> = {};
  for (const row of needsHumanRows) {
    const category = reasonCategory(row.needsHumanReason);
    byReason[category] = (byReason[category] ?? 0) + 1;
  }

  const lastUploadAt = knowledgeLatest._max.updatedAt;
  const anthropic = anthropicSpend(
    usageRows.map((row) => ({
      model: row.model,
      calls: row._count._all,
      inputTokens: row._sum.inputTokens ?? 0,
      outputTokens: row._sum.outputTokens ?? 0,
      cacheReadTokens: row._sum.cacheReadTokens ?? 0,
      cacheWriteTokens: row._sum.cacheWriteTokens ?? 0,
    })),
  );
  const whatsapp = whatsappSpend(
    billableTemplates,
    serviceSends.map((message) => message.sentAt),
    timeZone,
  );
  const totalUsd = roundUsd((anthropic.usd ?? 0) + whatsapp.usd);

  return {
    company: {
      id: company.id,
      name: company.name,
      slug: company.slug,
      timezone: timeZone,
    },
    range: { from: range.from, to: range.to },
    generatedAt: ctx.now().toISOString(),
    leads,
    leadsBySource,
    leadsPerDay: [...days.values()],
    qualified,
    qualificationRate: rate(qualified, leads),
    notInterested,
    notInterestedRate: rate(notInterested, leads),
    callNow,
    outOfHours,
    outOfHoursRate: rate(outOfHours, leads),
    timeToContact,
    timeToContactPerWeek: [...minutesByWeek.entries()].map(
      ([start, minutes]) => ({
        weekStart: start,
        count: minutes.length,
        medianMinutes:
          minutes.length === 0
            ? null
            : nearestRank(
                [...minutes].sort((a, b) => a - b),
                50,
              ),
      }),
    ),
    queue: {
      toContact,
      unassigned,
      unassignedOver24h,
      oldestWaitingMinutes:
        oldestWaiting?.handedOffAt == null
          ? null
          : Math.floor(
              (ctx.now().getTime() - oldestWaiting.handedOffAt.getTime()) /
                60_000,
            ),
    },
    needsHuman: { total: needsHumanRows.length, byReason },
    messages: { inbound, assistant, advisor, templates, failed },
    knowledge: {
      files: knowledgeCount,
      lastUploadAt: lastUploadAt ? lastUploadAt.toISOString() : null,
      daysSinceLastUpload:
        lastUploadAt === null
          ? null
          : Math.floor(
              (ctx.now().getTime() - lastUploadAt.getTime()) / 86_400_000,
            ),
    },
    hubspot: {
      enabled: company.hubspotEnabled === true,
      pending: hubspotCounts[0],
      failing: hubspotCounts[1],
    },
    spend: {
      anthropic,
      whatsapp,
      totalUsd,
      perLeadUsd: leads > 0 ? totalUsd / leads : null,
    },
  };
}
