"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useClearSecret, useSetSecret } from "@/lib/queries";
import type { SecretStatus } from "@/lib/types";

const COPY: Record<SecretStatus["name"], { title: string; description: string }> = {
  anthropicApiKey: {
    title: "Clave de Anthropic",
    description: "La usa el asistente para responder.",
  },
  metaAccessToken: {
    title: "Token de Meta",
    description: "Envía y recibe los mensajes de WhatsApp.",
  },
  hubspotAccessToken: {
    title: "Token de HubSpot",
    description: "Crea el contacto y guarda la conversación.",
  },
  formLeadSecret: {
    title: "Secreto del formulario",
    description: "Lo envía el flujo de HubSpot cuando entra un lead de un formulario.",
  },
};

export function SecretRow({ secret }: { secret: SecretStatus }) {
  const copy = COPY[secret.name];
  const [draft, setDraft] = useState("");
  const [confirming, setConfirming] = useState(false);
  const save = useSetSecret();
  const clear = useClearSecret();
  const inputId = `secret-${secret.name}`;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const value = draft.trim();
    if (!value) return;
    save.mutate(
      { name: secret.name, value },
      {
        onSuccess: () => {
          setDraft("");
          toast.success("Clave guardada.");
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <>
      <form onSubmit={onSubmit} autoComplete="off" className="px-4 py-5 lg:px-6">
        <Field>
          <div className="flex flex-wrap items-center gap-2">
            <FieldLabel htmlFor={inputId}>{copy.title}</FieldLabel>
            <Badge variant={secret.set ? "secondary" : "outline"}>{secret.set ? "Configurada" : "Sin configurar"}</Badge>
            {secret.last4 ? (
              <span className="font-mono text-xs text-muted-foreground" title="Últimos 4 caracteres">
                …{secret.last4}
              </span>
            ) : null}
          </div>
          <FieldDescription>{copy.description}</FieldDescription>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              id={inputId}
              name={inputId}
              type="password"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              value={draft}
              placeholder={secret.set ? "Pegá un valor nuevo para reemplazarla" : "Pegá el valor"}
              onChange={(event) => setDraft(event.target.value)}
              className="sm:max-w-md"
            />
            <div className="flex gap-2">
              <Button type="submit" disabled={!draft.trim() || save.isPending}>
                {save.isPending ? <Spinner /> : null}
                Guardar
              </Button>
              {secret.set ? (
                <Button type="button" variant="outline" onClick={() => setConfirming(true)} disabled={clear.isPending}>
                  Quitar
                </Button>
              ) : null}
            </div>
          </div>
          <FieldDescription>Guardar reemplaza esta clave. Si lo dejás vacío, no cambia.</FieldDescription>
        </Field>
      </form>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quitar {copy.title}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta integración deja de usar la clave hasta que cargues otra. Las demás no cambian.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={clear.isPending}
              onClick={() => {
                clear.mutate(secret.name, {
                  onSuccess: () => {
                    setDraft("");
                    setConfirming(false);
                    toast.success("Clave quitada.");
                  },
                  onError: (error) => toast.error(error.message),
                });
              }}
            >
              {clear.isPending ? <Spinner /> : null}
              Quitar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
