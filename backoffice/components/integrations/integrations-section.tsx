"use client";

import type { ReactNode } from "react";
import { SecretRow } from "@/components/integrations/secret-row";
import { WhatsappSetupCard } from "@/components/integrations/whatsapp-setup-card";
import { Panel, Section } from "@/components/panel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useSecrets } from "@/lib/queries";
import type { SecretName } from "@/lib/types";

const OTHER_SECRETS: Array<{ name: SecretName; hint: ReactNode }> = [
  {
    name: "anthropicApiKey",
    hint: "La usa el asistente para responder.",
  },
  {
    name: "hubspotAccessToken",
    hint: "Crea el contacto y guarda la conversación.",
  },
  {
    name: "formLeadSecret",
    hint: "Lo envía el flujo de HubSpot cuando entra un lead de un formulario.",
  },
];

/** Configuración → Integraciones. Write-only: the full value never comes back to the browser. */
export function IntegrationsSection({ companyName }: { companyName?: string }) {
  const query = useSecrets();
  const secrets = query.data?.secrets;

  return (
    <Section
      title="Integraciones"
      description={`Las claves de ${companyName ?? "la empresa"}. Se guardan cifradas: acá solo ves si están cargadas y los últimos 4 caracteres.`}
    >
      {query.isError ? (
        <Alert variant="destructive">
          <AlertTitle>No se pudieron cargar las claves</AlertTitle>
          <AlertDescription>{query.error.message}</AlertDescription>
        </Alert>
      ) : null}

      <WhatsappSetupCard secrets={secrets} />

      <Panel
        title="Anthropic, HubSpot y formularios"
        description="Anthropic responde, HubSpot guarda el contacto y el secreto autentica los leads de formulario."
      >
        {OTHER_SECRETS.map(({ name, hint }) => {
          const secret = secrets?.find((item) => item.name === name);
          if (secret)
            return <SecretRow key={name} secret={secret} hint={hint} />;
          return query.isPending ? (
            <div key={name} className="px-5 py-4">
              <Skeleton className="h-9 w-full" />
            </div>
          ) : null;
        })}
      </Panel>
    </Section>
  );
}
