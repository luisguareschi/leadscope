import type { Tone } from "@/components/panel";
import type { Thread, ThreadStatusFilter } from "./types";

export type DisplayStatus =
  | "needs_human"
  | "paused"
  | "new"
  | "qualifying"
  | "answering"
  | "scheduling"
  | "handed_off"
  | "closed";

/** Flags win over the stage, the same way the backend's filters partition threads. */
export function displayStatus(
  thread: Pick<Thread, "needsHuman" | "paused" | "state" | "callTime">,
): DisplayStatus {
  if (thread.needsHuman) return "needs_human";
  if (thread.paused) return "paused";
  switch (thread.state) {
    case "greeting":
      return "new";
    case "qualify":
      return "qualifying";
    case "answer":
      return "answering";
    case "handoff":
      return thread.callTime ? "handed_off" : "scheduling";
    case "closed":
      return "closed";
  }
}

export const STATUS_META: Record<
  DisplayStatus,
  { label: string; tone: Tone; description: string }
> = {
  needs_human: {
    label: "Requiere asesor",
    tone: "warning",
    description:
      "El asistente se detuvo (una queja, un tema prohibido o un error) y no responde hasta que alguien la marque como atendida.",
  },
  paused: {
    label: "Pausada",
    tone: "muted",
    description:
      "Un asesor tomó la conversación. El asistente no responde hasta que la reanuden.",
  },
  new: {
    label: "Nueva",
    tone: "pending",
    description: "El lead escribió por primera vez y el asistente lo saluda.",
  },
  qualifying: {
    label: "Calificando",
    tone: "pending",
    description:
      "El asistente averigua lo que la empresa pide en Configuración (por ejemplo qué busca y su presupuesto), en el orden que surja.",
  },
  answering: {
    label: "Respondiendo",
    tone: "pending",
    description:
      "El asistente responde las preguntas del lead con lo que hay en Conocimiento, por ejemplo cuando vuelve a escribir después de una derivación.",
  },
  scheduling: {
    label: "Coordinando llamada",
    tone: "info",
    description:
      "El asistente ya sabe todos los datos obligatorios y le pide un horario para que lo llame un asesor.",
  },
  handed_off: {
    label: "Derivada",
    tone: "ok",
    description:
      "El lead dio un horario y espera la llamada de un asesor. Ya está en HubSpot.",
  },
  closed: {
    label: "Cerrada",
    tone: "muted",
    description:
      "El lead dijo que no le interesa. Queda en HubSpot sin asesor; si vuelve a escribir, se reabre.",
  },
};

/** Which statuses each filter shows, for explaining them. */
export const FILTER_STATUSES: Array<{
  filter: Exclude<ThreadStatusFilter, "all">;
  statuses: DisplayStatus[];
}> = [
  { filter: "active", statuses: ["new", "qualifying", "answering"] },
  { filter: "handoff", statuses: ["scheduling", "handed_off"] },
  { filter: "needs_human", statuses: ["needs_human"] },
  { filter: "paused", statuses: ["paused"] },
  { filter: "closed", statuses: ["closed"] },
];

export const FILTERS: Array<{ value: ThreadStatusFilter; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "active", label: "En curso" },
  { value: "handoff", label: "Derivadas" },
  { value: "needs_human", label: "Requieren asesor" },
  { value: "paused", label: "Pausadas" },
  { value: "closed", label: "Cerradas" },
];

export function isStatusFilter(
  value: string | null,
): value is ThreadStatusFilter {
  return FILTERS.some((filter) => filter.value === value);
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
