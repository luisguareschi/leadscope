"use client";

import { useState, type FormEvent } from "react";
import { CopyIcon, SparklesIcon } from "lucide-react";
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
import { cn } from "cn";

const COPY: Record<
  SecretStatus["name"],
  { title: string; description: string }
> = {
  anthropicApiKey: {
    title: "Clave de Anthropic",
    description: "La usa el asistente para responder.",
  },
  kapsoApiKey: {
    title: "Clave de API de Kapso",
    description:
      "Del proyecto de Kapso de esta empresa (Integrations → API keys). Envía los mensajes y prueba la conexión.",
  },
  kapsoWebhookSecret: {
    title: "Clave secreta del webhook",
    description:
      "La misma que tiene el webhook en Kapso. Con ella LeadScope comprueba que cada aviso viene de Kapso; sin ella rechaza todos.",
  },
  hubspotAccessToken: {
    title: "Token de HubSpot",
    description: "Crea el contacto y guarda la conversación.",
  },
  formLeadSecret: {
    title: "Secreto del formulario",
    description:
      "Lo envía el flujo de HubSpot cuando entra un lead de un formulario.",
  },
};

/** 32 random bytes as hex, made in the browser. The server only ever receives it. */
function randomSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export function SecretRow({
  secret,
  generate = false,
}: {
  secret: SecretStatus;
  /** Offer to make a random value here, to paste into the other system before saving. */
  generate?: boolean;
}) {
  const copy = COPY[secret.name];
  const [draft, setDraft] = useState("");
  const [generated, setGenerated] = useState(false);
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
          setGenerated(false);
          toast.success("Clave guardada.");
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <>
      <form
        onSubmit={onSubmit}
        autoComplete="off"
        className="px-4 py-5 lg:px-6"
      >
        <Field>
          <div className="flex flex-wrap items-center gap-2">
            <FieldLabel htmlFor={inputId}>{copy.title}</FieldLabel>
            <Badge
              variant={secret.set ? "secondary" : "outline"}
              className={cn(
                secret.set
                  ? "bg-green-500 text-white"
                  : "bg-red-500 text-white",
              )}
            >
              {secret.set ? "Configurada" : "Sin configurar"}
            </Badge>
            {secret.last4 ? (
              <span
                className="font-mono text-xs text-muted-foreground"
                title="Últimos 4 caracteres"
              >
                …{secret.last4}
              </span>
            ) : null}
          </div>
          <FieldDescription>{copy.description}</FieldDescription>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              id={inputId}
              name={inputId}
              type={generated ? "text" : "password"}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              value={draft}
              placeholder={
                secret.set
                  ? "Pegá un valor nuevo para reemplazarla"
                  : "Pegá el valor"
              }
              onChange={(event) => {
                setDraft(event.target.value);
                setGenerated(false);
              }}
              className={cn("sm:max-w-md", generated && "font-mono text-xs")}
            />
            <div className="flex flex-wrap gap-2">
              {generate && !draft ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDraft(randomSecret());
                    setGenerated(true);
                  }}
                >
                  <SparklesIcon />
                  Generar
                </Button>
              ) : null}
              {generated && draft ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(draft).then(
                      () => toast.success("Clave copiada. Pegala en Kapso."),
                      () => toast.error("No se pudo copiar."),
                    );
                  }}
                >
                  <CopyIcon />
                  Copiar
                </Button>
              ) : null}
              <Button type="submit" disabled={!draft.trim() || save.isPending}>
                {save.isPending ? <Spinner /> : null}
                Guardar
              </Button>
              {secret.set ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setConfirming(true)}
                  disabled={clear.isPending}
                >
                  Quitar
                </Button>
              ) : null}
            </div>
          </div>
          <FieldDescription>
            {generated
              ? "Copiala y pegala en Kapso antes de guardar: después de guardarla acá no se vuelve a mostrar."
              : "Guardar reemplaza esta clave. Si lo dejás vacío, no cambia."}
          </FieldDescription>
        </Field>
      </form>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quitar {copy.title}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta integración deja de usar la clave hasta que cargues otra. Las
              demás no cambian.
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
