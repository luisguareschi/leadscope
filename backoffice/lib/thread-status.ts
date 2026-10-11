import type { Thread, ThreadStatusFilter } from "./types";

export type DisplayStatus = "needs_human" | "paused" | "new" | "qualifying" | "answering" | "scheduling" | "handed_off" | "closed";

/** Flags win over the stage, the same way the backend's filters partition threads. */
export function displayStatus(thread: Pick<Thread, "needsHuman" | "paused" | "state" | "callTime">): DisplayStatus {
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

export const STATUS_META: Record<DisplayStatus, { label: string; className: string }> = {
  needs_human: { label: "Requiere asesor", className: "bg-amber-500/15 text-amber-800 dark:text-amber-300" },
  paused: { label: "Pausada", className: "bg-muted text-muted-foreground" },
  new: { label: "Nueva", className: "bg-primary/10 text-primary" },
  qualifying: { label: "Calificando", className: "bg-primary/10 text-primary" },
  answering: { label: "Respondiendo", className: "bg-primary/10 text-primary" },
  scheduling: { label: "Coordinando llamada", className: "bg-sky-500/15 text-sky-800 dark:text-sky-300" },
  handed_off: { label: "Derivada", className: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300" },
  closed: { label: "Cerrada", className: "bg-muted text-muted-foreground" },
};

export const FILTERS: Array<{ value: ThreadStatusFilter; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "active", label: "En curso" },
  { value: "handoff", label: "Derivadas" },
  { value: "needs_human", label: "Requieren asesor" },
  { value: "paused", label: "Pausadas" },
  { value: "closed", label: "Cerradas" },
];

export function isStatusFilter(value: string | null): value is ThreadStatusFilter {
  return FILTERS.some((filter) => filter.value === value);
}

/** Why the bot stopped, in words an operator understands. */
export function needsHumanReasonLabel(reason: string | null): string {
  if (!reason) return "El asistente se detuvo.";
  if (reason === "lead_needs_human") return "El lead preguntó algo que tiene que responder una persona.";
  if (reason.startsWith("blocked_reply")) return "La respuesta del asistente tocaba un tema prohibido y no se envió.";
  if (reason.startsWith("model_failure")) return "El modelo de IA no respondió a tiempo.";
  if (reason === "empty_reply") return "El modelo de IA devolvió una respuesta vacía.";
  if (reason.startsWith("send_failed")) return `WhatsApp no entregó la respuesta (${reason.slice("send_failed: ".length)}).`;
  if (reason === "channel_unavailable") return "WhatsApp no está configurado para esta empresa.";
  return reason;
}
