import type { CompanyConfig } from "../companies/company-config.js";
import { collectedOf } from "../engine/turn.js";
import type { CrmActionKind } from "../engine/types.js";

export type SummaryThread = {
  phone: string;
  name: string | null;
  email: string | null;
  collected: unknown;
  summary: string | null;
  callTime: string | null;
  needsHumanReason: string | null;
};

/**
 * The company's items in config order, then anything stored under a key the config no longer has
 * (an item removed after the lead answered it), labeled by its key.
 */
export function collectedRows(
  collected: unknown,
  config: Pick<CompanyConfig, "collect">,
): Array<{
  key: string;
  name: string;
  required: boolean | null;
  value: string | null;
}> {
  const values = collectedOf(collected);
  const known = new Set(config.collect.map((item) => item.key));
  return [
    ...config.collect.map((item) => ({
      key: item.key,
      name: item.name,
      required: item.required,
      value: values[item.key] ?? null,
    })),
    ...Object.entries(values)
      .filter(([key]) => !known.has(key))
      .map(([key, value]) => ({ key, name: key, required: null, value })),
  ];
}

export type SummaryMessage = {
  direction: "inbound" | "outbound";
  type: string;
  body: string;
  sentAt: Date;
};

const ACTION_LABEL: Record<CrmActionKind, string> = {
  handoff: "Derivado a asesor (calificado)",
  close: "Cerrado: sin interés",
  needs_human: "Requiere atención de un asesor",
};

function stamp(
  date: Date,
  config: CompanyConfig,
  style: "full" | "short",
): string {
  const options: Intl.DateTimeFormatOptions =
    style === "full"
      ? { timeZone: config.timezone, dateStyle: "short", timeStyle: "short" }
      : {
          timeZone: config.timezone,
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        };
  try {
    return new Intl.DateTimeFormat(config.language, options).format(date);
  } catch {
    return date.toISOString();
  }
}

function transcriptLine(
  message: SummaryMessage,
  config: CompanyConfig,
): string {
  const who = message.direction === "inbound" ? "Lead" : "Asistente";
  const body =
    message.type === "text"
      ? message.body
      : `[${message.type}]${message.body ? ` ${message.body}` : ""}`;
  return `[${stamp(message.sentAt, config, "short")}] ${who}: ${body}`;
}

/**
 * The long text written to the CRM contact, in one property: status and contact, the model's
 * summary, the collected fields, then the full conversation.
 */
export function buildCrmSummary(input: {
  action: CrmActionKind;
  thread: SummaryThread;
  messages: SummaryMessage[];
  config: CompanyConfig;
  now: Date;
}): string {
  const { thread, config } = input;
  const header = [
    `Resumen del asistente de WhatsApp (actualizado ${stamp(input.now, config, "full")})`,
    `Estado: ${ACTION_LABEL[input.action]}`,
    `Teléfono: ${thread.phone}`,
    `Nombre en WhatsApp: ${thread.name ?? "—"}`,
    thread.email ? `Email: ${thread.email}` : null,
    `Horario para llamar: ${thread.callTime ?? "—"}`,
    input.action === "needs_human" && thread.needsHumanReason
      ? `Motivo: ${thread.needsHumanReason}`
      : null,
  ].filter((line): line is string => line !== null);
  const fields = collectedRows(thread.collected, config).map(
    (row) => `${row.name}: ${row.value ?? "—"}`,
  );
  const transcript = input.messages.map((message) =>
    transcriptLine(message, config),
  );
  return [
    ...header,
    "",
    "Resumen:",
    thread.summary?.trim() || "—",
    "",
    "Datos del lead:",
    ...fields,
    "",
    "Conversación:",
    ...transcript,
  ].join("\n");
}
