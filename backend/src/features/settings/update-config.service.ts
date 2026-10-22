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
 * Saves the whole company config and, when given, the company's name and the WhatsApp phone
 * number id, together. Each part that changed keeps its previous value as a version. `undefined`
 * leaves that part as it is.
 */
export async function updateConfig(
  ctx: AppContext,
  access: CompanyAccess,
  config: CompanyConfig,
  extras: {
    companyName?: string;
    whatsappPhoneNumberId?: string | null;
  } = {},
) {
  await assertKnowledgeLimitsFit(ctx, access.companyId, config.knowledge);
  const changes: SettingsChange[] = [{ kind: "config", config }];
  if (extras.companyName !== undefined)
    changes.push({ kind: "companyName", companyName: extras.companyName });
  if (extras.whatsappPhoneNumberId !== undefined)
    changes.push({
      kind: "whatsappPhoneNumberId",
      whatsappPhoneNumberId: extras.whatsappPhoneNumberId,
    });
  const changed = await saveCompanySettings(ctx, access, changes);
  return { changed, settings: await getSettings(ctx, access.companyId) };
}
