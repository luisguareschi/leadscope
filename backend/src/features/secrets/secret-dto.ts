import type { CompanySecretName } from "../../companies/company-secrets.js";

/** What the panel may see. Never includes the secret itself. */
export type SecretStatus = {
  name: CompanySecretName;
  set: boolean;
  last4: string | null;
};

/**
 * Last 4 characters only when that is not the whole value. A secret of 4 characters or fewer
 * is reported as set, with no suffix, so the response cannot be the raw secret.
 */
export function toSecretStatus(
  name: CompanySecretName,
  value: string | undefined,
): SecretStatus {
  if (!value) return { name, set: false, last4: null };
  return { name, set: true, last4: value.length > 4 ? value.slice(-4) : null };
}
