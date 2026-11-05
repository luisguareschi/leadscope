import { loadCompanyById } from "../../companies/load-company.js";
import type { AppContext } from "../../context.js";
import { checkResult } from "../../integrations/integration-check.js";
import { checkAnthropic } from "../../llm/anthropic-check.js";

/** Probar conexión for Anthropic: the company's key and the saved model, with no paid call. */
export async function checkAnthropicConnection(
  ctx: AppContext,
  companyId: string,
) {
  const company = await loadCompanyById(ctx.db, companyId, ctx.encryptionKey);
  const apiKey = company.secrets.anthropicApiKey;
  const { model } = company.config.llm;
  if (!apiKey)
    return checkResult([
      {
        id: "apiKey",
        status: "error",
        label: "Clave de Anthropic",
        detail:
          "Falta. Créala en console.anthropic.com → API keys, en la cuenta de la empresa.",
      },
      {
        id: "model",
        status: "skipped",
        label: "Modelo",
        detail: `Se prueba ${model} cuando esté la clave.`,
      },
    ]);
  return checkResult(
    await checkAnthropic(ctx.integrations.anthropicFetch, apiKey, model),
  );
}
