"use client";

import {
  CheckCircle2Icon,
  CircleMinusIcon,
  CopyIcon,
  ExternalLinkIcon,
  PlugZapIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
  XCircleIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { SecretRow } from "@/components/integrations/secret-row";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { API_URL } from "@/lib/api";
import { useSettings, useWhatsappConnectionCheck } from "@/lib/queries";
import type {
  ConnectionCheckStatus,
  SecretStatus,
  WhatsappConnectionCheck,
} from "@/lib/types";
import { cn } from "cn";

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
    <li className="flex gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
        {n}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm">
        <span className="font-medium">{title}</span>
        <div className="flex flex-col gap-2 text-muted-foreground">
          {children}
        </div>
      </div>
    </li>
  );
}

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground">
      {children}
    </code>
  );
}

function copy(text: string, done: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success(done),
    () => toast.error("No se pudo copiar."),
  );
}

const STATUS_ICON: Record<ConnectionCheckStatus, ReactNode> = {
  ok: <CheckCircle2Icon className="size-4 text-green-600" />,
  warning: <TriangleAlertIcon className="size-4 text-amber-500" />,
  error: <XCircleIcon className="size-4 text-destructive" />,
  skipped: <CircleMinusIcon className="size-4 text-muted-foreground" />,
};

function CheckResults({ result }: { result: WhatsappConnectionCheck }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border p-4",
        result.ready
          ? "border-green-600/30 bg-green-500/5"
          : "border-destructive/30 bg-destructive/5",
      )}
    >
      <p className="text-sm font-medium">
        {result.ready
          ? "Listo: Kapso puede mandar los mensajes a LeadScope y LeadScope puede responder."
          : "Todavía no está listo. Corregí lo marcado en rojo y probá de nuevo."}
      </p>
      <ul className="flex flex-col gap-2">
        {result.checks.map((check) => (
          <li key={check.id} className="flex gap-2 text-sm">
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

/** Configuración → Integraciones → WhatsApp: the Kapso setup guide, its two secrets, and the test. */
export function WhatsappSetupCard({
  secrets,
  onOpenAssistant,
}: {
  secrets: SecretStatus[] | undefined;
  onOpenAssistant: () => void;
}) {
  const settings = useSettings();
  const check = useWhatsappConnectionCheck();
  const webhookUrl = settings.data
    ? `${API_URL}${settings.data.kapsoWebhookPath}`
    : null;
  const phoneNumberId = settings.data?.whatsappPhoneNumberId ?? null;
  const secretRow = (name: SecretStatus["name"], generate = false) => {
    const secret = secrets?.find((item) => item.name === name);
    return secret ? (
      <div className="rounded-lg border">
        <SecretRow secret={secret} generate={generate} />
      </div>
    ) : (
      <Skeleton className="h-28 w-full" />
    );
  };

  const runCheck = () =>
    check.mutate(undefined, {
      onError: (error) => toast.error(error.message),
    });

  return (
    <Card className="gap-0 shadow-xs">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          WhatsApp con Kapso
        </CardTitle>
        <CardDescription>
          El asistente usa la API oficial de WhatsApp a través de Kapso. Cada
          empresa conecta su propio número en su propio proyecto de Kapso y
          carga acá tres datos: el Phone number ID, la clave de API y la clave
          secreta del webhook.
        </CardDescription>
        <CardAction>
          <Button
            variant="outline"
            size="sm"
            onClick={runCheck}
            disabled={check.isPending}
          >
            {check.isPending ? <Spinner /> : <PlugZapIcon />}
            Probar conexión
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 pt-6">
        <Alert className="border-amber-500/40 bg-amber-500/5">
          <ShieldCheckIcon />
          <AlertTitle>Antes de empezar</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 flex flex-col gap-1.5">
              {CONDITIONS.map((condition) => (
                <li key={condition.title}>
                  <span className="font-medium text-foreground">
                    {condition.title}
                  </span>{" "}
                  {condition.text}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>

        <ol className="flex flex-col gap-5">
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
              y creá un proyecto solo para esta empresa. Para pasar a producción
              usá el plan Pro, que permite la retención de 30 días.
            </p>
          </Step>

          <Step n={2} title="Conectá el número de WhatsApp">
            <p>
              En Kapso: <Code>Connected numbers</Code> →{" "}
              <Code>Connect new number</Code>. Elegí{" "}
              <Code>WhatsApp Business App</Code> si el equipo quiere seguir
              usando la app en el teléfono con ese número, o{" "}
              <Code>Bring your own SIM</Code> si el número queda solo para el
              asistente. Se abre la pantalla de Meta: entrá con el usuario de
              Facebook que administra el portfolio de la empresa y elegí ese
              portfolio.
            </p>
            <p>
              En la lista de números de Meta no elijas{" "}
              <Code>Use a display name with a virtual number instead</Code>.
            </p>
          </Step>

          <Step n={3} title="Copiá el Phone number ID">
            <p>
              En el número conectado en Kapso, copiá el{" "}
              <Code>Phone number ID</Code> (solo números, no el teléfono) y
              guardalo en Asistente → WhatsApp.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {settings.isPending ? (
                <Skeleton className="h-6 w-40" />
              ) : phoneNumberId ? (
                <Badge variant="secondary" className="font-mono">
                  Guardado: {phoneNumberId}
                </Badge>
              ) : (
                <Badge variant="outline" className="border-destructive/50">
                  Sin Phone number ID
                </Badge>
              )}
              <Button variant="outline" size="sm" onClick={onOpenAssistant}>
                {phoneNumberId ? "Cambiarlo" : "Cargarlo"} en Asistente
              </Button>
            </div>
          </Step>

          <Step n={4} title="Creá una clave de API y pegala acá">
            <p>
              En Kapso: <Code>Integrations</Code> → <Code>API keys</Code> →
              nueva clave. Pegala abajo.
            </p>
            {secretRow("kapsoApiKey")}
          </Step>

          <Step n={5} title="Agregá el webhook del número en Kapso">
            <p>
              En los webhooks del número conectado, agregá uno de tipo Kapso
              (formato v2) con esta URL:
            </p>
            {webhookUrl ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <code className="min-w-0 flex-1 truncate rounded-md border bg-muted/50 px-3 py-2 font-mono text-xs text-foreground">
                  {webhookUrl}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copy(webhookUrl, "URL copiada.")}
                >
                  <CopyIcon />
                  Copiar URL
                </Button>
              </div>
            ) : (
              <Skeleton className="h-9 w-full" />
            )}
            <p>
              Eventos: <Code>{RECEIVED_EVENT}</Code> (obligatorio) y, para ver
              en Conversaciones si cada respuesta se entregó y se leyó,{" "}
              {STATUS_EVENTS.map((event, index) => (
                <span key={event}>
                  <Code>{event}</Code>
                  {index < STATUS_EVENTS.length - 1 ? ", " : "."}
                </span>
              ))}{" "}
              Agrupar mensajes (buffering) es opcional: LeadScope ya espera unos
              segundos y responde una vez a varios mensajes seguidos.
            </p>
          </Step>

          <Step n={6} title="Usá la misma clave secreta en Kapso y acá">
            <p>
              Kapso firma cada aviso con la clave secreta del webhook. Si Kapso
              te la muestra, copiala y pegala abajo. Si te pide una, tocá
              Generar, copiala en Kapso y después guardala acá.
            </p>
            {secretRow("kapsoWebhookSecret", true)}
          </Step>

          <Step n={7} title="Probá la conexión">
            <p>
              Probar conexión revisa los datos guardados, que Kapso vea el
              número sano y que el webhook apunte a esta empresa con la misma
              clave. Después mandá un WhatsApp al número desde otro teléfono:
              tiene que aparecer en Conversaciones y recibir respuesta.
            </p>
            <div>
              <Button onClick={runCheck} disabled={check.isPending}>
                {check.isPending ? <Spinner /> : <PlugZapIcon />}
                Probar conexión
              </Button>
            </div>
            {check.data ? <CheckResults result={check.data} /> : null}
          </Step>
        </ol>
      </CardContent>
    </Card>
  );
}
