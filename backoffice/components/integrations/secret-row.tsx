"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { CopyIcon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { FieldRow, StatusDot } from "@/components/panel";
import { useClearSecret, useSetSecret } from "@/lib/queries";
import type { SecretStatus } from "@/lib/types";

export const SECRET_TITLE: Record<SecretStatus["name"], string> = {
  anthropicApiKey: "Clave de Anthropic",
  kapsoApiKey: "Clave de API de Kapso",
  kapsoWebhookSecret: "Clave secreta del webhook",
  hubspotAccessToken: "Token de HubSpot",
  formLeadSecret: "Secreto del formulario",
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
  hint,
  generate = false,
}: {
  secret: SecretStatus;
  hint: ReactNode;
  /** Offer to make a random value here, to paste into the other system before saving. */
  generate?: boolean;
}) {
  const title = SECRET_TITLE[secret.name];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [generated, setGenerated] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const save = useSetSecret();
  const clear = useClearSecret();
  const inputId = `secret-${secret.name}`;

  const close = () => {
    setEditing(false);
    setDraft("");
    setGenerated(false);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const value = draft.trim();
    if (!value) return;
    save.mutate(
      { name: secret.name, value },
      {
        onSuccess: () => {
          close();
          toast.success("Clave guardada.");
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <>
      <FieldRow label={title} hint={hint} htmlFor={inputId}>
        {editing ? (
          <form
            onSubmit={onSubmit}
            autoComplete="off"
            className="flex flex-col gap-2"
          >
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id={inputId}
                name={inputId}
                type={generated ? "text" : "password"}
                autoComplete="off"
                autoCapitalize="off"
                autoFocus
                spellCheck={false}
                value={draft}
                placeholder={
                  secret.set ? "Pegá el valor nuevo" : "Pegá el valor"
                }
                onChange={(event) => {
                  setDraft(event.target.value);
                  setGenerated(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") close();
                }}
                className={cn(generated && "font-mono text-xs md:text-xs")}
              />
              <div className="flex shrink-0 gap-2">
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
                <Button
                  type="submit"
                  disabled={!draft.trim() || save.isPending}
                >
                  {save.isPending ? <Spinner /> : null}
                  Guardar
                </Button>
                <Button type="button" variant="ghost" onClick={close}>
                  Cancelar
                </Button>
              </div>
            </div>
            {generated ? (
              <p className="text-[13px] text-muted-foreground">
                Copiala y pegala en Kapso antes de guardar: después no se vuelve
                a mostrar.
              </p>
            ) : null}
          </form>
        ) : (
          <div className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-2">
            <span className="flex items-center gap-2 text-sm">
              <StatusDot tone={secret.set ? "ok" : "muted"} />
              {secret.set ? "Configurada" : "Sin configurar"}
              {secret.last4 ? (
                <span
                  className="font-mono text-xs text-muted-foreground"
                  title="Últimos 4 caracteres"
                >
                  ····{secret.last4}
                </span>
              ) : null}
            </span>
            <div className="ml-auto flex gap-1">
              {secret.set ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive"
                  disabled={clear.isPending}
                  onClick={() => setConfirming(true)}
                >
                  Quitar
                </Button>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(true)}
              >
                {secret.set ? "Reemplazar" : "Configurar"}
              </Button>
            </div>
          </div>
        )}
      </FieldRow>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quitar {title}?</AlertDialogTitle>
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
                    close();
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
