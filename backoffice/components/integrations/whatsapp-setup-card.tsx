"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import {
  CheckCircle2Icon,
  ChevronRightIcon,
  CircleMinusIcon,
  CopyIcon,
  ExternalLinkIcon,
  PlugZapIcon,
  TriangleAlertIcon,
  XCircleIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { SecretRow } from "@/components/integrations/secret-row";
import { fromDraft, toDraft } from "@/components/settings/config-draft";
import { InlineCode, Panel, FieldRow, StatusDot } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { API_URL, ApiError } from "@/lib/api";
import {
  useSaveConfig,
  useSettings,
  useWhatsappConnectionCheck,
} from "@/lib/queries";
import type {
  CompanySettings,
  ConnectionCheckStatus,
  SecretStatus,
  WhatsappConnectionCheck,
} from "@/lib/types";

const RECEIVED_EVENT = "whatsapp.message.received";
const STATUS_EVENTS = [
  "whatsapp.message.sent",
  "whatsapp.message.delivered",
  "whatsapp.message.read",
  "whatsapp.message.failed",
];

const CONDITIONS = [
  {
    title: "El número es de la empresa.",
    text: "Conectá un número propio. No uses un número que da Kapso (Instant setup): es una licencia y Kapso lo puede recuperar.",
  },
  {
    title: "La cuenta de WhatsApp queda en el portfolio de la empresa.",
    text: "En la pantalla de Meta elegí el Meta Business portfolio de la empresa, no uno personal ni el de LeadScope.",
  },
  {
    title: "Meta se paga con tarjeta, directo.",
    text: "Cargá la tarjeta de la empresa en el Billing Hub de Meta, en esa cuenta de WhatsApp, antes de conectar, y no actives «Use Kapso credits». Una cuenta que pagó con créditos de Kapso no puede pasar después a tarjeta, y su línea de crédito traba un cambio de proveedor.",
  },
  {
    title: "Retención de mensajes en 30 días.",
    text: "Kapso guarda todos los mensajes sin límite en el plan gratis. En un plan pago, poné Project settings → Message retention en 30 días. LeadScope y HubSpot ya guardan la conversación.",
  },
];

const STATUS_ICON: Record<ConnectionCheckStatus, ReactNode> = {
  ok: <CheckCircle2Icon className="size-4 text-emerald-600" />,
  warning: <TriangleAlertIcon className="size-4 text-amber-500" />,
  error: <XCircleIcon className="size-4 text-destructive" />,
  skipped: <CircleMinusIcon className="size-4 text-muted-foreground" />,
};

function copy(text: string, done: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success(done),
    () => toast.error("No se pudo copiar."),
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-3">
      <span className="flex size-6 items-center justify-center rounded-full border bg-background font-mono text-[11px] text-muted-foreground">
        {n}
      </span>
      <div className="flex flex-col gap-1 pt-0.5 text-[13px] leading-relaxed">
        <span className="font-medium text-foreground">{title}</span>
        <div className="flex flex-col gap-1.5 text-muted-foreground">
          {children}
        </div>
      </div>
    </li>
  );
}

function PhoneNumberIdRow({ settings }: { settings: CompanySettings }) {
  const saved = settings.whatsappPhoneNumberId ?? "";
  const [draft, setDraft] = useState(saved);
  const [error, setError] = useState<string | null>(null);
  const save = useSaveConfig();
  const dirty = draft.trim() !== saved;

  // Only the id changes: the stored config goes along unchanged, so no config version is written.
  // A save re-keys this row with the new version, so the outcome is read from the promise.
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    save
      .mutateAsync({
        config: fromDraft(toDraft(settings.config, settings.companyName)),
        whatsappPhoneNumberId: draft.trim() || null,
      })
      .then(
        (result) =>
          toast.success(
            result.changed
              ? "Phone number ID guardado."
              : "No había cambios para guardar.",
          ),
        (cause: Error) =>
          setError(
            cause instanceof ApiError
              ? (cause.fields?.whatsappPhoneNumberId ?? cause.message)
              : cause.message,
          ),
      );
  };

  return (
    <FieldRow
      label="Phone number ID"
      hint="En Kapso, en el número conectado. Solo dígitos: no es el teléfono."
      htmlFor="whatsapp-phone-number-id"
      error={error ?? undefined}
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="whatsapp-phone-number-id"
          value={draft}
          inputMode="numeric"
          maxLength={64}
          spellCheck={false}
          placeholder="Sin número todavía"
          aria-invalid={error ? true : undefined}
          className="font-mono text-xs md:text-xs"
          onChange={(event) => {
            setDraft(event.target.value);
            setError(null);
          }}
        />
        {dirty ? (
          <div className="flex shrink-0 gap-2">
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? <Spinner /> : null}
              Guardar
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDraft(saved);
                setError(null);
              }}
            >
              Cancelar
            </Button>
          </div>
        ) : null}
      </form>
      {!saved && !dirty ? (
        <p className="text-[13px] text-muted-foreground">
          Sin él, los mensajes que lleguen no se asignan a esta empresa.
        </p>
      ) : null}
    </FieldRow>
  );
}

function CheckResults({ result }: { result: WhatsappConnectionCheck }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 px-5 py-4",
        result.ready ? "bg-emerald-500/5" : "bg-destructive/5",
      )}
    >
      <p className="text-sm font-medium">
        {result.ready
          ? "Listo: Kapso manda los mensajes a LeadScope y LeadScope puede responder."
          : "Todavía no está listo. Corregí lo marcado en rojo y probá de nuevo."}
      </p>
      <ul className="flex flex-col gap-2">
        {result.checks.map((check) => (
          <li key={check.id} className="flex gap-2 text-[13px]">
            <span className="mt-0.5 shrink-0">{STATUS_ICON[check.status]}</span>
            <span>
              <span className="font-medium">{check.label}.</span>{" "}
              <span className="text-muted-foreground">{check.detail}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Configuración → Integraciones → WhatsApp: what Kapso needs, the test, and the setup guide. */
export function WhatsappSetupCard({
  secrets,
}: {
  secrets: SecretStatus[] | undefined;
}) {
  const settings = useSettings();
  const check = useWhatsappConnectionCheck();
  const [guideOpen, setGuideOpen] = useState<boolean | null>(null);
  const data = settings.data;
  const webhookUrl = data ? `${API_URL}${data.kapsoWebhookPath}` : null;
  const secret = (name: SecretStatus["name"]) =>
    secrets?.find((item) => item.name === name);
  const apiKey = secret("kapsoApiKey");
  const webhookSecret = secret("kapsoWebhookSecret");
  const missing =
    data && secrets
      ? [data.whatsappPhoneNumberId, apiKey?.set, webhookSecret?.set].filter(
          (value) => !value,
        ).length
      : null;
  const showGuide = guideOpen ?? (missing !== null && missing > 0);

  const status: { tone: "ok" | "warning" | "error" | "muted"; label: string } =
    check.data
      ? check.data.ready
        ? { tone: "ok", label: "Conectado" }
        : { tone: "error", label: "Con problemas" }
      : missing === null
        ? { tone: "muted", label: "Cargando" }
        : missing > 0
          ? {
              tone: "warning",
              label: missing === 1 ? "Falta 1 dato" : `Faltan ${missing} datos`,
            }
          : { tone: "muted", label: "Sin probar" };

  const runCheck = () =>
    check.mutate(undefined, {
      onError: (error) => toast.error(error.message),
    });

  return (
    <Panel
      title="WhatsApp con Kapso"
      description="La API oficial de WhatsApp, a través del proyecto de Kapso de la empresa."
      actions={
        <>
          <span className="flex items-center gap-2 rounded-full border bg-background px-2.5 py-1 text-xs font-medium">
            <StatusDot tone={status.tone} />
            {status.label}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={runCheck}
            disabled={check.isPending}
          >
            {check.isPending ? <Spinner /> : <PlugZapIcon />}
            Probar conexión
          </Button>
        </>
      }
    >
      {check.data ? <CheckResults result={check.data} /> : null}

      {data ? (
        <PhoneNumberIdRow
          key={data.currentVersions.whatsappPhoneNumberId ?? "phone-number-id"}
          settings={data}
        />
      ) : (
        <div className="px-5 py-4">
          <Skeleton className="h-9 w-full" />
        </div>
      )}

      {apiKey ? (
        <SecretRow secret={apiKey} hint="En Kapso: Integrations → API keys." />
      ) : (
        <div className="px-5 py-4">
          <Skeleton className="h-9 w-full" />
        </div>
      )}

      <FieldRow
        label="URL del webhook"
        hint="En Kapso, en los webhooks del número: uno de tipo Kapso (v2) con esta URL."
      >
        {webhookUrl ? (
          <div className="flex min-w-0 gap-2">
            <code className="flex h-9 min-w-0 flex-1 items-center truncate rounded-md border bg-muted/50 px-3 font-mono text-xs">
              {webhookUrl}
            </code>
            <Button
              variant="outline"
              size="icon"
              aria-label="Copiar URL del webhook"
              onClick={() => copy(webhookUrl, "URL copiada.")}
            >
              <CopyIcon />
            </Button>
          </div>
        ) : (
          <Skeleton className="h-9 w-full" />
        )}
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[13px] text-muted-foreground">
          <dt>Obligatorio</dt>
          <dd className="flex flex-wrap gap-1">
            <InlineCode>{RECEIVED_EVENT}</InlineCode>
          </dd>
          <dt>Para ver entregas</dt>
          <dd className="flex flex-wrap gap-1">
            {STATUS_EVENTS.map((event) => (
              <InlineCode key={event}>{event}</InlineCode>
            ))}
          </dd>
        </dl>
      </FieldRow>

      {webhookSecret ? (
        <SecretRow
          secret={webhookSecret}
          generate
          hint="La misma que tiene el webhook en Kapso. Sin ella, LeadScope rechaza todos los avisos."
        />
      ) : (
        <div className="px-5 py-4">
          <Skeleton className="h-9 w-full" />
        </div>
      )}

      <div>
        <button
          type="button"
          aria-expanded={showGuide}
          onClick={() => setGuideOpen(!showGuide)}
          className="flex w-full items-center gap-2 px-5 py-3 text-left text-sm font-medium transition-colors hover:bg-muted/40"
        >
          <ChevronRightIcon
            className={cn(
              "size-4 text-muted-foreground transition-transform",
              showGuide && "rotate-90",
            )}
          />
          Guía de conexión paso a paso
        </button>
        {showGuide ? (
          <div className="flex flex-col gap-6 border-t bg-muted/30 px-5 py-5">
            <div className="flex flex-col gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
              <p className="text-[13px] font-medium">Antes de empezar</p>
              <ul className="flex flex-col gap-1.5 text-[13px] leading-relaxed text-muted-foreground">
                {CONDITIONS.map((condition) => (
                  <li key={condition.title}>
                    <span className="font-medium text-foreground">
                      {condition.title}
                    </span>{" "}
                    {condition.text}
                  </li>
                ))}
              </ul>
            </div>
            <ol className="flex flex-col gap-4">
              <Step n={1} title="Creá el proyecto de la empresa en Kapso">
                <p>
                  Entrá a{" "}
                  <a
                    href="https://app.kapso.ai"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
                  >
                    app.kapso.ai
                    <ExternalLinkIcon className="size-3" />
                  </a>{" "}
                  y creá un proyecto solo para esta empresa. Para producción usá
                  el plan Pro, que permite la retención de 30 días.
                </p>
              </Step>
              <Step n={2} title="Conectá el número de WhatsApp">
                <p>
                  <InlineCode>Connected numbers</InlineCode> →{" "}
                  <InlineCode>Connect new number</InlineCode>. Elegí{" "}
                  <InlineCode>WhatsApp Business App</InlineCode> si el equipo
                  sigue usando la app con ese número, o{" "}
                  <InlineCode>Bring your own SIM</InlineCode> si queda solo para
                  el asistente. En Meta, entrá con el usuario que administra el
                  portfolio de la empresa y elegí ese portfolio.
                </p>
                <p>
                  No elijas{" "}
                  <InlineCode>
                    Use a display name with a virtual number instead
                  </InlineCode>
                  .
                </p>
              </Step>
              <Step n={3} title="Copiá el Phone number ID">
                <p>
                  Está en el número conectado (solo dígitos). Pegalo arriba, en
                  Phone number ID.
                </p>
              </Step>
              <Step n={4} title="Creá una clave de API">
                <p>
                  <InlineCode>Integrations</InlineCode> →{" "}
                  <InlineCode>API keys</InlineCode> → nueva clave. Cargala
                  arriba, en Clave de API de Kapso.
                </p>
              </Step>
              <Step n={5} title="Agregá el webhook del número">
                <p>
                  De tipo Kapso (formato v2), con la URL y los eventos de
                  arriba. Agrupar mensajes (buffering) es opcional: LeadScope ya
                  espera unos segundos y responde una vez a varios mensajes
                  seguidos.
                </p>
              </Step>
              <Step n={6} title="Usá la misma clave secreta en los dos lados">
                <p>
                  Si Kapso te muestra la clave, pegala arriba. Si te pide una,
                  tocá Configurar → Generar, copiala en Kapso y después guardala
                  acá.
                </p>
              </Step>
              <Step n={7} title="Probá la conexión">
                <p>
                  Probar conexión revisa los datos, que Kapso vea el número sano
                  y que el webhook apunte a esta empresa con la misma clave.
                  Después mandá un WhatsApp al número desde otro teléfono: tiene
                  que aparecer en Conversaciones y recibir respuesta.
                </p>
              </Step>
            </ol>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
