import type { AppContext } from "../../context.js";
import { companySelect, toCompanyDto } from "./company-dto.js";

export async function listCompanies(
  ctx: AppContext,
  status: "active" | "archived" | "all",
) {
  const companies = await ctx.db.company.findMany({
    where:
      status === "all"
        ? {}
        : { archivedAt: status === "active" ? null : { not: null } },
    select: companySelect,
    orderBy: { createdAt: "desc" },
  });
  return companies.map(toCompanyDto);
}
