import type { CompanyConfig } from "../../companies/company-config.js";
import type { AppContext } from "../../context.js";
import type { CompanyAccess } from "../../http/company-access.js";
import { getSettings } from "./get-settings.service.js";
import {
  assertKnowledgeLimitsFit,
  saveCompanySettings,
} from "./save-settings.js";

/** Saves the whole company config, keeping the previous one as a version. */
export async function updateConfig(
  ctx: AppContext,
  access: CompanyAccess,
  config: CompanyConfig,
) {
  await assertKnowledgeLimitsFit(ctx, access.companyId, config.knowledge);
  const changed = await saveCompanySettings(ctx, access, {
    kind: "config",
    config,
  });
  return { changed, settings: await getSettings(ctx, access.companyId) };
}
