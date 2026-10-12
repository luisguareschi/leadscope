import type { CompanySecretName } from "../../companies/company-secrets.js";
import type { AppContext } from "../../context.js";
import { toSecretStatus, type SecretStatus } from "./secret-dto.js";
import { updateCompanySecrets } from "./update-company-secrets.js";

/** Removes one secret. Other secrets on the same company stay. */
export async function clearSecret(
  ctx: AppContext,
  companyId: string,
  name: CompanySecretName,
): Promise<SecretStatus> {
  await updateCompanySecrets(ctx, companyId, (secrets) => {
    delete secrets[name];
  });
  return toSecretStatus(name, undefined);
}
