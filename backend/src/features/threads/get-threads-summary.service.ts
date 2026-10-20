import type { AppContext } from "../../context.js";
import type { Prisma } from "../../generated/prisma/client.js";
import {
  BOT_FILTERS,
  botWhere,
  STAGE_FILTERS,
  stageWhere,
  type BotActivity,
  type StageFilter,
} from "./thread-dto.js";

const STAGES = STAGE_FILTERS.filter(
  (stage): stage is Exclude<StageFilter, "all"> => stage !== "all",
);
const ACTIVITIES = BOT_FILTERS.filter(
  (bot): bot is BotActivity => bot !== "all",
);

/**
 * Counts for the filters. Stages and bot activities each partition the threads, so each set adds
 * up to the total. `mine` is null for a platform admin in support access (no operator row).
 */
export async function getThreadsSummary(
  ctx: AppContext,
  companyId: string,
  operatorId: string | null,
) {
  const count = (where: Prisma.ThreadWhereInput) =>
    ctx.db.thread.count({ where: { AND: [{ companyId }, where] } });
  const [total, unassignedToContact, stages, bot, mine] = await Promise.all([
    count({}),
    count({ stage: "to_contact", assignedToId: null }),
    Promise.all(STAGES.map((stage) => count(stageWhere(stage)))),
    Promise.all(ACTIVITIES.map((activity) => count(botWhere(activity)))),
    operatorId
      ? Promise.all([
          count({ assignedToId: operatorId }),
          count({ assignedToId: operatorId, stage: "to_contact" }),
        ])
      : null,
  ]);
  return {
    total,
    stages: Object.fromEntries(
      STAGES.map((stage, index) => [stage, stages[index] ?? 0]),
    ) as Record<(typeof STAGES)[number], number>,
    bot: Object.fromEntries(
      ACTIVITIES.map((activity, index) => [activity, bot[index] ?? 0]),
    ) as Record<BotActivity, number>,
    mine: mine ? { all: mine[0], toContact: mine[1] } : null,
    /** Por contactar with nobody on it: what the sidebar badge counts. */
    unassignedToContact,
  };
}
