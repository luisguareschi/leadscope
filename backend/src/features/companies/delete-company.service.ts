import type { AppContext } from "../../context.js";
import { badRequest } from "../../lib/http-error.js";
import { removeAuthUserIfUnused } from "../operators/remove-auth-user.js";

/**
 * Permanent. The slug must be typed back. Removes the company with its operators, threads,
 * messages, knowledge files, usage, and settings versions; the audit entries stay, with the slug.
 * Then removes each operator's Supabase user under the same rule as deleting one operator.
 */
export async function deleteCompany(
  ctx: AppContext,
  companyId: string,
  confirmSlug: string,
) {
  const company = await ctx.db.company.findUniqueOrThrow({
    where: { id: companyId },
    select: {
      id: true,
      slug: true,
      operators: { select: { email: true, supabaseUserId: true } },
    },
  });
  if (confirmSlug !== company.slug)
    throw badRequest(
      "Para eliminarla, escribí el identificador exacto de la empresa.",
      "slug_mismatch",
    );
  await ctx.db.company.delete({ where: { id: company.id } });
  ctx.logger.warn({ companyId, slug: company.slug }, "company deleted");

  const authUsers = { removed: 0, kept: 0, failed: [] as string[] };
  for (const operator of company.operators) {
    const removal = await removeAuthUserIfUnused(ctx, operator);
    if (removal.status === "removed") authUsers.removed += 1;
    else if (removal.status === "failed") authUsers.failed.push(operator.email);
    else if (removal.status !== "none") authUsers.kept += 1;
  }
  return { deleted: { id: company.id, slug: company.slug }, authUsers };
}
