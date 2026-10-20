import type { Tone } from "@/components/panel";
import type {
  BotActivity,
  BotFilter,
  LeadStage,
  StageFilter,
} from "./types";

export const STAGE_META: Record<
  LeadStage,
  { label: string; tone: Tone; description: string }
> = {
  qualifying: {
    label: "Calificando",
    tone: "pending",
    description:
      "El asistente averigua lo que la empresa pide en Configuración (por ejemplo qué busca y su presupuesto), en el orden que surja.",
  },
  to_contact: {
    label: "Por contactar",
    tone: "warning",
    description:
      "El lead ya dio todos los datos obligatorios y espera a un asesor. Queda acá aunque vuelva a escribir, hasta que alguien lo marque como contactado.",
  },
  contacted: {
    label: "Contactado",
    tone: "ok",
    description:
      "Un asesor ya habló con el lead. El asistente sigue respondiendo sus preguntas, sin volver a pedirle datos.",
  },
  not_interested: {
    label: "Sin interés",
    tone: "muted",
    description:
      "El lead dijo que no le interesa. Queda en HubSpot sin asesor; si vuelve a escribir y da los datos, pasa a Por contactar.",
  },
};

export const BOT_META: Record<
  BotActivity,
  { label: string; tone: Tone; description: string }
> = {
  active: {
    label: "Respondiendo",
    tone: "info",
    description: "El asistente responde los mensajes del lead.",
  },
  paused: {
    label: "Pausado",
    tone: "muted",
    description:
      "Un asesor pausó el asistente en esta conversación. Los mensajes se guardan, pero no responde hasta que lo reanuden.",
  },
  needs_human: {
    label: "Requiere asesor",
    tone: "warning",
    description:
      "El asistente se detuvo (una queja, un tema prohibido o un error) y no responde hasta que alguien la marque como atendida.",
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

/** "ana@altamira.uy" → "ana". Operators only have an email. */
export function operatorName(email: string): string {
  return email.replace(/@.*/, "");
}

/** Why the bot stopped, in words an operator understands. */
export function needsHumanReasonLabel(reason: string | null): string {
  if (!reason) return "El asistente se detuvo.";
  if (reason === "lead_needs_human")
    return "El lead preguntó algo que tiene que responder una persona.";
  if (reason.startsWith("forbidden_topic"))
    return `El lead preguntó por un tema prohibido: «${reason.slice("forbidden_topic: ".length)}». El asistente no respondió y envió el mensaje fijo.`;
  if (reason.startsWith("blocked_reply"))
    return "La respuesta del asistente tocaba un tema prohibido y no se envió.";
  if (reason.startsWith("model_failure"))
    return "El modelo de IA no respondió a tiempo.";
  if (reason === "empty_reply")
    return "El modelo de IA devolvió una respuesta vacía.";
  if (reason.startsWith("send_failed"))
    return `WhatsApp no entregó la respuesta (${reason.slice("send_failed: ".length)}).`;
  if (reason === "channel_unavailable")
    return "WhatsApp no está configurado para esta empresa.";
  return reason;
}
