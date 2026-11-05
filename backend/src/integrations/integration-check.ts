import type { ConnectionCheckStatus } from "./whatsapp/kapso/kapso-connection.js";

/** One line of a Probar conexión result, in the same shape as WhatsApp's. */
export type IntegrationCheck = {
  id: string;
  status: ConnectionCheckStatus;
  /** Spanish, for the panel. */
  label: string;
  detail: string;
};

export type IntegrationCheckResult = {
  /** Every check passed, possibly with warnings. */
  ready: boolean;
  checks: IntegrationCheck[];
};

export function checkResult(
  checks: IntegrationCheck[],
): IntegrationCheckResult {
  return {
    ready: checks.every(
      (check) => check.status === "ok" || check.status === "warning",
    ),
    checks,
  };
}
