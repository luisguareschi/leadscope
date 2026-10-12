import type { AppContext } from "../../context.js";
import { companySelect, toCompanyDto } from "./company-dto.js";

export async function listCompanies(ctx: AppContext) {
  const companies = await ctx.db.company.findMany({
    select: companySelect,
    orderBy: { createdAt: "desc" },
  });
  return companies.map(toCompanyDto);
}
