"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { useSaveInstructions } from "@/lib/queries";
import { SettingsSection } from "./settings-layout";

export function InstructionsCard({
  instructions,
  maxChars,
}: {
  instructions: string;
  maxChars: number;
}) {
  const [draft, setDraft] = useState(instructions);
  const [error, setError] = useState<string | null>(null);
  const save = useSaveInstructions();
  const dirty = draft.trim() !== instructions;
  const length = draft.trim().length;
  const over = length > maxChars;

  // A save re-keys this card with the new version, so the outcome is read from the promise.
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    save.mutateAsync(draft).then(
      (result) =>
        toast.success(
          result.changed
            ? "Instrucciones guardadas. El asistente las usa desde la próxima respuesta."
            : "No había cambios para guardar.",
        ),
      (cause: Error) =>
        setError(
          cause instanceof ApiError
            ? (cause.fields?.instructions ?? cause.message)
            : cause.message,
        ),
    );
  };

  return (
    <SettingsSection
      title="Instrucciones"
      description="Lo que el asistente tiene que saber de la empresa y cómo querés que hable de ella. Precios y proyectos van en Conocimiento."
    >
      <form
        onSubmit={onSubmit}
        className={cn(
          "overflow-hidden rounded-xl border bg-card shadow-xs transition-[box-shadow,border-color] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30",
          error &&
            "border-destructive focus-within:border-destructive focus-within:ring-destructive/20",
        )}
      >
        <label htmlFor="company-instructions" className="sr-only">
          Instrucciones de la empresa
        </label>
        <textarea
          id="company-instructions"
          value={draft}
          maxLength={maxChars + 200}
          aria-invalid={error ? true : undefined}
          placeholder="Quiénes son, en qué zonas trabajan, cómo se presentan, qué conviene evitar…"
          className="field-sizing-content block min-h-80 w-full resize-none bg-transparent px-5 py-4 text-sm leading-relaxed outline-none placeholder:text-muted-foreground"
          onChange={(event) => {
            setDraft(event.target.value);
            setError(null);
          }}
        />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t bg-muted/40 px-5 py-2.5">
          <p
            role={error ? "alert" : undefined}
            className={cn(
              "min-w-0 flex-1 text-[13px]",
              error ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {error ??
              "Van después de las reglas de la plataforma: si se contradicen, ganan las reglas."}
          </p>
          <span
            className={cn(
              "text-xs tabular-nums",
              over ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {formatNumber(length)} / {formatNumber(maxChars)}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!dirty || save.isPending}
              onClick={() => {
                setDraft(instructions);
                setError(null);
              }}
            >
              Descartar
            </Button>
            <Button type="submit" size="sm" disabled={!dirty || save.isPending}>
              {save.isPending ? <Spinner /> : null}
              Guardar
            </Button>
          </div>
        </div>
      </form>
    </SettingsSection>
  );
}
