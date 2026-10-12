import {
  parseCompanyConfig,
  type CompanyConfig,
} from "../../companies/company-config.js";
import { invalidSettings } from "../../companies/editable-config.js";
import type { AppContext } from "../../context.js";
import type { CompanyAccess } from "../../http/company-access.js";
import { notFound } from "../../lib/http-error.js";

export type SettingsChange =
  | { kind: "config"; config: CompanyConfig }
  | { kind: "instructions"; instructions: string };

const count = (value: number) => new Intl.NumberFormat("es-UY").format(value);

function sameConfig(stored: unknown, next: CompanyConfig): boolean {
  try {
    return (
      JSON.stringify(parseCompanyConfig(stored)) ===
      JSON.stringify(parseCompanyConfig(next))
    );
  } catch {
    return false;
  }
}

/** Lower knowledge limits must still fit the files already uploaded. */
export async function assertKnowledgeLimitsFit(
  ctx: AppContext,
  companyId: string,
  limits: CompanyConfig["knowledge"],
  status = 400,
): Promise<void> {
  const usage = await ctx.db.knowledgeFile.aggregate({
    where: { companyId },
    _sum: { charCount: true },
    _max: { charCount: true },
  });
  const used = usage._sum.charCount ?? 0;
  const largest = usage._max.charCount ?? 0;
  const fields: Record<string, string> = {};
  if (limits.maxCharsTotal < used)
    fields["knowledge.maxCharsTotal"] =
      `Los archivos de Conocimiento ya suman ${count(used)} caracteres. Borrá o achicá archivos antes de bajarlo.`;
  if (limits.maxCharsPerFile < largest)
    fields["knowledge.maxCharsPerFile"] =
      `Hay un archivo de ${count(largest)} caracteres. Reemplazalo por uno más corto antes de bajarlo.`;
  if (Object.keys(fields).length > 0) throw invalidSettings(fields, status);
}

/**
 * Writes one part of the settings and its version in one transaction. The company row is locked
 * and the version is stamped after the lock, so the newest version is always what the row holds.
 * Saving what is already there writes nothing and returns false.
 */
export async function saveCompanySettings(
  ctx: AppContext,
  access: CompanyAccess,
  change: SettingsChange,
  restoredFromId: string | null = null,
): Promise<boolean> {
  return ctx.db.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Company" WHERE "id" = ${access.companyId} FOR UPDATE
    `;
    if (!locked[0]) throw notFound("Empresa no encontrada");
    const company = await tx.company.findUniqueOrThrow({
      where: { id: access.companyId },
      select: { config: true, instructions: true },
    });
    const value =
      change.kind === "config"
        ? { config: change.config }
        : { instructions: change.instructions };
    const unchanged =
      change.kind === "config"
        ? sameConfig(company.config, change.config)
        : company.instructions === change.instructions;
    if (unchanged) return false;

    await tx.company.update({ where: { id: access.companyId }, data: value });
    await tx.companySettingsVersion.create({
      data: {
        companyId: access.companyId,
        kind: change.kind,
        ...value,
        createdByEmail: access.actorEmail,
        viaSupport: access.support,
        restoredFromId,
        createdAt: ctx.now(),
      },
    });
    return true;
  });
}
