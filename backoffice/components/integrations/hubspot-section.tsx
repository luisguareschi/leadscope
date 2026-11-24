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
          ? "Crea contactos desde el primer mensaje y actualiza el resumen automáticamente."
          : "Desactivado. No se crearán ni actualizarán contactos en HubSpot."
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
                  checked ? "HubSpot activado." : "HubSpot desactivado.",
                ),
              onError: (error) => toast.error(error.message),
            })
          }
        />
        <span className="text-sm">{enabled ? "Activado" : "Desactivado"}</span>
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
      description={`Sincroniza los leads de ${companyName ?? "la empresa"} como contactos junto con el resumen y la conversación.`}
    >
      <Panel
        title="HubSpot"
        description="Conexión mediante app privada de HubSpot."
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
          <CheckResults result={check.data} readyText="Conexión verificada." />
        ) : null}

        <EnabledRow enabled={account?.enabled} />

        {token ? (
          <SecretRow
            secret={token}
            hint="Token de acceso de la app privada (comienza con pat-)."
          />
        ) : (
          <RowSkeleton />
        )}

        <TranscriptPropertyRow />

        <FieldRow
          label="Cuenta"
          hint="Se usa para el enlace Abrir en HubSpot en cada conversación."
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
              "Se detecta al guardar el token o probar la conexión."
            )}
          </p>
        </FieldRow>

        <Guide defaultOpen={token !== undefined && !token.set}>
          <ol className="flex flex-col gap-4">
            <Step n={1} title="Crea una app privada">
              <p>
                En HubSpot (como Superadministrador), ve a Configuración →{" "}
                <InlineCode>Integraciones</InlineCode> →{" "}
                <InlineCode>Apps privadas</InlineCode> →{" "}
                <InlineCode>Crear una app privada</InlineCode> y nómbrala
                LeadScope. En cuentas nuevas está en{" "}
                <InlineCode>Desarrollo</InlineCode> →{" "}
                <InlineCode>Apps heredadas</InlineCode>.
              </p>
            </Step>
            <Step n={2} title="Asigna los permisos">
              <p>
                En <InlineCode>Alcances</InlineCode> (Scopes), marca{" "}
                {SCOPES.map((scope, index) => (
                  <span key={scope}>
                    {index > 0 ? " y " : null}
                    <InlineCode>{scope}</InlineCode>
                  </span>
                ))}
                . No se requieren permisos de esquemas.
              </p>
            </Step>
            <Step n={3} title="Crea la propiedad del resumen">
              <p>
                En Configuración → <InlineCode>Propiedades</InlineCode>, crea en
                Contacto una propiedad de tipo{" "}
                <InlineCode>Texto de varias líneas</InlineCode> (por ejemplo,
                "Resumen LeadScope") y copia su nombre interno (como{" "}
                <InlineCode>leadscope_resumen</InlineCode>) en el campo de
                arriba.
              </p>
            </Step>
            <Step n={4} title="Copia el token">
              <p>
                Crea la app y, en <InlineCode>Token de acceso</InlineCode>, haz
                clic en Mostrar token → Copiar y pégalo arriba.
              </p>
            </Step>
            <Step n={5} title="Activa y prueba">
              <p>
                Activa Usar HubSpot y haz clic en Probar conexión para validar
                el token, los permisos y la propiedad. Más información en la{" "}
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
