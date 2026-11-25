import type { Tone } from "@/components/panel";
import type {
  BotActivity,
  BotFilter,
  LeadStage,
  StageConfig,
  StageFilter,
  SystemLeadStage,
} from "./types";

export const SYSTEM_STAGE_META: Record<
  SystemLeadStage,
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
    description: "El lead indicó que no tiene interés o escribió por error.",
  },
  disqualified: {
    label: "Descalificado",
    tone: "error",
    description:
      "El lead tiene interés pero no cumple con lo que ofrece la empresa.",
  },
  no_response: {
    label: "Sin respuesta",
    tone: "muted",
    description:
      "El lead dejó de responder durante la calificación. Si vuelve a escribir, retoma automáticamente.",
  },
};

/** Backwards-compatible alias for the system stages. */
export const STAGE_META = SYSTEM_STAGE_META;

export const DEFAULT_STAGE_CONFIGS: StageConfig[] = [
  { key: "qualifying", label: "Calificando", color: "pending", system: true },
  { key: "to_contact", label: "Por contactar", color: "warning", system: true },
  { key: "contacted", label: "Contactado", color: "ok", system: true },
  { key: "not_interested", label: "Sin interés", color: "muted", system: true },
  { key: "disqualified", label: "Descalificado", color: "error", system: true },
  { key: "no_response", label: "Sin respuesta", color: "muted", system: true },
];

/** Default order of system stages for charts and fallbacks. */
export const STAGE_ORDER: SystemLeadStage[] = [
  "qualifying",
  "to_contact",
  "contacted",
  "not_interested",
  "disqualified",
  "no_response",
];

export const STAGE_CHART_COLOR: Record<SystemLeadStage, string> = {
  qualifying: "var(--chart-1)",
  to_contact: "var(--chart-2)",
  contacted: "var(--chart-3)",
  not_interested: "var(--chart-4)",
  disqualified: "var(--chart-5)",
  no_response: "var(--chart-6)",
};

export function stagesForCompany(
  stages: StageConfig[] | undefined,
): StageConfig[] {
  return stages && stages.length > 0 ? stages : DEFAULT_STAGE_CONFIGS;
}

export function stageMetaOf(
  stage: LeadStage,
  stages?: StageConfig[],
): { label: string; tone: Tone; description: string } {
  const configured = stages?.find((item) => item.key === stage);
  const sys = SYSTEM_STAGE_META[stage as SystemLeadStage];
  if (configured) {
    return {
      label: configured.label,
      tone: configured.color,
      description:
        sys?.description ??
        "Etapa personalizada del proceso comercial. El asistente responde preguntas sin volver a calificar.",
    };
  }
  if (sys) return sys;
  return {
    label: stage,
    tone: "muted",
    description: "Etapa personalizada.",
  };
}

export function stageFiltersFor(
  stages?: StageConfig[],
): Array<{ value: StageFilter; label: string }> {
  const list = stagesForCompany(stages);
  // Show Por contactar right after Todas so the advisors' queue stays prominent.
  const ordered = [
    ...list.filter((s) => s.key === "to_contact"),
    ...list.filter((s) => s.key !== "to_contact"),
  ];
  return [
    { value: "all", label: "Todas" },
    ...ordered.map((s) => ({ value: s.key, label: s.label })),
  ];
}

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

export const BOT_FILTERS: Array<{ value: BotFilter; label: string }> = [
  { value: "all", label: "Asistente: todos" },
  { value: "active", label: "Respondiendo" },
  { value: "paused", label: "Pausado" },
  { value: "needs_human", label: "Requiere asesor" },
];

export function isStageFilter(
  value: string | null,
  stages?: StageConfig[],
): value is StageFilter {
  if (!value) return false;
  if (value === "all") return true;
  return stagesForCompany(stages).some((stage) => stage.key === value);
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
