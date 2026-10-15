import type { AppContext } from "../../context.js";
import { companySelect, toCompanyDto } from "./company-dto.js";

/**
 * Reversible. While archived its operators get 403, support access is refused, and the bot does
 * not store or answer messages to its number. Nothing is deleted.
 */
export async function archiveCompany(ctx: AppContext, companyId: string) {
  await ctx.db.company.updateMany({
    where: { id: companyId, archivedAt: null },
    data: { archivedAt: ctx.now() },
  });
  return toCompanyDto(
    await ctx.db.company.findUniqueOrThrow({
      where: { id: companyId },
      select: companySelect,
    }),
  );
}
