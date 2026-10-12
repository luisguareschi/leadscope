import {
  decryptSecrets,
  encryptSecrets,
  type CompanySecrets,
} from "../../companies/company-secrets.js";
import type { AppContext } from "../../context.js";
import { notFound } from "../../lib/http-error.js";

/**
 * Read-modify-write of one company's encrypted secrets. The row is locked so saving one key
 * cannot drop a different key saved at the same time. Callers pass the operator's company id.
 */
export async function updateCompanySecrets(
  ctx: AppContext,
  companyId: string,
  change: (secrets: CompanySecrets) => void,
): Promise<void> {
  await ctx.db.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Company" WHERE "id" = ${companyId} FOR UPDATE
    `;
    if (!locked[0]) throw notFound("Empresa no encontrada");
    const company = await tx.company.findUniqueOrThrow({
      where: { id: companyId },
    });
    const secrets = decryptSecrets(company.encryptedSecrets, ctx.encryptionKey);
    change(secrets);
    await tx.company.update({
      where: { id: companyId },
      data: { encryptedSecrets: encryptSecrets(secrets, ctx.encryptionKey) },
    });
  });
}
