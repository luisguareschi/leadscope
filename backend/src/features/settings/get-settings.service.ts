import { parseCompanyConfig } from "../../companies/company-config.js";
import { MAX_INSTRUCTIONS_CHARS } from "../../companies/editable-config.js";
import { hubspotSettingsOf } from "../../companies/load-company.js";
import type { AppContext } from "../../context.js";
import { buildPlatformRules } from "../../engine/prompt.js";
import { SettingsKind } from "../../generated/prisma/enums.js";
import { kapsoWebhookPath } from "../../integrations/whatsapp/kapso/kapso-webhook-path.js";
import { formLeadPath } from "../form-leads/form-lead-path.js";

/** The company's editable settings, and the platform rules they fill in (read-only). */
export async function getSettings(ctx: AppContext, companyId: string) {
  const company = await ctx.db.company.findUniqueOrThrow({
    where: { id: companyId },
    select: {
      slug: true,
      name: true,
      config: true,
      instructions: true,
      whatsappPhoneNumberId: true,
      hubspotEnabled: true,
      hubspotPortalId: true,
      hubspotUiDomain: true,
    },
  });
  const latest = (kind: SettingsKind) =>
    ctx.db.companySettingsVersion.findFirst({
      where: { companyId, kind },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true },
    });
  const [
    configVersion,
    instructionsVersion,
    companyNameVersion,
    phoneNumberIdVersion,
  ] = await Promise.all([
    latest(SettingsKind.config),
    latest(SettingsKind.instructions),
    latest(SettingsKind.companyName),
    latest(SettingsKind.whatsappPhoneNumberId),
  ]);
  const config = parseCompanyConfig(company.config, company.name);
  return {
    config,
    /** `Company.name`. The assistant's own name is `config.assistantName`. */
    companyName: company.name,
    instructions: company.instructions,
    whatsappPhoneNumberId: company.whatsappPhoneNumberId,
    /** Append to the backend's public URL to get the webhook URL to paste in Kapso. */
    kapsoWebhookPath: kapsoWebhookPath(company.slug),
    /** Append to the backend's public URL to get the URL the form workflow posts to. */
    formLeadPath: formLeadPath(company.slug),
    hubspot: hubspotSettingsOf(company),
    platformRules: buildPlatformRules(config, company.name),
    currentVersions: {
      config: configVersion?.id ?? null,
      instructions: instructionsVersion?.id ?? null,
      companyName: companyNameVersion?.id ?? null,
      whatsappPhoneNumberId: phoneNumberIdVersion?.id ?? null,
    },
    limits: { instructionsMaxChars: MAX_INSTRUCTIONS_CHARS },
  };
}
