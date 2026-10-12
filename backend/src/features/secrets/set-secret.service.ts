import type { CompanySecretName } from "../../companies/company-secrets.js";
import type { AppContext } from "../../context.js";
import { badRequest } from "../../lib/http-error.js";
import { toSecretStatus, type SecretStatus } from "./secret-dto.js";
import { updateCompanySecrets } from "./update-company-secrets.js";

/** Replaces one secret on the operator's company. Does not clear anything when `value` is blank. */
export async function setSecret(
  ctx: AppContext,
  companyId: string,
  name: CompanySecretName,
  value: string,
): Promise<SecretStatus> {
  const trimmed = value.trim();
  if (!trimmed)
    throw badRequest(
      "Indicá un valor. Un campo vacío no borra la clave.",
      "empty_secret",
    );
  await updateCompanySecrets(ctx, companyId, (secrets) => {
    secrets[name] = trimmed;
  });
  return toSecretStatus(name, trimmed);
}
