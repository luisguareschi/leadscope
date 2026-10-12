import {
  parseCompanyConfig,
  type CompanyConfig,
} from "../../companies/company-config.js";
import { invalidSettings } from "../../companies/editable-config.js";
import type { AppContext } from "../../context.js";
import type { CompanyAccess } from "../../http/company-access.js";
import { HttpError, notFound } from "../../lib/http-error.js";
import { isUniqueViolation } from "../../lib/prisma.js";

export type SettingsChange =
  | { kind: "config"; config: CompanyConfig }
  | { kind: "instructions"; instructions: string }
  | { kind: "whatsappPhoneNumberId"; whatsappPhoneNumberId: string | null };

type StoredSettings = {
  config: unknown;
  instructions: string;
  whatsappPhoneNumberId: string | null;
};

const count = (value: number) => new Intl.NumberFormat("es-UY").format(value);

export function phoneNumberIdTaken(): HttpError {
  return new HttpError(
    409,
    "Ese identificador de WhatsApp ya está asignado a otra empresa.",
    "phone_number_id_taken",
    {
      whatsappPhoneNumberId:
        "Ya lo usa otra empresa. Cada número de WhatsApp va con una sola empresa.",
    },
  );
}

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

function isUnchanged(stored: StoredSettings, change: SettingsChange): boolean {
  if (change.kind === "config") return sameConfig(stored.config, change.config);
  if (change.kind === "instructions")
    return stored.instructions === change.instructions;
  return stored.whatsappPhoneNumberId === change.whatsappPhoneNumberId;
}

function valueOf(change: SettingsChange) {
  if (change.kind === "config") return { config: change.config };
  if (change.kind === "instructions")
    return { instructions: change.instructions };
  return { whatsappPhoneNumberId: change.whatsappPhoneNumberId };
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
 * Writes the changed parts of the settings and one version per part, in one transaction: either
 * everything saves or nothing does. The company row is locked and versions are stamped after the
 * lock, so the newest version of each kind is always what the row holds. Parts that are already
 * stored write nothing; returns false when nothing changed.
 */
export async function saveCompanySettings(
  ctx: AppContext,
  access: CompanyAccess,
  changes: SettingsChange[],
  restoredFromId: string | null = null,
): Promise<boolean> {
  try {
    return await ctx.db.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "Company" WHERE "id" = ${access.companyId} FOR UPDATE
      `;
      if (!locked[0]) throw notFound("Empresa no encontrada");
      const stored = await tx.company.findUniqueOrThrow({
        where: { id: access.companyId },
        select: {
          config: true,
          instructions: true,
          whatsappPhoneNumberId: true,
        },
      });
      const pending = changes.filter((change) => !isUnchanged(stored, change));
      if (pending.length === 0) return false;

      for (const change of pending) {
        if (change.kind !== "whatsappPhoneNumberId") continue;
        if (!change.whatsappPhoneNumberId) continue;
        const taken = await tx.company.findFirst({
          where: {
            whatsappPhoneNumberId: change.whatsappPhoneNumberId,
            NOT: { id: access.companyId },
          },
          select: { id: true },
        });
        if (taken) throw phoneNumberIdTaken();
      }

      await tx.company.update({
        where: { id: access.companyId },
        data: Object.assign({}, ...pending.map(valueOf)),
      });
      const createdAt = ctx.now();
      for (const change of pending) {
        await tx.companySettingsVersion.create({
          data: {
            companyId: access.companyId,
            kind: change.kind,
            ...valueOf(change),
            createdByEmail: access.actorEmail,
            viaSupport: access.support,
            restoredFromId,
            createdAt,
          },
        });
      }
      return true;
    });
  } catch (error) {
    // Another company took the same id between the check and the update.
    if (isUniqueViolation(error)) throw phoneNumberIdTaken();
    throw error;
  }
}
