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
      description="Leads que dejan su teléfono en un formulario. LeadScope les envía una bienvenida por WhatsApp y sigue la conversación como con cualquier lead."
    >
      <Panel
        title="Aviso del formulario"
        description="El flujo del CRM avisa a LeadScope cada vez que entra un lead."
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
            readyText="Listo. LeadScope acepta los leads del formulario y la bienvenida está aprobada. No se envió ningún mensaje."
          />
        ) : null}

        <CopyRow
          label="URL del aviso"
          hint="El flujo hace un POST aquí con el teléfono del lead."
          value={hookUrl}
          copyLabel="Copiar URL del aviso"
        />

        {secret ? (
          <SecretRow
            secret={secret}
            generate
            hint={
              <>
                El flujo lo envía en el encabezado{" "}
                <InlineCode>X-LeadScope-Secret</InlineCode>. Sin él, LeadScope
                rechaza el aviso.
              </>
            }
          />
        ) : (
          <RowSkeleton />
        )}

        <Guide defaultOpen={secret !== undefined && !secret.set}>
          <ol className="flex flex-col gap-4">
            <Step n={1} title="Crea el secreto">
              <p>
                En Secreto del formulario, toca Configurar → Generar, cópialo y
                guárdalo. Lo vas a pegar en el flujo.
              </p>
            </Step>
            <Step n={2} title="Crea el flujo en HubSpot">
              <p>
                <InlineCode>Automatización</InlineCode> →{" "}
                <InlineCode>Flujos de trabajo</InlineCode> → uno basado en
                contactos, que se active cuando el contacto envía el formulario.
              </p>
            </Step>
            <Step n={3} title="Agrega la acción Enviar un webhook">
              <p>
                Método <InlineCode>POST</InlineCode>, con la URL del aviso de
                arriba. En autenticación, agrega el encabezado{" "}
                <InlineCode>X-LeadScope-Secret</InlineCode> con el secreto.
                Incluye las propiedades <InlineCode>phone</InlineCode> (o{" "}
                <InlineCode>mobilephone</InlineCode>),{" "}
                <InlineCode>email</InlineCode>,{" "}
                <InlineCode>firstname</InlineCode> y{" "}
                <InlineCode>lastname</InlineCode>.
              </p>
            </Step>
            <Step n={4} title="Elige la bienvenida">
              <p>
                Abajo, el nombre y el idioma exactos de una plantilla aprobada
                en Meta para el número de la empresa. Se envía una sola vez, y
                solo si el lead todavía no tiene conversación.
              </p>
            </Step>
            <Step n={5} title="Prueba">
              <p>
                Probar conexión revisa el secreto y busca la plantilla en la
                cuenta de WhatsApp del número, a través de Kapso. No envía
                ningún mensaje. Prueba la plantilla guardada, así que guarda
                antes los cambios.
              </p>
            </Step>
          </ol>
        </Guide>
      </Panel>

      <WelcomeTemplatePanel />
    </Section>
  );
}
