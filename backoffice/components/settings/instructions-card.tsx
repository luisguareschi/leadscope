"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { useSaveInstructions } from "@/lib/queries";

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
    <Card className="gap-0 shadow-xs">
      <CardHeader className="border-b">
        <CardTitle>Instrucciones de la empresa</CardTitle>
        <CardDescription>
          Lo que el asistente tiene que saber de la empresa y cómo querés que
          hable de ella, en tus palabras. Van después de las reglas de la
          plataforma: si se contradicen, ganan las reglas. Precios y proyectos
          van en Conocimiento.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Field data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor="company-instructions" className="sr-only">
              Instrucciones de la empresa
            </FieldLabel>
            <Textarea
              id="company-instructions"
              value={draft}
              maxLength={maxChars + 200}
              aria-invalid={error ? true : undefined}
              placeholder="Quiénes son, en qué zonas trabajan, cómo se presentan, qué conviene evitar…"
              className="min-h-56"
              onChange={(event) => {
                setDraft(event.target.value);
                setError(null);
              }}
            />
            <FieldDescription
              className={length > maxChars ? "text-destructive" : undefined}
            >
              {formatNumber(length)} de {formatNumber(maxChars)} caracteres.
            </FieldDescription>
            <FieldError>{error}</FieldError>
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={!dirty || save.isPending}>
              {save.isPending ? <Spinner /> : null}
              Guardar instrucciones
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!dirty || save.isPending}
              onClick={() => {
                setDraft(instructions);
                setError(null);
              }}
            >
              Descartar cambios
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
