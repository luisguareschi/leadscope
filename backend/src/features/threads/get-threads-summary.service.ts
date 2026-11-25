import { parseCompanyConfig } from "../../companies/company-config.js";
import type { AppContext } from "../../context.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { BOT_FILTERS, botWhere, type BotActivity } from "./thread-dto.js";

const ACTIVITIES = BOT_FILTERS.filter(
  (bot): bot is BotActivity => bot !== "all",
);

/**
 * Counts for the filters. Stages include every stage configured on the company (plus any stage
 * key present on existing threads). `mine` is null for a platform admin in support access.
 */
export async function getThreadsSummary(
  ctx: AppContext,
  companyId: string,
  operatorId: string | null,
) {
  const count = (where: Prisma.ThreadWhereInput) =>
    ctx.db.thread.count({ where: { AND: [{ companyId }, where] } });
  const [company, total, unassignedToContact, groupedStages, bot, mine] =
    await Promise.all([
      ctx.db.company.findUnique({
        where: { id: companyId },
        select: { name: true, config: true },
      }),
      count({}),
      count({ stage: "to_contact", assignedToId: null }),
      ctx.db.thread.groupBy({
        by: ["stage"],
        where: { companyId },
        _count: { _all: true },
      }),
      Promise.all(ACTIVITIES.map((activity) => count(botWhere(activity)))),
      operatorId
        ? Promise.all([
            count({ assignedToId: operatorId }),
            count({ assignedToId: operatorId, stage: "to_contact" }),
          ])
        : null,
    ]);

  const stages: Record<string, number> = {};
  if (company) {
    const parsed = parseCompanyConfig(company.config, company.name);
    for (const stage of parsed.stages) stages[stage.key] = 0;
  }
  for (const row of groupedStages) {
    stages[row.stage] = row._count._all;
  }

  return {
    total,
    stages,
    bot: Object.fromEntries(
      ACTIVITIES.map((activity, index) => [activity, bot[index] ?? 0]),
    ) as Record<BotActivity, number>,
    mine: mine ? { all: mine[0], toContact: mine[1] } : null,
    /** Por contactar with nobody on it: what the sidebar badge counts. */
    unassignedToContact,
  };
}
