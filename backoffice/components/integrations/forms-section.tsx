"use client";

import { toast } from "sonner";
import {
  CheckResults,
  CopyRow,
  Guide,
  RowSkeleton,
  Step,
  TestActions,
  testStatus,
} from "@/components/integrations/integration-parts";
import { SecretRow } from "@/components/integrations/secret-row";
import { useSecret } from "@/components/integrations/use-secret";
import { InlineCode, Panel, Section } from "@/components/panel";
import { WelcomeTemplatePanel } from "@/components/settings/config-sections";
import { API_URL } from "@/lib/api";
import { useIntegrationCheck, useSettings } from "@/lib/queries";

/** Configuración → Integraciones → Formularios: the hook, its secret, the welcome, and a test. */
export function FormsSection() {
  const settings = useSettings();
  const secret = useSecret("formLeadSecret");
  const check = useIntegrationCheck("forms");
  const data = settings.data;
  const hookUrl = data ? `${API_URL}${data.formLeadPath}` : null;
  const missing = secret ? (secret.set ? 0 : 1) : null;

  return (
    <Section
      title="Formularios"
      description="Envía un mensaje de bienvenida por WhatsApp a los leads que completan un formulario."
    >
      <Panel
        title="Webhook de formularios"
        description="Recibe leads nuevos desde tu CRM o formulario."
        actions={
          <TestActions
            status={testStatus(check.data, missing)}
            pending={check.isPending}
            onTest={() =>
              check.mutate(undefined, {
                onError: (error) => toast.error(error.message),
              })
            }
          />
        }
      >
        {check.data ? (
          <CheckResults
            result={check.data}
            readyText="Conexión verificada. La plantilla de bienvenida está aprobada."
          />
        ) : null}

        <CopyRow
          label="URL del webhook"
          hint="Endpoint POST que recibe el teléfono del lead."
          value={hookUrl}
          copyLabel="Copiar URL del webhook"
        />

        {secret ? (
          <SecretRow
            secret={secret}
            generate
            hint={
              <>
                Encabezado <InlineCode>X-LeadScope-Secret</InlineCode> requerido
                en cada solicitud.
              </>
            }
          />
        ) : (
          <RowSkeleton />
        )}

        <Guide defaultOpen={secret !== undefined && !secret.set}>
          <ol className="flex flex-col gap-4">
            <Step n={1} title="Genera el secreto">
              <p>
                En Secreto del formulario, haz clic en Configurar → Generar,
                cópialo y guárdalo.
              </p>
            </Step>
            <Step n={2} title="Crea el flujo en HubSpot">
              <p>
                Ve a <InlineCode>Automatización</InlineCode> →{" "}
                <InlineCode>Flujos de trabajo</InlineCode> y crea uno basado en
                contactos que se active al enviar el formulario.
              </p>
            </Step>
            <Step n={3} title="Configura la acción Enviar un webhook">
              <p>
                Usa método <InlineCode>POST</InlineCode> con la URL de arriba y
                el encabezado <InlineCode>X-LeadScope-Secret</InlineCode>.
                Incluye <InlineCode>phone</InlineCode> (o{" "}
                <InlineCode>mobilephone</InlineCode>),{" "}
                <InlineCode>email</InlineCode>,{" "}
                <InlineCode>firstname</InlineCode> y{" "}
                <InlineCode>lastname</InlineCode>.
              </p>
            </Step>
            <Step n={4} title="Configura la plantilla de bienvenida">
              <p>
                Ingresa abajo el nombre e idioma exactos de una plantilla
                aprobada en Meta. Se envía una sola vez si el lead aún no tiene
                conversación.
              </p>
            </Step>
            <Step n={5} title="Prueba la conexión">
              <p>
                Guarda los cambios y haz clic en Probar conexión para validar el
                secreto y la plantilla en Meta (no envía mensajes).
              </p>
            </Step>
          </ol>
        </Guide>
      </Panel>

      <WelcomeTemplatePanel />
    </Section>
  );
}
