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
    title: "El número es de la empresa.",
    text: "Conecta un número propio. No uses un número que da Kapso (Instant setup), porque es una licencia y Kapso lo puede recuperar.",
  },
  {
    title: "La cuenta de WhatsApp queda en el portfolio de la empresa.",
    text: "En la pantalla de Meta, elige el Meta Business portfolio de la empresa, no uno personal ni el de LeadScope.",
  },
  {
    title: "Meta se paga directamente con tarjeta.",
    text: 'Agrega la tarjeta de la empresa en el Billing Hub de Meta, en esa cuenta de WhatsApp, antes de conectar, y no actives "Use Kapso credits". Una cuenta que pagó con créditos de Kapso no puede pasar después a tarjeta, y su línea de crédito impide cambiar de proveedor.',
  },
  {
    title: "Retención de mensajes en 30 días.",
    text: "Kapso guarda todos los mensajes sin límite en el plan gratis. En un plan de pago, configura Project settings → Message retention en 30 días. LeadScope y HubSpot ya guardan la conversación.",
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
      hint="Está en Kapso, en el número conectado. Son solo dígitos y no es el número de teléfono."
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
      description="La API oficial de WhatsApp, a través del proyecto de Kapso de la empresa."
      actions={
        <TestActions
          status={testStatus(check.data, missing)}
          pending={check.isPending}
          onTest={runCheck}
        />
      }
    >
      {check.data ? (
        <CheckResults
          result={check.data}
          readyText="Listo. Kapso envía los mensajes a LeadScope y LeadScope puede responder."
        />
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
        hint="En Kapso, agrega en los webhooks del número uno de tipo Kapso (v2) con esta URL."
        value={webhookUrl}
        copyLabel="Copiar URL del webhook"
      >
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
      </CopyRow>

      {webhookSecret ? (
        <SecretRow
          secret={webhookSecret}
          generate
          hint="La misma que tiene el webhook en Kapso. Sin ella, LeadScope rechaza todos los avisos."
        />
      ) : (
        <RowSkeleton />
      )}

      <Guide defaultOpen={missing !== null && missing > 0}>
        <div className="flex flex-col gap-2 rounded-xl bg-primary/10 p-4 ring-1 ring-primary/25">
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
          <Step n={1} title="Crea el proyecto de la empresa en Kapso">
            <p>
              Entra a{" "}
              <ExternalLink href="https://app.kapso.ai">
                app.kapso.ai
              </ExternalLink>{" "}
              y crea un proyecto solo para esta empresa. Para producción, usa el
              plan Pro, que permite la retención de 30 días.
            </p>
          </Step>
          <Step n={2} title="Conecta el número de WhatsApp">
            <p>
              <InlineCode>Connected numbers</InlineCode> →{" "}
              <InlineCode>Connect new number</InlineCode>. Elige{" "}
              <InlineCode>WhatsApp Business App</InlineCode> si el equipo sigue
              usando la app con ese número, o{" "}
              <InlineCode>Bring your own SIM</InlineCode> si queda solo para el
              asistente. En Meta, entra con el usuario que administra el
              portfolio de la empresa y elige ese portfolio.
            </p>
            <p>
              No elijas{" "}
              <InlineCode>
                Use a display name with a virtual number instead
              </InlineCode>
              .
            </p>
          </Step>
          <Step n={3} title="Copia el Phone number ID">
            <p>
              Está en el número conectado (solo dígitos). Pégalo arriba, en
              Phone number ID.
            </p>
          </Step>
          <Step n={4} title="Crea una clave de API">
            <p>
              <InlineCode>Integrations</InlineCode> →{" "}
              <InlineCode>API keys</InlineCode> → nueva clave. Pégala arriba, en
              Clave de API de Kapso.
            </p>
          </Step>
          <Step n={5} title="Agrega el webhook del número">
            <p>
              De tipo Kapso (formato v2), con la URL y los eventos de arriba.
              Agrupar mensajes (buffering) es opcional, porque LeadScope ya
              espera unos segundos y responde una sola vez a varios mensajes
              seguidos.
            </p>
          </Step>
          <Step n={6} title="Usa la misma clave secreta en los dos lados">
            <p>
              Si Kapso te muestra la clave, pégala arriba. Si te pide una, toca
              Configurar → Generar, cópiala en Kapso y después guárdala aquí.
            </p>
          </Step>
          <Step n={7} title="Prueba la conexión">
            <p>
              Probar conexión revisa los datos, que Kapso vea el número en buen
              estado y que el webhook apunte a esta empresa con la misma clave.
              Después envía un WhatsApp al número desde otro teléfono. Debe
              aparecer en Conversaciones y recibir respuesta.
            </p>
          </Step>
        </ol>
      </Guide>
    </Panel>
  );
}
