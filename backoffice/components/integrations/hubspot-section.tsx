"use client";

import { toast } from "sonner";
import {
  CheckResults,
  ExternalLink,
  Guide,
  RowSkeleton,
  Step,
  TestActions,
  testStatus,
} from "@/components/integrations/integration-parts";
import { SecretRow } from "@/components/integrations/secret-row";
import { useSecret } from "@/components/integrations/use-secret";
import { FieldRow, InlineCode, Panel, Section } from "@/components/panel";
import { TranscriptPropertyRow } from "@/components/settings/config-sections";
import { Switch } from "@/components/ui/switch";
import {
  useIntegrationCheck,
  useSetHubspotEnabled,
  useSettings,
} from "@/lib/queries";

const SCOPES = ["crm.objects.contacts.read", "crm.objects.contacts.write"];

function EnabledRow({ enabled }: { enabled: boolean | undefined }) {
  const mutation = useSetHubspotEnabled();
  return (
    <FieldRow
      label="Usar HubSpot"
      htmlFor="hubspot-enabled"
      hint={
        enabled
          ? "Cada lead se crea como contacto desde su primer mensaje, y el contacto se actualiza cuando el asistente aprende algo nuevo."
          : "No se crea ni se actualiza nada en HubSpot, y las conversaciones no muestran su estado. Al activarlo, cada lead se crea con su próximo mensaje. Los anteriores no se cargan."
      }
    >
      <div className="flex min-h-9 items-center gap-3">
        <Switch
          id="hubspot-enabled"
          checked={Boolean(enabled)}
          disabled={enabled === undefined || mutation.isPending}
          onCheckedChange={(checked) =>
            mutation.mutate(checked, {
              onSuccess: () =>
                toast.success(
                  checked
                    ? "HubSpot activado. Los leads se crean desde su próximo mensaje."
                    : "HubSpot apagado. No se escribe nada más en HubSpot.",
                ),
              onError: (error) => toast.error(error.message),
            })
          }
        />
        <span className="text-sm">{enabled ? "Activado" : "Apagado"}</span>
      </div>
    </FieldRow>
  );
}

/** Configuración → Integraciones → HubSpot: the switch, the token, the property, guide and test. */
export function HubspotSection({ companyName }: { companyName?: string }) {
  const settings = useSettings();
  const token = useSecret("hubspotAccessToken");
  const check = useIntegrationCheck("hubspot");
  const data = settings.data;
  const property = data?.config.crm.transcriptProperty ?? "";
  const missing =
    data && token
      ? [token.set, property].filter((value) => !value).length
      : null;
  const account = data?.hubspot;

  return (
    <Section
      title="HubSpot"
      description={`El CRM de ${companyName ?? "la empresa"}, si lo usa. Cada lead queda como contacto, con el resumen del asistente y la conversación en una propiedad de texto largo.`}
    >
      <Panel
        title="HubSpot"
        description="Con una app privada de la cuenta de HubSpot de la empresa."
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
            readyText="Listo. LeadScope puede crear y actualizar los contactos y escribir el resumen."
          />
        ) : null}

        <EnabledRow enabled={account?.enabled} />

        {token ? (
          <SecretRow
            secret={token}
            hint="El token de acceso de la app privada (empieza con pat-)."
          />
        ) : (
          <RowSkeleton />
        )}

        <TranscriptPropertyRow />

        <FieldRow
          label="Cuenta"
          hint="Para el botón Abrir en HubSpot de cada conversación."
        >
          <p className="flex min-h-9 items-center text-sm text-muted-foreground">
            {account?.portalId ? (
              <span>
                ID{" "}
                <span className="font-mono text-foreground">
                  {account.portalId}
                </span>
                {account.uiDomain ? ` · ${account.uiDomain}` : null}
              </span>
            ) : (
              "Se completa al guardar el token o al probar la conexión."
            )}
          </p>
        </FieldRow>

        <Guide defaultOpen={token !== undefined && !token.set}>
          <ol className="flex flex-col gap-4">
            <Step n={1} title="Crea una app privada">
              <p>
                En HubSpot, con un usuario Superadministrador, entra a
                Configuración (el engranaje) →{" "}
                <InlineCode>Integraciones</InlineCode> →{" "}
                <InlineCode>Apps privadas</InlineCode> →{" "}
                <InlineCode>Crear una app privada</InlineCode>. Ponle de nombre
                LeadScope. En cuentas nuevas, el mismo lugar se llama{" "}
                <InlineCode>Desarrollo</InlineCode> →{" "}
                <InlineCode>Apps heredadas</InlineCode> →{" "}
                <InlineCode>Crear app heredada</InlineCode> → Privada.
              </p>
            </Step>
            <Step n={2} title="Dale los permisos">
              <p>
                En <InlineCode>Alcances</InlineCode> (Scopes), marca{" "}
                {SCOPES.map((scope, index) => (
                  <span key={scope}>
                    {index > 0 ? " y " : null}
                    <InlineCode>{scope}</InlineCode>
                  </span>
                ))}
                . Con eso busca, crea y actualiza contactos y lee la propiedad.
                No hace falta ningún permiso de esquemas (crm.schemas…), porque
                LeadScope no crea propiedades.
              </p>
            </Step>
            <Step n={3} title="Crea la propiedad del resumen a mano">
              <p>
                LeadScope no la crea. En Configuración →{" "}
                <InlineCode>Propiedades</InlineCode>, elige el objeto Contacto →{" "}
                <InlineCode>Crear propiedad</InlineCode>, de tipo{" "}
                <InlineCode>Texto de varias líneas</InlineCode>, por ejemplo
                «Resumen LeadScope». Copia su nombre interno (como{" "}
                <InlineCode>leadscope_resumen</InlineCode>) en Propiedad del
                resumen y guarda.
              </p>
            </Step>
            <Step n={4} title="Copia el token">
              <p>
                Crea la app y, en <InlineCode>Token de acceso</InlineCode>, toca
                Mostrar token → Copiar. Pégalo arriba, en Token de HubSpot. Se
                guarda cifrado y aquí solo ves sus últimos 4 caracteres.
              </p>
            </Step>
            <Step n={5} title="Activa y prueba">
              <p>
                Activa Usar HubSpot y toca Probar conexión. Revisa que el token
                sea válido, que tenga los dos permisos y que la propiedad
                exista, sin crear ni cambiar nada en HubSpot. También guarda la
                cuenta, para abrir cada contacto desde la conversación. Más
                detalle en la{" "}
                <ExternalLink href="https://developers.hubspot.com/docs/apps/legacy-apps/private-apps/overview">
                  documentación de HubSpot
                </ExternalLink>
                .
              </p>
            </Step>
          </ol>
        </Guide>
      </Panel>
    </Section>
  );
}
