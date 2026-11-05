import Anthropic from "@anthropic-ai/sdk";
import type { IntegrationCheck } from "../integrations/integration-check.js";

/**
 * Configuración → Anthropic → Probar conexión. One free call to the Models API
 * (`GET /v1/models/{model}`, which also accepts aliases such as claude-haiku-4-5): a 401 means the
 * key is wrong, a 404 that this key cannot use the model. No message is generated.
 */
export async function checkAnthropic(
  fetchImpl: typeof fetch,
  apiKey: string,
  model: string,
): Promise<IntegrationCheck[]> {
  const keyLabel = "Clave de Anthropic";
  const modelLabel = "Modelo";
  const client = new Anthropic({
    apiKey,
    fetch: fetchImpl,
    maxRetries: 0,
    timeout: 10_000,
  });
  try {
    const found = await client.models.retrieve(model);
    const name =
      found.display_name && found.display_name !== found.id
        ? `${found.display_name} (${found.id})`
        : found.id;
    return [
      { id: "apiKey", status: "ok", label: keyLabel, detail: "Válida." },
      {
        id: "model",
        status: "ok",
        label: modelLabel,
        detail: `${name} está disponible para esta clave.`,
      },
    ];
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError)
      return [
        {
          id: "apiKey",
          status: "error",
          label: keyLabel,
          detail:
            "Anthropic rechazó la clave. Crea una nueva en console.anthropic.com → API keys y pégala aquí.",
        },
        {
          id: "model",
          status: "skipped",
          label: modelLabel,
          detail: "Se prueba cuando la clave sea válida.",
        },
      ];
    if (error instanceof Anthropic.NotFoundError)
      return [
        { id: "apiKey", status: "ok", label: keyLabel, detail: "Válida." },
        {
          id: "model",
          status: "error",
          label: modelLabel,
          detail: `El modelo ${model} no existe o esta cuenta no tiene acceso. Elige otro de la lista y guarda.`,
        },
      ];
    if (error instanceof Anthropic.PermissionDeniedError)
      return [
        {
          id: "apiKey",
          status: "error",
          label: keyLabel,
          detail:
            "La clave existe, pero Anthropic no le permite usar la API. Revisa la organización y el plan en console.anthropic.com.",
        },
        {
          id: "model",
          status: "skipped",
          label: modelLabel,
          detail: "Se prueba cuando la clave tenga acceso.",
        },
      ];
    if (error instanceof Anthropic.RateLimitError)
      return [
        {
          id: "apiKey",
          status: "error",
          label: keyLabel,
          detail:
            "Anthropic limita las pruebas por minuto. Prueba de nuevo en un rato.",
        },
      ];
    const detail =
      error instanceof Anthropic.APIError && error.status
        ? `Anthropic respondió ${error.status}. Prueba de nuevo en unos minutos.`
        : "No se pudo conectar con Anthropic.";
    return [{ id: "apiKey", status: "error", label: keyLabel, detail }];
  }
}
