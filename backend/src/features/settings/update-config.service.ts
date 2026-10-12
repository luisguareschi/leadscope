import type { CompanyConfig } from "../../companies/company-config.js";
import type { AppContext } from "../../context.js";
import type { CompanyAccess } from "../../http/company-access.js";
import { getSettings } from "./get-settings.service.js";
import {
  assertKnowledgeLimitsFit,
  saveCompanySettings,
  type SettingsChange,
} from "./save-settings.js";

/**
 * Saves the whole company config and, when given, the WhatsApp phone number id, together. Each
 * part that changed keeps its previous value as a version. `undefined` leaves the id as it is.
 */
export async function updateConfig(
  ctx: AppContext,
  access: CompanyAccess,
  config: CompanyConfig,
  whatsappPhoneNumberId: string | null | undefined,
) {
  await assertKnowledgeLimitsFit(ctx, access.companyId, config.knowledge);
  const changes: SettingsChange[] = [{ kind: "config", config }];
  if (whatsappPhoneNumberId !== undefined)
    changes.push({ kind: "whatsappPhoneNumberId", whatsappPhoneNumberId });
  const changed = await saveCompanySettings(ctx, access, changes);
  return { changed, settings: await getSettings(ctx, access.companyId) };
}
