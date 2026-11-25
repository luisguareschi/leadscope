"use client";

import { useState } from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  LockIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { cn } from "cn";
import { Panel, StatusDot } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_CUSTOM_STAGES, type StageColor } from "@/lib/types";
import { newItemId, type StageConfigDraft } from "./config-draft";
import { useConfigEditor } from "./config-editor";

const COLOR_OPTIONS: Array<{ value: StageColor; label: string }> = [
  { value: "pending", label: "Azul claro" },
  { value: "warning", label: "Ámbar" },
  { value: "ok", label: "Verde" },
  { value: "info", label: "Azul" },
  { value: "error", label: "Rojo" },
  { value: "muted", label: "Gris" },
];

const SYSTEM_STAGE_HINTS: Record<string, string> = {
  qualifying: "El asistente está recopilando los datos iniciales del lead.",
  to_contact: "Lead calificado o que pidió hablar con una persona.",
  contacted: "Un asesor ya tomó contacto con el lead.",
  not_interested: "El lead indicó que no está interesado.",
  disqualified: "No cumple el perfil o busca algo fuera de la oferta.",
  no_response: "Sin respuesta tras el plazo de inactividad configurado.",
};

function keyFromLabel(label: string): string {
  const words = label
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  return words
    .map((word) => word.toLowerCase())
    .join("_")
    .replace(/^[0-9_]+/, "")
    .slice(0, 40);
}

/**
 * Pipeline stages editor: the 6 system base stages are strictly read-only; operators can add,
 * rename, recolor, reorder, and delete up to 10 custom company stages.
 */
export function StagesEditor() {
  const { draft, errors, stageErrors, set } = useConfigEditor();
  const stages = draft.stages;
  const [autoKey, setAutoKey] = useState<Set<string>>(() => new Set());
  const [showKeys, setShowKeys] = useState(false);

  const systemStages = stages.filter((stage) => stage.system);
  const customEntries = stages
    .map((stage, fullIndex) => ({ stage, fullIndex }))
    .filter(({ stage }) => !stage.system);
  const customCount = customEntries.length;
  const full = customCount >= MAX_CUSTOM_STAGES;
  const hasKeyError = Object.keys(stageErrors).some((k) => k.endsWith(".key"));
  const keysVisible = showKeys || hasKeyError;

  const updateCustom = (nextCustom: StageConfigDraft[]) =>
    set("stages", [...systemStages, ...nextCustom]);

  return (
    <div
      id="config-stages"
      tabIndex={-1}
      className="flex flex-col gap-5 outline-none"
    >
      <Panel
        title="Etapas base del asistente"
        description="Estas 6 etapas las usa el asistente automáticamente y no se pueden modificar ni eliminar."
        actions={
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            <LockIcon className="size-3" />
            Solo lectura
          </span>
        }
      >
        <ul className="divide-y">
          {systemStages.map((stage) => (
            <li
              key={stage.key}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <StatusDot tone={stage.color} className="size-2.5 shrink-0" />
                <span className="text-sm font-medium">{stage.label}</span>
                {keysVisible ? (
                  <span className="font-mono text-xs text-muted-foreground">
                    {stage.key}
                  </span>
                ) : null}
              </div>
              {SYSTEM_STAGE_HINTS[stage.key] ? (
                <span className="text-xs text-muted-foreground">
                  {SYSTEM_STAGE_HINTS[stage.key]}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </Panel>

      <Panel
        title="Etapas personalizadas"
        description="Agrega etapas propias de tu proceso comercial (por ejemplo, Visita agendada o Propuesta enviada). El asistente sigue respondiendo sin volver a calificar."
        actions={
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowKeys((v) => !v)}
              className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {keysVisible ? "Ocultar claves" : "Claves técnicas"}
            </button>
            <span
              className={cn(
                "text-xs tabular-nums",
                full ? "font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              {customCount} / {MAX_CUSTOM_STAGES}
            </span>
          </div>
        }
      >
        {customEntries.length > 0 ? (
          <ol className="divide-y">
            {customEntries.map(({ stage, fullIndex }, customIndex) => {
              const err = (field: string) =>
                stageErrors[`${fullIndex}.${field}`];
              const errorText = ["label", "key", "color", "system"]
                .map(err)
                .filter(Boolean);
              const id = (field: string) => `stage-${stage.id}-${field}`;
              const customList = customEntries.map((entry) => entry.stage);
              return (
                <li key={stage.id} className="flex flex-col gap-3 px-5 py-4">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="flex min-w-44 flex-1 flex-col gap-1.5">
                      <Label htmlFor={id("label")} className="text-[13px]">
                        Nombre
                      </Label>
                      <Input
                        id={id("label")}
                        value={stage.label}
                        maxLength={40}
                        placeholder="Ej.: Visita agendada"
                        aria-invalid={err("label") ? true : undefined}
                        onChange={(event) => {
                          const label = event.target.value;
                          updateCustom(
                            customList.map((current) =>
                              current.id === stage.id
                                ? {
                                    ...current,
                                    label,
                                    key: autoKey.has(stage.id)
                                      ? keyFromLabel(label)
                                      : current.key,
                                  }
                                : current,
                            ),
                          );
                        }}
                      />
                    </div>
                    {keysVisible ? (
                      <div className="flex w-44 flex-col gap-1.5">
                        <Label htmlFor={id("key")} className="text-[13px]">
                          Clave
                        </Label>
                        <Input
                          id={id("key")}
                          value={stage.key}
                          maxLength={40}
                          spellCheck={false}
                          className="font-mono text-xs md:text-xs"
                          aria-invalid={err("key") ? true : undefined}
                          onChange={(event) => {
                            if (autoKey.has(stage.id)) {
                              const next = new Set(autoKey);
                              next.delete(stage.id);
                              setAutoKey(next);
                            }
                            updateCustom(
                              customList.map((current) =>
                                current.id === stage.id
                                  ? { ...current, key: event.target.value }
                                  : current,
                              ),
                            );
                          }}
                        />
                      </div>
                    ) : null}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[13px] font-medium">Color</span>
                      <div
                        role="radiogroup"
                        aria-label={`Color para ${stage.label || "etapa"}`}
                        className="flex h-9 items-center gap-1 rounded-lg bg-muted/60 px-2"
                      >
                        {COLOR_OPTIONS.map((option) => {
                          const selected = stage.color === option.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              role="radio"
                              aria-checked={selected}
                              aria-label={option.label}
                              title={option.label}
                              onClick={() =>
                                updateCustom(
                                  customList.map((current) =>
                                    current.id === stage.id
                                      ? { ...current, color: option.value }
                                      : current,
                                  ),
                                )
                              }
                              className={cn(
                                "flex size-6 items-center justify-center rounded-full transition-shadow",
                                selected
                                  ? "bg-card shadow-xs ring-2 ring-ring"
                                  : "hover:bg-card/60",
                              )}
                            >
                              <StatusDot
                                tone={option.value}
                                className="size-2.5"
                              />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Subir"
                        disabled={customIndex === 0}
                        onClick={() => {
                          const next = [...customList];
                          const [moved] = next.splice(customIndex, 1);
                          next.splice(customIndex - 1, 0, moved!);
                          updateCustom(next);
                        }}
                      >
                        <ArrowUpIcon />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Bajar"
                        disabled={customIndex === customList.length - 1}
                        onClick={() => {
                          const next = [...customList];
                          const [moved] = next.splice(customIndex, 1);
                          next.splice(customIndex + 1, 0, moved!);
                          updateCustom(next);
                        }}
                      >
                        <ArrowDownIcon />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Quitar ${stage.label || "etapa"}`}
                        title="Eliminar etapa"
                        onClick={() =>
                          updateCustom(
                            customList.filter(
                              (current) => current.id !== stage.id,
                            ),
                          )
                        }
                      >
                        <Trash2Icon />
                      </Button>
                    </div>
                  </div>
                  {errorText.length > 0 ? (
                    <p role="alert" className="text-sm text-destructive">
                      {errorText.join(" ")}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="px-5 py-4 text-sm text-muted-foreground">
            Aún no agregaste etapas personalizadas.
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
          <p
            role={errors.stages ? "alert" : undefined}
            className={cn(
              "text-[13px]",
              errors.stages ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {errors.stages ??
              (full
                ? `Alcanzaste el límite de ${MAX_CUSTOM_STAGES} etapas personalizadas.`
                : "Puedes agregar hasta 10 etapas extra para tu equipo comercial.")}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={full}
            onClick={() => {
              const id = newItemId();
              setAutoKey((prev) => new Set(prev).add(id));
              updateCustom([
                ...customEntries.map((entry) => entry.stage),
                {
                  id,
                  key: "",
                  label: "",
                  color: "info",
                  system: false,
                },
              ]);
            }}
          >
            <PlusIcon />
            Agregar etapa
          </Button>
        </div>
      </Panel>
    </div>
  );
}
