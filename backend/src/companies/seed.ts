import { altamiraConfig, altamiraDevSecrets } from "./altamira";
import { syncSheet } from "../integrations/knowledge/sync";
import { Store } from "../store/types";

export async function seedAltamira(
  store: Store,
  operator: { email: string; supabaseUserId: string },
): Promise<void> {
  const company = await store.upsertCompany({
    name: "Altamira",
    config: altamiraConfig(),
    secrets: altamiraDevSecrets(),
    whatsappPhoneNumberId: altamiraConfig().whatsapp.phoneNumberId,
  });
  await store.upsertOperator({
    companyId: company.id,
    email: operator.email,
    supabaseUserId: operator.supabaseUserId,
  });
  await syncSheet(company, store, "");
}
