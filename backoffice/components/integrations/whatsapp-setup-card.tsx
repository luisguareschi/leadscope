"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  CheckResults,
  CopyRow,
  ExternalLink,
  Guide,
  RowSkeleton,
  Step,
  TestActions,
  testStatus,
} from "@/components/integrations/integration-parts";
import { SecretRow } from "@/components/integrations/secret-row";
import { fromDraft, toDraft } from "@/components/settings/config-draft";
import { InlineCode, Panel, FieldRow } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { API_URL, ApiError } from "@/lib/api";
import {
  useSaveConfig,
  useSettings,
  useWhatsappConnectionCheck,
} from "@/lib/queries";
import type { CompanySettings, SecretStatus } from "@/lib/types";

const RECEIVED_EVENT = "whatsapp.message.received";
const STATUS_EVENTS = [
  "whatsapp.message.sent",
  "whatsapp.message.delivered",
  "whatsapp.message.read",
  "whatsapp.message.failed",
];

const CONDITIONS = [
  {
    title: "Número propio de la empresa.",
    text: "Conecta un número propio y evita los números virtuales de Kapso (Instant setup).",
  },
  {
    title: "Cuenta en el portafolio de Meta de la empresa.",
    text: "Al conectar, selecciona el Meta Business portfolio de la empresa.",
  },
  {
    title: "Facturación directa en Meta.",
    text: 'Agrega la tarjeta de la empresa en el Billing Hub de Meta antes de conectar y no actives "Use Kapso credits".',
  },
  {
    title: "Retención de mensajes en 30 días.",
    text: "En planes de pago de Kapso, configura Project settings → Message retention en 30 días.",
  },
];

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
              : "No hay cambios para guardar.",
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
      hint="ID numérico del número conectado en Kapso (no es el número de teléfono)."
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
          placeholder="Sin configurar"
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
          Requerido para recibir mensajes en esta empresa.
        </p>
      ) : null}
    </FieldRow>
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

  const runCheck = () =>
    check.mutate(undefined, {
      onError: (error) => toast.error(error.message),
    });

  return (
    <Panel
      title="WhatsApp con Kapso"
      description="API oficial de WhatsApp a través de Kapso."
      actions={
        <TestActions
          status={testStatus(check.data, missing)}
          pending={check.isPending}
          onTest={runCheck}
        />
      }
    >
      {check.data ? (
        <CheckResults result={check.data} readyText="Conexión verificada." />
      ) : null}

      {data ? (
        <PhoneNumberIdRow
          key={data.currentVersions.whatsappPhoneNumberId ?? "phone-number-id"}
          settings={data}
        />
      ) : (
        <RowSkeleton />
      )}

      {apiKey ? (
        <SecretRow secret={apiKey} hint="En Kapso: Integrations → API keys." />
      ) : (
        <RowSkeleton />
      )}

      <CopyRow
        label="URL del webhook"
        hint="Agrega un webhook tipo Kapso (v2) en el número con esta URL."
        value={webhookUrl}
        copyLabel="Copiar URL del webhook"
      >
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[13px] text-muted-foreground">
          <dt>Obligatorio</dt>
          <dd className="flex flex-wrap gap-1">
            <InlineCode>{RECEIVED_EVENT}</InlineCode>
          </dd>
          <dt>Estados de entrega</dt>
          <dd className="flex flex-wrap gap-1">
            {STATUS_EVENTS.map((event) => (
              <InlineCode key={event}>{event}</InlineCode>
            ))}
          </dd>
        </dl>
      </CopyRow>

      {webhookSecret ? (
        <SecretRow
          secret={webhookSecret}
          generate
          hint="Debe coincidir con la clave secreta del webhook en Kapso."
        />
      ) : (
        <RowSkeleton />
      )}

      <Guide defaultOpen={missing !== null && missing > 0}>
        <div className="flex flex-col gap-2 rounded-xl bg-primary/10 p-4 ring-1 ring-primary/25">
          <p className="text-[13px] font-medium">Requisitos previos</p>
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
          <Step n={1} title="Crea el proyecto en Kapso">
            <p>
              Ingresa a{" "}
              <ExternalLink href="https://app.kapso.ai">
                app.kapso.ai
              </ExternalLink>{" "}
              y crea un proyecto dedicado para esta empresa. Para producción,
              usa el plan Pro (permite retención de 30 días).
            </p>
          </Step>
          <Step n={2} title="Conecta el número de WhatsApp">
            <p>
              Ve a <InlineCode>Connected numbers</InlineCode> →{" "}
              <InlineCode>Connect new number</InlineCode>. Selecciona{" "}
              <InlineCode>WhatsApp Business App</InlineCode> si el equipo usa la
              app, o <InlineCode>Bring your own SIM</InlineCode> si será solo
              para el asistente. En Meta, selecciona el portafolio de la
              empresa.
            </p>
            <p>
              No selecciones{" "}
              <InlineCode>
                Use a display name with a virtual number instead
              </InlineCode>
              .
            </p>
          </Step>
          <Step n={3} title="Copia el Phone number ID">
            <p>
              Cópialo desde el número conectado (solo dígitos) y pégalo arriba.
            </p>
          </Step>
          <Step n={4} title="Crea una clave de API">
            <p>
              Ve a <InlineCode>Integrations</InlineCode> →{" "}
              <InlineCode>API keys</InlineCode>, genera una clave y pégala en
              Clave de API de Kapso.
            </p>
          </Step>
          <Step n={5} title="Configura el webhook">
            <p>
              Crea un webhook tipo Kapso (v2) con la URL y los eventos de
              arriba. El buffering es opcional: LeadScope ya agrupa mensajes
              consecutivos.
            </p>
          </Step>
          <Step n={6} title="Configura la clave secreta">
            <p>
              Si Kapso genera una clave, pégala arriba. Si te pide una, haz clic
              en Configurar → Generar, cópiala en Kapso y guárdala aquí.
            </p>
          </Step>
          <Step n={7} title="Prueba la conexión">
            <p>
              Haz clic en Probar conexión para validar el número y el webhook.
              Luego envía un WhatsApp de prueba desde otro teléfono.
            </p>
          </Step>
        </ol>
      </Guide>
    </Panel>
  );
}
