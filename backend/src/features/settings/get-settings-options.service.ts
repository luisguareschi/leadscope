import {
  getCountries,
  getCountryCallingCode,
  type CountryCode,
} from "libphonenumber-js";
import { loadCompanyById } from "../../companies/load-company.js";
import type { AppContext } from "../../context.js";
import {
  FALLBACK_CLAUDE_MODELS,
  listClaudeModels,
  type ModelOption,
} from "../../llm/claude-models.js";

type Option = { value: string; label: string };

/** Conversation languages offered first. Any other valid BCP 47 code that is already saved stays. */
const LANGUAGES = [
  "es-UY",
  "es-AR",
  "es-PY",
  "es-CL",
  "es-BO",
  "es-PE",
  "es-CO",
  "es-EC",
  "es-VE",
  "es-MX",
  "es-CR",
  "es-PA",
  "es-DO",
  "es-GT",
  "es-US",
  "es-ES",
  "es",
  "pt-BR",
  "pt-PT",
  "en-US",
  "en-GB",
  "en",
  "it-IT",
  "fr-FR",
  "de-DE",
];

function capitalize(value: string): string {
  return value.charAt(0).toLocaleUpperCase("es") + value.slice(1);
}

function utcOffset(timeZone: string, at: Date): string {
  const part = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
  })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value;
  return (part ?? "GMT").replace("GMT", "UTC").replace(/^UTC$/, "UTC+0");
}

let staticOptions: {
  languages: Option[];
  countries: Array<Option & { callingCode: string }>;
  timezoneIds: string[];
} | null = null;

/** Built from the same libraries the validators use, so every option saves. */
function buildStaticOptions() {
  if (staticOptions) return staticOptions;
  const languageNames = new Intl.DisplayNames(["es"], { type: "language" });
  const regionNames = new Intl.DisplayNames(["es"], { type: "region" });
  staticOptions = {
    languages: LANGUAGES.map((code) => ({
      value: code,
      label: capitalize(languageNames.of(code) ?? code),
    })),
    countries: getCountries()
      .map((code: CountryCode) => ({
        value: code,
        label: regionNames.of(code) ?? code,
        callingCode: getCountryCallingCode(code),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "es")),
    timezoneIds: Intl.supportedValuesOf("timeZone"),
  };
  return staticOptions;
}

/**
 * Choices for Configuración → Asistente. Models come from Anthropic's Models API when the company
 * has its own key, and from a fixed list otherwise or if that call fails.
 */
export async function getSettingsOptions(ctx: AppContext, companyId: string) {
  const { languages, countries, timezoneIds } = buildStaticOptions();
  const now = ctx.now();
  const company = await loadCompanyById(ctx.db, companyId, ctx.encryptionKey);
  let models: ModelOption[] = FALLBACK_CLAUDE_MODELS;
  let modelsSource: "anthropic" | "fallback" = "fallback";
  const apiKey = company.secrets.anthropicApiKey;
  if (apiKey) {
    try {
      const listed = await listClaudeModels(apiKey);
      if (listed.length > 0) {
        models = listed;
        modelsSource = "anthropic";
      }
    } catch (error) {
      ctx.logger.warn(
        { err: error, companyId },
        "anthropic models list failed; using the fixed list",
      );
    }
  }
  return {
    languages,
    timezones: timezoneIds.map((id) => ({
      value: id,
      label: `${id.replaceAll("_", " ")} (${utcOffset(id, now)})`,
    })),
    countries,
    models: { source: modelsSource, options: models },
  };
}
