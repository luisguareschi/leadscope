import type { AppContext } from "../../context.js";
import { parseCompanyConfig } from "../../companies/company-config.js";
import { isSystemStage } from "../../engine/stages.js";
import type { Prisma } from "../../generated/prisma/client.js";
import type { MetricsRange } from "./metrics-range.js";
import {
  mergeAnthropicSpend,
  roundUsd,
  whatsappSpend,
  type DetailedAnthropicSpend,
  type ModelUsage,
  type WhatsappSpend,
} from "./pricing.js";
import { eachDate, localParts, zonedDayStart } from "./time-zone.js";

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

const MIN_DAYS_FOR_PROJECTION = 3;

export const metricsCompanySelect = {
  id: true,
  name: true,
  slug: true,
  config: true,
  hubspotEnabled: true,
  assistantPaused: true,
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
  disqualified: number;
  no_response: number;
};

export type AdvisorMetrics = {
  operatorId: string;
  email: string;
  assigned: number;
  pendingOver24h: number;
  contactedInRange: number;
  medianMinutesToContact: number | null;
};

export type FieldCompletionMetric = {
  key: string;
  name: string;
  required: boolean;
  collected: number;
  rate: number | null;
};

export type CompanyMetrics = {
  company: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
    assistantPaused: boolean;
  };
  range: { from: string; to: string; days: number };
  generatedAt: string;
  leads: number;
  leadsBySource: { whatsapp: number; form: number };
  leadsPerDay: DayRow[];
  funnel: {
    leads: number;
    qualified: number;
    qualificationRate: number | null;
    contacted: number;
    contactedRate: number | null;
    qualifying: number;
    toContact: number;
    notInterested: number;
    notInterestedRate: number | null;
    disqualified: number;
    noResponse: number;
  };
  forms: {
    leads: number;
    replied: number;
    replyRate: number | null;
  };
  outOfHours: number;
  outOfHoursRate: number | null;
  timeToContact: {
    count: number;
    medianMinutes: number | null;
    p90Minutes: number | null;
  };
  advisors: AdvisorMetrics[];
  assistant: {
    autonomousLeads: number;
    autonomyRate: number | null;
    nonTextLeads: number;
    nonTextRate: number | null;
    nonTextMessages: number;
    failedOutboundMessages: number;
    fieldCompletion: FieldCompletionMetric[];
  };
  queue: {
    toContact: number;
    unassigned: number;
    unassignedOver24h: number;
    oldestWaitingMinutes: number | null;
  };
  needsHuman: {
    total: number;
    pausedManually: number;
    byReason: Record<string, number>;
  };
  knowledge: {
    files: number;
    lastUploadAt: string | null;
    daysSinceLastUpload: number | null;
  };
  hubspot: { enabled: boolean; pending: number; failing: number };
  spend: {
    anthropic: DetailedAnthropicSpend;
    whatsapp: WhatsappSpend & { currentMonthTotalMessages: number };
    totalUsd: number;
    projectedMonthlyUsd: number | null;
    perLeadUsd: number | null;
    anthropicPerLeadUsd: number | null;
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
    disqualified: 0,
    no_response: 0,
  };
}

function nextMonthStartDate(month: string): string {
  const year = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  if (m === 12) return `${year + 1}-01-01`;
  return `${year}-${String(m + 1).padStart(2, "0")}-01`;
}

function hasCollectedValue(collected: unknown, key: string): boolean {
  if (!collected || typeof collected !== "object" || Array.isArray(collected)) {
    return false;
  }
  const value = (collected as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim().length > 0;
}

type LlmGroupRow = {
  model: string;
  _count: { _all: number };
  _sum: {
    inputTokens: number | null;
    outputTokens: number | null;
    cacheReadTokens: number | null;
    cacheWriteTokens: number | null;
  };
};

function toModelUsage(rows: LlmGroupRow[]): ModelUsage[] {
  return rows.map((row) => ({
    model: row.model,
    calls: row._count._all,
    inputTokens: row._sum.inputTokens ?? 0,
    outputTokens: row._sum.outputTokens ?? 0,
    cacheReadTokens: row._sum.cacheReadTokens ?? 0,
    cacheWriteTokens: row._sum.cacheWriteTokens ?? 0,
  }));
}

function elapsedCalendarDays(
  from: string,
  to: string,
  todayStr: string,
): number {
  if (from > todayStr) return 0;
  const effectiveTo = to < todayStr ? to : todayStr;
  return (
    Math.round(
      (Date.parse(`${effectiveTo}T00:00:00Z`) -
        Date.parse(`${from}T00:00:00Z`)) /
        86_400_000,
    ) + 1
  );
}

export async function computeCompanyMetrics(
  ctx: AppContext,
  company: MetricsCompany,
  range: MetricsRange,
): Promise<CompanyMetrics> {
  const config = parseCompanyConfig(company.config);
  const timeZone = config.timezone;
  const now = ctx.now();
  const todayStr = localParts(now, timeZone).dateStr;
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
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  // Status is null until Meta reports one; `NOT { status: "failed" }` would drop those rows in SQL.
  const notFailed = {
    OR: [{ status: null }, { status: { not: "failed" } }],
  } satisfies Prisma.MessageWhereInput;
  const countMessages = (where: Prisma.MessageWhereInput) =>
    ctx.db.message.count({ where: { AND: [sentInRange, where] } });

  const firstMonth = range.from.slice(0, 7);
  const firstMonthStart = zonedDayStart(`${firstMonth}-01`, timeZone);
  const currentMonth = todayStr.slice(0, 7);
  const currentMonthStart = zonedDayStart(`${currentMonth}-01`, timeZone);
  const nextMonthStart = zonedDayStart(
    nextMonthStartDate(currentMonth),
    timeZone,
  );

  const llmSelect = {
    _sum: {
      inputTokens: true,
      outputTokens: true,
      cacheReadTokens: true,
      cacheWriteTokens: true,
    },
    _count: { _all: true },
  } as const;

  const [
    threads,
    contacts,
    activeOperators,
    assignedOpenThreads,
    toContact,
    unassigned,
    unassignedOver24h,
    oldestWaiting,
    needsHumanRows,
    pausedManually,
    failedOutboundMessages,
    billableTemplates,
    serviceSends,
    priorServiceInFirstMonth,
    currentMonthTotalMessages,
    knowledgeCount,
    knowledgeLatest,
    hubspotCounts,
    realUsageRows,
    testUsageRows,
  ] = await Promise.all([
    ctx.db.thread.findMany({
      where: createdInRange,
      select: {
        id: true,
        createdAt: true,
        stage: true,
        source: true,
        handedOffAt: true,
        paused: true,
        needsHuman: true,
        collected: true,
      },
    }),
    ctx.db.thread.findMany({
      where: {
        companyId: company.id,
        contactedAt: { gte: range.start, lt: range.end },
      },
      select: { contactedAt: true, handedOffAt: true, contactedById: true },
    }),
    ctx.db.operator.findMany({
      where: { companyId: company.id, archivedAt: null },
      select: { id: true, email: true },
    }),
    ctx.db.thread.findMany({
      where: {
        companyId: company.id,
        stage: "to_contact",
        assignedToId: { not: null },
      },
      select: { assignedToId: true, handedOffAt: true },
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
    ctx.db.thread.count({
      where: { companyId: company.id, paused: true, needsHuman: false },
    }),
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
    firstMonthStart < range.start
      ? ctx.db.message.count({
          where: {
            AND: [
              {
                companyId: company.id,
                sentAt: { gte: firstMonthStart, lt: range.start },
                direction: "outbound",
                NOT: { type: "template" },
              },
              notFailed,
            ],
          },
        })
      : Promise.resolve(0),
    ctx.db.message.count({
      where: {
        AND: [
          {
            companyId: company.id,
            sentAt: { gte: currentMonthStart, lt: nextMonthStart },
          },
          notFailed,
        ],
      },
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
        threadId: { not: null },
      },
      ...llmSelect,
    }),
    ctx.db.llmUsage.groupBy({
      by: ["model"],
      where: {
        companyId: company.id,
        createdAt: { gte: range.start, lt: range.end },
        threadId: null,
      },
      ...llmSelect,
    }),
  ]);

  const cohortThreadIds = threads.map((thread) => thread.id);
  const formThreadIds = threads
    .filter((thread) => thread.source === "form")
    .map((thread) => thread.id);

  const [formReplies, advisorReplies, nonTextRows] = await Promise.all([
    formThreadIds.length > 0
      ? ctx.db.message.groupBy({
          by: ["threadId"],
          where: {
            companyId: company.id,
            threadId: { in: formThreadIds },
            direction: "inbound",
          },
        })
      : Promise.resolve([]),
    cohortThreadIds.length > 0
      ? ctx.db.message.groupBy({
          by: ["threadId"],
          where: {
            companyId: company.id,
            threadId: { in: cohortThreadIds },
            direction: "outbound",
            sentByEmail: { not: null },
          },
        })
      : Promise.resolve([]),
    cohortThreadIds.length > 0
      ? ctx.db.message.groupBy({
          by: ["threadId"],
          where: {
            companyId: company.id,
            threadId: { in: cohortThreadIds },
            direction: "inbound",
            NOT: { type: "text" },
          },
          _count: { _all: true },
        })
      : Promise.resolve([]),
  ]);

  const advisorRepliedSet = new Set(advisorReplies.map((row) => row.threadId));
  const days = new Map<string, DayRow>(
    eachDate(range.from, range.to).map((date) => [date, emptyDay(date)]),
  );
  const leadsBySource = { whatsapp: 0, form: 0 };
  const fieldCounts = new Map<string, number>(
    config.collect.map((item) => [item.key, 0]),
  );
  let qualified = 0;
  let contacted = 0;
  let qualifying = 0;
  let toContactInCohort = 0;
  let notInterested = 0;
  let disqualified = 0;
  let noResponse = 0;
  let outOfHours = 0;
  let autonomousLeads = 0;

  for (const thread of threads) {
    leadsBySource[thread.source] += 1;
    const day = days.get(localParts(thread.createdAt, timeZone).dateStr);
    if (day) {
      if (
        thread.stage === "qualifying" ||
        thread.stage === "to_contact" ||
        thread.stage === "contacted" ||
        thread.stage === "not_interested" ||
        thread.stage === "disqualified" ||
        thread.stage === "no_response"
      ) {
        day[thread.stage] += 1;
      } else {
        // Custom sales pipeline stages count under contacted in the stacked chart.
        day.contacted += 1;
      }
    }
    if (
      thread.handedOffAt !== null ||
      thread.stage === "to_contact" ||
      thread.stage === "contacted" ||
      !isSystemStage(thread.stage)
    ) {
      qualified += 1;
    }
    if (thread.stage === "contacted" || !isSystemStage(thread.stage))
      contacted += 1;
    else if (thread.stage === "qualifying") qualifying += 1;
    else if (thread.stage === "to_contact") toContactInCohort += 1;
    else if (thread.stage === "not_interested") notInterested += 1;
    else if (thread.stage === "disqualified") disqualified += 1;
    else if (thread.stage === "no_response") noResponse += 1;

    if (isOutOfHours(thread.createdAt, timeZone)) outOfHours += 1;
    if (
      !thread.needsHuman &&
      !thread.paused &&
      !advisorRepliedSet.has(thread.id)
    ) {
      autonomousLeads += 1;
    }
    for (const item of config.collect) {
      if (hasCollectedValue(thread.collected, item.key)) {
        fieldCounts.set(item.key, (fieldCounts.get(item.key) ?? 0) + 1);
      }
    }
  }
  const leads = threads.length;
  const nonTextLeads = nonTextRows.length;
  const nonTextMessages = nonTextRows.reduce(
    (sum, row) => sum + row._count._all,
    0,
  );

  const waitedMinutes: number[] = [];
  const advisorMap = new Map<
    string,
    {
      operatorId: string;
      email: string;
      assigned: number;
      pendingOver24h: number;
      contactedInRange: number;
      waits: number[];
    }
  >(
    activeOperators.map((operator) => [
      operator.id,
      {
        operatorId: operator.id,
        email: operator.email,
        assigned: 0,
        pendingOver24h: 0,
        contactedInRange: 0,
        waits: [],
      },
    ]),
  );

  for (const open of assignedOpenThreads) {
    if (!open.assignedToId) continue;
    const entry = advisorMap.get(open.assignedToId);
    if (!entry) continue;
    entry.assigned += 1;
    if (open.handedOffAt !== null && open.handedOffAt < dayAgo) {
      entry.pendingOver24h += 1;
    }
  }

  for (const contact of contacts) {
    const entry = contact.contactedById
      ? advisorMap.get(contact.contactedById)
      : undefined;
    if (entry) entry.contactedInRange += 1;
    if (!contact.contactedAt || !contact.handedOffAt) continue;
    if (contact.contactedAt < contact.handedOffAt) continue;
    const minutes = minutesBetween(contact.contactedAt, contact.handedOffAt);
    waitedMinutes.push(minutes);
    if (entry) entry.waits.push(minutes);
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

  const advisors: AdvisorMetrics[] = [...advisorMap.values()]
    .map((entry) => {
      const sorted = [...entry.waits].sort((a, b) => a - b);
      return {
        operatorId: entry.operatorId,
        email: entry.email,
        assigned: entry.assigned,
        pendingOver24h: entry.pendingOver24h,
        contactedInRange: entry.contactedInRange,
        medianMinutesToContact: nearestRank(sorted, 50),
      };
    })
    .sort(
      (a, b) =>
        b.contactedInRange - a.contactedInRange ||
        b.assigned - a.assigned ||
        a.email.localeCompare(b.email),
    );

  const byReason: Record<string, number> = {};
  for (const row of needsHumanRows) {
    const category = reasonCategory(row.needsHumanReason);
    byReason[category] = (byReason[category] ?? 0) + 1;
  }

  const lastUploadAt = knowledgeLatest._max.updatedAt;
  const anthropic = mergeAnthropicSpend(
    toModelUsage(realUsageRows),
    toModelUsage(testUsageRows),
  );
  const whatsapp = {
    ...whatsappSpend(
      billableTemplates,
      serviceSends.map((message) => message.sentAt),
      timeZone,
      { firstMonth, priorServiceInFirstMonth },
    ),
    currentMonthTotalMessages,
  };
  const rawTotalUsd = (anthropic.usd ?? 0) + whatsapp.usd;
  const totalUsd = roundUsd(rawTotalUsd);
  const elapsedDays = elapsedCalendarDays(range.from, range.to, todayStr);
  const projectedMonthlyUsd =
    elapsedDays < MIN_DAYS_FOR_PROJECTION
      ? null
      : roundUsd((rawTotalUsd / elapsedDays) * 30);

  return {
    company: {
      id: company.id,
      name: company.name,
      slug: company.slug,
      timezone: timeZone,
      assistantPaused: company.assistantPaused,
    },
    range: { from: range.from, to: range.to, days: range.days },
    generatedAt: now.toISOString(),
    leads,
    leadsBySource,
    leadsPerDay: [...days.values()],
    funnel: {
      leads,
      qualified,
      qualificationRate: rate(qualified, leads),
      contacted,
      contactedRate: rate(contacted, qualified),
      qualifying,
      toContact: toContactInCohort,
      notInterested,
      notInterestedRate: rate(notInterested, leads),
      disqualified,
      noResponse,
    },
    forms: {
      leads: formThreadIds.length,
      replied: formReplies.length,
      replyRate: rate(formReplies.length, formThreadIds.length),
    },
    outOfHours,
    outOfHoursRate: rate(outOfHours, leads),
    timeToContact,
    advisors,
    assistant: {
      autonomousLeads,
      autonomyRate: rate(autonomousLeads, leads),
      nonTextLeads,
      nonTextRate: rate(nonTextLeads, leads),
      nonTextMessages,
      failedOutboundMessages,
      fieldCompletion: config.collect.map((item) => {
        const collected = fieldCounts.get(item.key) ?? 0;
        return {
          key: item.key,
          name: item.name,
          required: item.required,
          collected,
          rate: rate(collected, leads),
        };
      }),
    },
    queue: {
      toContact,
      unassigned,
      unassignedOver24h,
      oldestWaitingMinutes:
        oldestWaiting?.handedOffAt == null
          ? null
          : Math.floor(
              (now.getTime() - oldestWaiting.handedOffAt.getTime()) / 60_000,
            ),
    },
    needsHuman: {
      total: needsHumanRows.length,
      pausedManually,
      byReason,
    },
    knowledge: {
      files: knowledgeCount,
      lastUploadAt: lastUploadAt ? lastUploadAt.toISOString() : null,
      daysSinceLastUpload:
        lastUploadAt === null
          ? null
          : Math.floor((now.getTime() - lastUploadAt.getTime()) / 86_400_000),
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
      projectedMonthlyUsd,
      perLeadUsd:
        leads > 0 ? ((anthropic.realUsd ?? 0) + whatsapp.usd) / leads : null,
      anthropicPerLeadUsd:
        leads > 0 && anthropic.realUsd !== null
          ? anthropic.realUsd / leads
          : null,
    },
  };
}
