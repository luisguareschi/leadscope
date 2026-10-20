import { isSupportedCountry } from "libphonenumber-js";
import { z } from "zod";
import { HttpError } from "../lib/http-error.js";
import {
  MAX_COLLECT_ITEMS,
  MAX_UPLOAD_BYTES,
  type CompanyConfig,
} from "./company-config.js";

/** All of a company's uploaded text together: about 100k tokens of prompt. */
export const MAX_KNOWLEDGE_CHARS = 400_000;
export const MAX_INSTRUCTIONS_CHARS = 20_000;

const count = (value: number) => new Intl.NumberFormat("es-UY").format(value);

const required = (max: number) =>
  z
    .string()
    .trim()
    .min(1, "No puede quedar vacío.")
    .max(max, `Máximo ${count(max)} caracteres.`);
const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${count(max)} caracteres.`);
const integer = (min: number, max: number) =>
  z
    .number()
    .int("Tiene que ser un número entero.")
    .min(min, `El mínimo es ${count(min)}.`)
    .max(max, `El máximo es ${count(max)}.`);

function isLocale(value: string): boolean {
  try {
    return Intl.getCanonicalLocales(value).length === 1;
  } catch {
    return false;
  }
}

function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const collectItemSchema = z.strictObject({
  key: z
    .string()
    .trim()
    .max(40, "Máximo 40 caracteres.")
    .regex(
      /^[a-zA-Z][a-zA-Z0-9_]*$/,
      "Usá letras, números y guiones bajos, empezando con una letra. Por ejemplo: presupuesto.",
    ),
  name: required(60),
  description: required(300),
  required: z.boolean(),
});

const collectSchema = z
  .array(collectItemSchema)
  .min(1, "Agregá al menos un dato para recopilar.")
  .max(MAX_COLLECT_ITEMS, `Máximo ${MAX_COLLECT_ITEMS} datos.`)
  .superRefine((items, issue) => {
    const seen = new Set<string>();
    items.forEach((item, index) => {
      const key = item.key.toLowerCase();
      if (seen.has(key))
        issue.addIssue({
          code: "custom",
          path: [index, "key"],
          message: "Ya hay otro dato con esta clave.",
        });
      seen.add(key);
    });
  });

/**
 * What an operator may save from Configuración. Stricter than `companyConfigSchema`, which stays
 * lenient so a stored config keeps loading. Unknown keys are rejected rather than dropped.
 */
export const editableConfigSchema = z.strictObject({
  displayName: required(80),
  language: z
    .string()
    .trim()
    .refine(isLocale, "Usá un código de idioma, por ejemplo es-UY."),
  tone: required(2_000),
  timezone: z
    .string()
    .trim()
    .refine(
      isTimeZone,
      "Zona horaria desconocida. Por ejemplo: America/Montevideo.",
    ),
  defaultCountry: z
    .string()
    .trim()
    .toUpperCase()
    .refine(
      (value) => isSupportedCountry(value),
      "Usá el código de dos letras del país, por ejemplo UY.",
    ),
  businessHours: optional(300),
  collect: collectSchema,
  forbiddenTopics: z.strictObject({
    describe: z.array(required(300)).max(30, "Máximo 30 temas."),
  }),
  messages: z.strictObject({
    fallback: required(1_000),
    needsHuman: required(1_000),
    nonText: required(1_000),
  }),
  maxReplyChars: integer(80, 4_096),
  llm: z.strictObject({
    model: z
      .string()
      .trim()
      .regex(
        /^claude-[a-z0-9.-]+$/,
        "Usá el identificador de un modelo de Anthropic, por ejemplo claude-haiku-4-5.",
      ),
    temperature: z.number().min(0, "El mínimo es 0.").max(1, "El máximo es 1."),
    historyLimit: integer(4, 200),
    timeoutMs: z
      .number()
      .int("Tiene que ser un número entero.")
      .min(1_000, "El mínimo es 1 segundo.")
      .max(60_000, "El máximo es 60 segundos."),
  }),
  knowledge: z
    .strictObject({
      maxFileBytes: z
        .number()
        .int("Tiene que ser un número entero.")
        .min(1, "Tiene que ser mayor que 0.")
        .max(
          MAX_UPLOAD_BYTES,
          `El máximo es ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB.`,
        ),
      maxCharsPerFile: integer(1, MAX_KNOWLEDGE_CHARS),
      maxCharsTotal: integer(1, MAX_KNOWLEDGE_CHARS),
    })
    .refine((limits) => limits.maxCharsPerFile <= limits.maxCharsTotal, {
      path: ["maxCharsPerFile"],
      message: "No puede ser mayor que el máximo de toda la empresa.",
    }),
  crm: z.strictObject({
    provider: z.literal("hubspot"),
    transcriptProperty: z
      .string()
      .trim()
      .max(100, "Máximo 100 caracteres.")
      .regex(
        /^([a-z][a-z0-9_]*)?$/,
        "Usá el nombre interno de la propiedad en HubSpot: minúsculas, números y guiones bajos.",
      ),
  }),
  whatsapp: z.strictObject({
    welcomeTemplate: z
      .strictObject({
        name: z
          .string()
          .trim()
          .max(512, "Máximo 512 caracteres.")
          .regex(
            /^[a-z0-9_]+$/,
            "Usá el nombre exacto de la plantilla aprobada en Meta: minúsculas, números y guiones bajos.",
          ),
        language: z
          .string()
          .trim()
          .regex(
            /^[a-z]{2,3}(_[A-Z]{2})?$/,
            "Usá el código de idioma de la plantilla en Meta, por ejemplo es o es_AR.",
          ),
        bodyPreview: optional(1_024),
      })
      .nullable(),
  }),
}) satisfies z.ZodType<CompanyConfig>;

/**
 * Meta's Phone number ID for the company's WhatsApp number (Kapso shows the same id): digits only.
 * It lives on the Company column, not in the config, because inbound webhooks are matched to the
 * company by it. Empty means no number.
 */
export const whatsappPhoneNumberIdSchema = z
  .string()
  .trim()
  .max(64, "Máximo 64 dígitos.")
  .regex(
    /^\d*$/,
    "Son solo números: el Phone number ID que muestra Kapso en el número conectado, no el número de teléfono.",
  )
  .nullable()
  .transform((value) => value || null);

function spanishIssue(issue: z.core.$ZodRawIssue): string {
  switch (issue.code) {
    case "invalid_type":
      return issue.input === undefined || issue.input === null
        ? "Completá este campo."
        : "Valor inválido.";
    case "unrecognized_keys":
      return "Este campo no se puede guardar desde Configuración.";
    case "invalid_value":
      return "Valor no permitido.";
    default:
      return "Valor inválido.";
  }
}

/**
 * Turns issues into one message per field, keyed by dotted path. A bad line of a list (forbidden
 * topics) is reported on the list, quoting the line; a bad field of a collect item on that field.
 */
export function fieldErrors(
  issues: z.core.$ZodIssue[],
): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of issues) {
    const paths =
      issue.code === "unrecognized_keys"
        ? issue.keys.map((key) => [...issue.path, key])
        : [issue.path];
    for (const path of paths) {
      const last = path.at(-1);
      const inList = typeof last === "number";
      const name = (inList ? path.slice(0, -1) : path).join(".") || "input";
      const quoted =
        inList && typeof issue.input === "string"
          ? `«${issue.input.slice(0, 60)}»: `
          : "";
      fields[name] ??= `${quoted}${issue.message}`;
    }
  }
  return fields;
}

export function invalidSettings(
  fields: Record<string, string>,
  status = 400,
): HttpError {
  return new HttpError(
    status,
    status === 400
      ? "Revisá los campos marcados."
      : "Esa versión no pasa la validación actual. Revisá los campos marcados.",
    status === 400 ? "invalid_config" : "invalid_version",
    fields,
  );
}

/** Parses settings input with Spanish per-field errors. `status` is 422 when it is a stored version. */
export function parseSettingsInput<T extends z.ZodType>(
  schema: T,
  value: unknown,
  status = 400,
): z.infer<T> {
  const result = schema.safeParse(value, {
    error: spanishIssue,
    reportInput: true,
  });
  if (result.success) return result.data;
  throw invalidSettings(fieldErrors(result.error.issues), status);
}

export function parseEditableConfig(
  value: unknown,
  status = 400,
): CompanyConfig {
  return parseSettingsInput(editableConfigSchema, value, status);
}
