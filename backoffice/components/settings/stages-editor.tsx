"use client";

import { useState } from "react";
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from "lucide-react";
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

/** Pipeline stages editor: rename/recolor/reorder system stages and add custom company stages. */
export function StagesEditor() {
  const { draft, errors, stageErrors, set } = useConfigEditor();
  const stages = draft.stages;
  const [autoKey, setAutoKey] = useState<Set<string>>(() => new Set());
  const [showKeys, setShowKeys] = useState(false);

  const customCount = stages.filter((stage) => !stage.system).length;
  const full = customCount >= MAX_CUSTOM_STAGES;
  const hasKeyError = Object.keys(stageErrors).some((k) => k.endsWith(".key"));
  const keysVisible = showKeys || hasKeyError;

  const update = (next: StageConfigDraft[]) => set("stages", next);

  return (
    <Panel
      title="Etapas del pipeline"
      description="Personaliza el nombre, color y orden de las etapas base, o agrega etapas propias de tu proceso comercial (por ejemplo, Visita agendada)."
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
            {customCount} / {MAX_CUSTOM_STAGES} extra
          </span>
        </div>
      }
    >
      <div id="config-stages" tabIndex={-1} className="outline-none">
        <ol className="divide-y">
          {stages.map((stage, index) => {
            const err = (field: string) => stageErrors[`${index}.${field}`];
            const errorText = ["label", "key", "color", "system"]
              .map(err)
              .filter(Boolean);
            const id = (field: string) => `stage-${stage.id}-${field}`;
            return (
              <li key={stage.id} className="flex flex-col gap-3 px-5 py-4">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex min-w-44 flex-1 flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <Label htmlFor={id("label")} className="text-[13px]">
                        Nombre
                      </Label>
                      {stage.system ? (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          Base del asistente
                        </span>
                      ) : null}
                    </div>
                    <Input
                      id={id("label")}
                      value={stage.label}
                      maxLength={40}
                      placeholder="Ej.: Visita agendada"
                      aria-invalid={err("label") ? true : undefined}
                      onChange={(event) => {
                        const label = event.target.value;
                        update(
                          stages.map((current) =>
                            current.id === stage.id
                              ? {
                                  ...current,
                                  label,
                                  key:
                                    !stage.system && autoKey.has(stage.id)
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
                        disabled={stage.system}
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
                          update(
                            stages.map((current) =>
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
                              update(
                                stages.map((current) =>
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
                      disabled={index === 0}
                      onClick={() => {
                        const next = [...stages];
                        const [moved] = next.splice(index, 1);
                        next.splice(index - 1, 0, moved!);
                        update(next);
                      }}
                    >
                      <ArrowUpIcon />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Bajar"
                      disabled={index === stages.length - 1}
                      onClick={() => {
                        const next = [...stages];
                        const [moved] = next.splice(index, 1);
                        next.splice(index + 1, 0, moved!);
                        update(next);
                      }}
                    >
                      <ArrowDownIcon />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Quitar ${stage.label || "etapa"}`}
                      disabled={stage.system}
                      title={
                        stage.system
                          ? "Las etapas base las usa el asistente y no se pueden eliminar."
                          : "Eliminar etapa"
                      }
                      onClick={() =>
                        update(
                          stages.filter((current) => current.id !== stage.id),
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
                : "Las etapas personalizadas funcionan como etapas comerciales: el asistente sigue respondiendo sin volver a calificar.")}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={full}
            onClick={() => {
              const id = newItemId();
              setAutoKey((prev) => new Set(prev).add(id));
              update([
                ...stages,
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
      </div>
    </Panel>
  );
}
