import type { AppContext } from "../../context.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { statusWhere, toThreadDto, type ThreadStatusFilter } from "./thread-dto.js";

export type ListThreadsInput = {
  status: ThreadStatusFilter;
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

export async function listThreads(ctx: AppContext, companyId: string, input: ListThreadsInput) {
  const rows = await ctx.db.thread.findMany({
    where: { companyId, ...statusWhere(input.status), ...searchWhere(input.search) },
    orderBy: [{ lastMessageAt: { sort: "desc", nulls: "last" } }, { id: "desc" }],
    take: input.limit + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
  });
  const page = rows.slice(0, input.limit);
  return {
    threads: page.map(toThreadDto),
    nextCursor: rows.length > input.limit ? (page.at(-1)?.id ?? null) : null,
  };
}
