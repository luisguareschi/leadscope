import type { AppContext } from "../../context.js";
import type { Prisma } from "../../generated/prisma/client.js";
import {
  assigneeWhere,
  botWhere,
  stageWhere,
  threadInclude,
  toThreadDto,
  type AssigneeFilter,
  type BotFilter,
  type StageFilter,
} from "./thread-dto.js";

export type ListThreadsInput = {
  stage: StageFilter;
  bot: BotFilter;
  assignee: AssigneeFilter;
  search?: string;
  cursor?: string;
  limit: number;
};

function searchWhere(search: string | undefined): Prisma.ThreadWhereInput {
  const term = search?.trim();
  if (!term) return {};
  // "099 777 002" (national, with the trunk 0) should find +59899777002.
  const digits = term.replace(/\D/g, "").replace(/^0+/, "");
  return {
    OR: [
      { name: { contains: term, mode: "insensitive" } },
      ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
    ],
  };
}

/** Por contactar is the advisors' queue: whoever has waited longest comes first. */
function orderFor(stage: StageFilter): Prisma.ThreadOrderByWithRelationInput[] {
  if (stage === "to_contact")
    return [{ handedOffAt: { sort: "asc", nulls: "first" } }, { id: "asc" }];
  return [{ lastMessageAt: { sort: "desc", nulls: "last" } }, { id: "desc" }];
}

export async function listThreads(
  ctx: AppContext,
  companyId: string,
  operatorId: string | null,
  input: ListThreadsInput,
) {
  const rows = await ctx.db.thread.findMany({
    where: {
      AND: [
        { companyId },
        stageWhere(input.stage),
        botWhere(input.bot),
        assigneeWhere(input.assignee, operatorId),
        searchWhere(input.search),
      ],
    },
    include: threadInclude,
    orderBy: orderFor(input.stage),
    take: input.limit + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
  });
  const page = rows.slice(0, input.limit);
  return {
    threads: page.map(toThreadDto),
    nextCursor: rows.length > input.limit ? (page.at(-1)?.id ?? null) : null,
  };
}
