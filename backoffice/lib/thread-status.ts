import type { Tone } from "@/components/panel";
import type { BotActivity, BotFilter, LeadStage, StageFilter } from "./types";

export const STAGE_META: Record<
  LeadStage,
  { label: string; tone: Tone; description: string }
> = {
  qualifying: {
    label: "Calificando",
    tone: "pending",
    description:
      "El asistente recopila los datos configurados para calificar al lead.",
  },
  to_contact: {
    label: "Por contactar",
    tone: "warning",
    description:
      "Lead calificado o que pidió hablar con una persona. Espera a un asesor.",
  },
  contacted: {
    label: "Contactado",
    tone: "ok",
    description:
      "Ya fue atendido por un asesor. El asistente sigue respondiendo preguntas sin volver a calificar.",
  },
  not_interested: {
    label: "Sin interés",
    tone: "muted",
    description: "El lead indicó que no tiene interés o fue descartado.",
  },
};

/** The order of the stage picker. */
export const STAGE_ORDER: LeadStage[] = [
  "qualifying",
  "to_contact",
  "contacted",
  "not_interested",
];

/**
 * Chart series for each stage, in `STAGE_ORDER`. The tokens in `app/globals.css`
 * follow the picker dots: a lighter primary (Calificando), the solid primary
 * (Por contactar), status-ok (Contactado), and muted (Sin interés).
 */
export const STAGE_CHART_COLOR: Record<LeadStage, string> = {
  qualifying: "var(--chart-1)",
  to_contact: "var(--chart-2)",
  contacted: "var(--chart-3)",
  not_interested: "var(--chart-4)",
};

export const BOT_META: Record<
  BotActivity,
  { label: string; tone: Tone; description: string }
> = {
  active: {
    label: "Respondiendo",
    tone: "info",
    description: "El asistente responde automáticamente.",
  },
  paused: {
    label: "Pausado",
    tone: "muted",
    description: "Pausado manualmente o tras responder desde el panel.",
  },
  needs_human: {
    label: "Requiere asesor",
    tone: "warning",
    description:
      "Detenido por tema prohibido, consulta compleja o error. Espera atención humana.",
  },
};

export const STAGE_FILTERS: Array<{ value: StageFilter; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "to_contact", label: "Por contactar" },
  { value: "qualifying", label: "Calificando" },
  { value: "contacted", label: "Contactadas" },
  { value: "not_interested", label: "Sin interés" },
];

export const BOT_FILTERS: Array<{ value: BotFilter; label: string }> = [
  { value: "all", label: "Asistente: todos" },
  { value: "active", label: "Respondiendo" },
  { value: "paused", label: "Pausado" },
  { value: "needs_human", label: "Requiere asesor" },
];

export function isStageFilter(value: string | null): value is StageFilter {
  return STAGE_FILTERS.some((filter) => filter.value === value);
}

export function isBotFilter(value: string | null): value is BotFilter {
  return BOT_FILTERS.some((filter) => filter.value === value);
}

/** "ana@empresa.com" → "ana". Operators only have an email. */
export function operatorName(email: string): string {
  return email.replace(/@.*/, "");
}

/** Why the bot stopped, in words an operator understands. */
export function needsHumanReasonLabel(reason: string | null): string {
  if (!reason) return "El asistente se detuvo.";
  if (reason === "lead_needs_human")
    return "El lead hizo una consulta que debe responder una persona.";
  if (reason.startsWith("forbidden_topic"))
    return `Tema prohibido: "${reason.slice("forbidden_topic: ".length)}". Se envió el mensaje fijo.`;
  if (reason.startsWith("blocked_reply"))
    return "La respuesta incluía un tema prohibido y no se envió.";
  if (reason.startsWith("model_failure"))
    return "El modelo de IA no respondió a tiempo.";
  if (reason === "empty_reply")
    return "El modelo de IA devolvió una respuesta vacía.";
  if (reason.startsWith("send_failed"))
    return `WhatsApp no entregó el mensaje (${reason.slice("send_failed: ".length)}).`;
  if (reason === "channel_unavailable")
    return "WhatsApp no está configurado para esta empresa.";
  return reason;
}
