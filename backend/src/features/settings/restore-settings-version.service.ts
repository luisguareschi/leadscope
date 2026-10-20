import { upgradeLegacyConfig } from "../../companies/company-config.js";
import {
  parseEditableConfig,
  parseSettingsInput,
} from "../../companies/editable-config.js";
import type { AppContext } from "../../context.js";
import type { CompanySettingsVersion } from "../../generated/prisma/client.js";
import type { CompanyAccess } from "../../http/company-access.js";
import { notFound } from "../../lib/http-error.js";
import { getSettings } from "./get-settings.service.js";
import {
  assertKnowledgeLimitsFit,
  saveCompanySettings,
  type SettingsChange,
} from "./save-settings.js";
import {
  updateInstructionsBodySchema,
  whatsappPhoneNumberIdValueSchema,
} from "./settings-params.js";

/** The stored value, checked against today's rules: a version that no longer passes is a 422. */
async function changeFor(
  ctx: AppContext,
  companyId: string,
  version: CompanySettingsVersion,
): Promise<SettingsChange> {
  if (version.kind === "config") {
    const config = parseEditableConfig(
      upgradeLegacyConfig(version.config),
      422,
    );
    await assertKnowledgeLimitsFit(ctx, companyId, config.knowledge, 422);
    return { kind: "config", config };
  }
  if (version.kind === "instructions") {
    const { instructions } = parseSettingsInput(
      updateInstructionsBodySchema,
      { instructions: version.instructions ?? "" },
      422,
    );
    return { kind: "instructions", instructions };
  }
  const { whatsappPhoneNumberId } = parseSettingsInput(
    whatsappPhoneNumberIdValueSchema,
    { whatsappPhoneNumberId: version.whatsappPhoneNumberId },
    422,
  );
  return { kind: "whatsappPhoneNumberId", whatsappPhoneNumberId };
}

/**
 * Puts an earlier config, instructions, or WhatsApp phone number id back, saved as a new version
 * that points to the old one. A number another company uses now is a 409.
 */
export async function restoreSettingsVersion(
  ctx: AppContext,
  access: CompanyAccess,
  versionId: string,
) {
  const version = await ctx.db.companySettingsVersion.findFirst({
    where: { id: versionId, companyId: access.companyId },
  });
  if (!version) throw notFound("Versión no encontrada");
  const change = await changeFor(ctx, access.companyId, version);
  const changed = await saveCompanySettings(ctx, access, [change], version.id);
  return { changed, settings: await getSettings(ctx, access.companyId) };
}
