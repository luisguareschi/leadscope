import type { AppContext } from "../../context.js";
import { companySelect, toCompanyDto } from "./company-dto.js";

/** Undoes an archive. Messages that arrived while it was archived were not stored. */
export async function restoreCompany(ctx: AppContext, companyId: string) {
  return toCompanyDto(
    await ctx.db.company.update({
      where: { id: companyId },
      data: { archivedAt: null },
      select: companySelect,
    }),
  );
}
