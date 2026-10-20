import { parseCompanyConfig } from "../../companies/company-config.js";
import type { AppContext } from "../../context.js";
import { collectedRows } from "../../conversation/crm-summary.js";
import { notFound } from "../../lib/http-error.js";
import { toThreadDto } from "./thread-dto.js";

const MAX_MESSAGES = 500;

export async function getThread(
  ctx: AppContext,
  companyId: string,
  threadId: string,
) {
  const thread = await ctx.db.thread.findFirst({
    where: { id: threadId, companyId },
    include: { company: { select: { config: true } } },
  });
  if (!thread) throw notFound("Conversación no encontrada");
  const messages = await ctx.db.message.findMany({
    where: { threadId },
    orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }],
    take: MAX_MESSAGES,
    select: {
      id: true,
      direction: true,
      type: true,
      body: true,
      status: true,
      sentAt: true,
    },
  });
  const { company, ...row } = thread;
  return {
    thread: toThreadDto(row),
    /** The company's items with what the lead said, then values under keys no item has anymore. */
    fields: collectedRows(row.collected, parseCompanyConfig(company.config)),
    messages: messages.reverse(),
  };
}
