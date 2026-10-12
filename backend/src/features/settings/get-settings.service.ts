import { parseCompanyConfig } from "../../companies/company-config.js";
import { MAX_INSTRUCTIONS_CHARS } from "../../companies/editable-config.js";
import type { AppContext } from "../../context.js";
import { buildPlatformRules } from "../../engine/prompt.js";
import { SettingsKind } from "../../generated/prisma/enums.js";

/** The company's editable settings, and the platform rules they fill in (read-only). */
export async function getSettings(ctx: AppContext, companyId: string) {
  const company = await ctx.db.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { config: true, instructions: true, whatsappPhoneNumberId: true },
  });
  const latest = (kind: SettingsKind) =>
    ctx.db.companySettingsVersion.findFirst({
      where: { companyId, kind },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true },
    });
  const [configVersion, instructionsVersion, phoneNumberIdVersion] =
    await Promise.all([
      latest(SettingsKind.config),
      latest(SettingsKind.instructions),
      latest(SettingsKind.whatsappPhoneNumberId),
    ]);
  const config = parseCompanyConfig(company.config);
  return {
    config,
    instructions: company.instructions,
    whatsappPhoneNumberId: company.whatsappPhoneNumberId,
    platformRules: buildPlatformRules(config),
    currentVersions: {
      config: configVersion?.id ?? null,
      instructions: instructionsVersion?.id ?? null,
      whatsappPhoneNumberId: phoneNumberIdVersion?.id ?? null,
    },
    limits: { instructionsMaxChars: MAX_INSTRUCTIONS_CHARS },
  };
}
