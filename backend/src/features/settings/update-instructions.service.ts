import type { AppContext } from "../../context.js";
import type { CompanyAccess } from "../../http/company-access.js";
import { getSettings } from "./get-settings.service.js";
import { saveCompanySettings } from "./save-settings.js";

/** Saves the company instructions, keeping the previous text as a version. */
export async function updateInstructions(
  ctx: AppContext,
  access: CompanyAccess,
  instructions: string,
) {
  const changed = await saveCompanySettings(ctx, access, [
    { kind: "instructions", instructions },
  ]);
  return { changed, settings: await getSettings(ctx, access.companyId) };
}
