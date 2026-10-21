"use client";

import { useState } from "react";
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { cn } from "cn";
import { Panel } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { MAX_COLLECT_ITEMS } from "@/lib/types";
import { newItemId, type CollectItemDraft } from "./config-draft";
import { useConfigEditor } from "./config-editor";

/** "Zona preferida" → "zonaPreferida": what a new item is stored under until the key is typed. */
function keyFromName(name: string): string {
  const words = name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  const key = words
    .map((word, index) =>
      index === 0
        ? word.toLowerCase()
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join("")
    .replace(/^[0-9]+/, "");
  return key.slice(0, 40);
}

function ItemRow({
  item,
  index,
  count,
  isNew,
  onChange,
  onMove,
  onRemove,
}: {
  item: CollectItemDraft;
  index: number;
  count: number;
  /** Added in this draft: its key follows the name until edited. */
  isNew: boolean;
  onChange: (next: CollectItemDraft, keyEdited?: boolean) => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
}) {
  const { itemErrors } = useConfigEditor();
  const error = (field: keyof CollectItemDraft) =>
    itemErrors[`${index}.${field}`];
  const id = (field: string) => `collect-${item.id}-${field}`;
  const errorText = ["name", "key", "description", "required"]
    .map((field) => error(field as keyof CollectItemDraft))
    .filter(Boolean);

  return (
    <li
      className="flex gap-3 px-5 py-4"
      aria-label={`Dato ${index + 1}: ${item.name || "sin nombre"}`}
    >
      <span className="mt-1.5 flex size-6 shrink-0 items-center justify-center rounded-full border bg-muted/40 text-xs font-medium text-muted-foreground tabular-nums">
        {index + 1}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="grid gap-3 @2xl/content:grid-cols-[minmax(0,1fr)_14rem]">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={id("name")} className="text-[13px]">
              Nombre
            </Label>
            <Input
              id={id("name")}
              value={item.name}
              maxLength={60}
              placeholder="Por ejemplo, Presupuesto"
              aria-invalid={error("name") ? true : undefined}
              onChange={(event) => {
                const name = event.target.value;
                onChange({
                  ...item,
                  name,
                  key: isNew ? keyFromName(name) : item.key,
                });
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={id("key")} className="text-[13px]">
              Clave
            </Label>
            <Input
              id={id("key")}
              value={item.key}
              maxLength={40}
              spellCheck={false}
              placeholder="presupuesto"
              className="font-mono text-xs md:text-xs"
              aria-invalid={error("key") ? true : undefined}
              onChange={(event) =>
                onChange({ ...item, key: event.target.value }, true)
              }
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id("description")} className="text-[13px]">
            Qué averiguar
          </Label>
          <Textarea
            id={id("description")}
            value={item.description}
            maxLength={300}
            className="min-h-9"
            placeholder="Por ejemplo: con qué presupuesto aproximado cuenta (monto y moneda, o un rango)."
            aria-invalid={error("description") ? true : undefined}
            onChange={(event) =>
              onChange({ ...item, description: event.target.value })
            }
          />
        </div>
        {errorText.length > 0 ? (
          <p role="alert" className="text-sm text-destructive">
            {errorText.join(" ")}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-1">
            <label
              htmlFor={id("required")}
              className="flex items-center gap-2 text-[13px] font-medium"
            >
              <Switch
                id={id("required")}
                checked={item.required}
                onCheckedChange={(checked) =>
                  onChange({ ...item, required: checked })
                }
              />
              {item.required ? "Necesario para Por contactar" : "Opcional"}
            </label>
            <p className="text-xs text-muted-foreground">
              {item.required
                ? "El lead pasa a Por contactar recién cuando lo sabe, salvo que pida hablar con alguien ya."
                : "Lo pregunta si surge; no frena el paso a Por contactar."}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Subir"
              disabled={index === 0}
              onClick={() => onMove(-1)}
            >
              <ArrowUpIcon />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Bajar"
              disabled={index === count - 1}
              onClick={() => onMove(1)}
            >
              <ArrowDownIcon />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Quitar ${item.name || "dato"}`}
              disabled={count === 1}
              onClick={onRemove}
            >
              <Trash2Icon />
            </Button>
          </div>
        </div>
      </div>
    </li>
  );
}

/** The information the assistant finds out from each lead, edited as part of the config draft. */
export function CollectEditor() {
  const { draft, errors, set } = useConfigEditor();
  const items = draft.collect;
  // Items added since the draft loaded, whose key still follows the name.
  const [autoKey, setAutoKey] = useState<Set<string>>(() => new Set());
  const full = items.length >= MAX_COLLECT_ITEMS;
  const required = items.filter((item) => item.required).length;

  const update = (next: CollectItemDraft[]) => set("collect", next);

  return (
    <Panel
      title="Información a recopilar"
      description="Lo que el asistente averigua del lead, con sus palabras y en el orden que surja. No repite lo que el lead ya dijo. Con todos los necesarios, el lead pasa a Por contactar y el asistente le pide un horario. Si el lead pide hablar con alguien ya («Quiere hablar ya»), pasa enseguida aunque falten. Si ninguno es necesario, pasa cuando da un horario para la llamada."
      actions={
        <span
          className={cn(
            "text-xs tabular-nums",
            full ? "font-medium text-foreground" : "text-muted-foreground",
          )}
        >
          {items.length} / {MAX_COLLECT_ITEMS}
        </span>
      }
    >
      <div id="config-collect" tabIndex={-1} className="outline-none">
        <ol className="divide-y">
          {items.map((item, index) => (
            <ItemRow
              key={item.id}
              item={item}
              index={index}
              count={items.length}
              isNew={autoKey.has(item.id)}
              onChange={(next, keyEdited) => {
                if (keyEdited && autoKey.has(item.id)) {
                  const rest = new Set(autoKey);
                  rest.delete(item.id);
                  setAutoKey(rest);
                }
                update(
                  items.map((current) =>
                    current.id === item.id ? next : current,
                  ),
                );
              }}
              onMove={(delta) => {
                const next = [...items];
                const [moved] = next.splice(index, 1);
                next.splice(index + delta, 0, moved!);
                update(next);
              }}
              onRemove={() =>
                update(items.filter((current) => current.id !== item.id))
              }
            />
          ))}
        </ol>
        <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/20 px-5 py-3">
          <p
            role={errors.collect ? "alert" : undefined}
            className={cn(
              "text-[13px]",
              errors.collect ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {errors.collect ??
              (full
                ? `Llegaste al máximo de ${MAX_COLLECT_ITEMS} datos. Quitá uno para agregar otro.`
                : required === 0
                  ? "Ninguno necesario: el lead pasa a Por contactar cuando da un horario para la llamada."
                  : `${required} necesario${required === 1 ? "" : "s"} para Por contactar · ${items.length - required} opcional${items.length - required === 1 ? "" : "es"}`)}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={full}
            onClick={() => {
              const id = newItemId();
              setAutoKey(new Set(autoKey).add(id));
              update([
                ...items,
                { id, key: "", name: "", description: "", required: true },
              ]);
            }}
          >
            <PlusIcon />
            Agregar dato
          </Button>
        </div>
      </div>
    </Panel>
  );
}
