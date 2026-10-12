import {
  parseEditableConfig,
  parseSettingsInput,
} from "../../companies/editable-config.js";
import type { AppContext } from "../../context.js";
import type { CompanyAccess } from "../../http/company-access.js";
import { notFound } from "../../lib/http-error.js";
import { getSettings } from "./get-settings.service.js";
import {
  assertKnowledgeLimitsFit,
  saveCompanySettings,
  type SettingsChange,
} from "./save-settings.js";
import { updateInstructionsBodySchema } from "./settings-params.js";

/**
 * Puts an earlier config or instructions back, saved as a new version that points to the old one.
 * The old version is checked against today's rules first; one that no longer passes is a 422.
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

  let change: SettingsChange;
  if (version.kind === "config") {
    const config = parseEditableConfig(version.config, 422);
    await assertKnowledgeLimitsFit(
      ctx,
      access.companyId,
      config.knowledge,
      422,
    );
    change = { kind: "config", config };
  } else {
    const { instructions } = parseSettingsInput(
      updateInstructionsBodySchema,
      { instructions: version.instructions ?? "" },
      422,
    );
    change = { kind: "instructions", instructions };
  }
  const changed = await saveCompanySettings(ctx, access, change, version.id);
  return { changed, settings: await getSettings(ctx, access.companyId) };
}
