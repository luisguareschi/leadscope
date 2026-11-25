export const SYSTEM_STAGE_KEYS = [
  "qualifying",
  "to_contact",
  "contacted",
  "not_interested",
  "disqualified",
  "no_response",
] as const;

export type SystemLeadStage = (typeof SYSTEM_STAGE_KEYS)[number];

/** Pipeline stage key: one of the 6 engine system stages or a company-defined custom stage key. */
export type LeadStage = string;

export const STAGE_COLORS = [
  "pending",
  "warning",
  "ok",
  "muted",
  "error",
  "info",
] as const;

export type StageColor = (typeof STAGE_COLORS)[number];

export type StageConfig = {
  key: string;
  label: string;
  color: StageColor;
  system: boolean;
};

export const MAX_CUSTOM_STAGES = 10;

export const DEFAULT_STAGES: readonly StageConfig[] = [
  { key: "qualifying", label: "Calificando", color: "pending", system: true },
  { key: "to_contact", label: "Por contactar", color: "warning", system: true },
  { key: "contacted", label: "Contactado", color: "ok", system: true },
  {
    key: "not_interested",
    label: "Sin interés",
    color: "muted",
    system: true,
  },
  {
    key: "disqualified",
    label: "Descalificado",
    color: "error",
    system: true,
  },
  { key: "no_response", label: "Sin respuesta", color: "muted", system: true },
];

const SYSTEM_STAGE_SET = new Set<string>(SYSTEM_STAGE_KEYS);

export function isSystemStage(key: string): key is SystemLeadStage {
  return SYSTEM_STAGE_SET.has(key);
}

/** Stages that represent a closed lead before sales takeover. */
export function isClosedStage(key: string): boolean {
  return (
    key === "not_interested" || key === "disqualified" || key === "no_response"
  );
}

/**
 * Ensures every company config contains all 6 system stages (preserving any custom labels, colors,
 * ordering, and company-defined custom stages). Missing system stages are appended with defaults.
 */
export function normalizeStages(
  stages: StageConfig[] | undefined | null,
): StageConfig[] {
  if (!Array.isArray(stages) || stages.length === 0) {
    return DEFAULT_STAGES.map((stage) => ({ ...stage }));
  }
  const seen = new Set<string>();
  const result: StageConfig[] = [];
  const defaultByKey = new Map(
    DEFAULT_STAGES.map((stage) => [stage.key, stage]),
  );
  for (const stage of stages) {
    const key = stage.key.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const sysDefault = defaultByKey.get(key);
    if (sysDefault) {
      // Base assistant stages stay read-only with canonical label and color.
      result.push({ ...sysDefault });
      continue;
    }
    result.push({
      key,
      label: stage.label.trim() || defaultLabelFor(key),
      color: STAGE_COLORS.includes(stage.color) ? stage.color : "muted",
      system: false,
    });
  }
  for (const def of DEFAULT_STAGES) {
    if (!seen.has(def.key)) result.push({ ...def });
  }
  return result;
}

export function defaultLabelFor(key: string): string {
  return DEFAULT_STAGES.find((stage) => stage.key === key)?.label ?? key;
}

export function findStage(
  stages: readonly StageConfig[],
  key: string,
): StageConfig | undefined {
  return stages.find((stage) => stage.key === key);
}

export function stageLabel(
  stages: readonly StageConfig[],
  key: string,
): string {
  return findStage(stages, key)?.label ?? defaultLabelFor(key);
}
