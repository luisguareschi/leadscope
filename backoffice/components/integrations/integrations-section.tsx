"use client";

import type { ReactNode } from "react";
import { AnthropicSection } from "@/components/integrations/anthropic-section";
import { FormsSection } from "@/components/integrations/forms-section";
import { HubspotSection } from "@/components/integrations/hubspot-section";
import { WhatsappSetupCard } from "@/components/integrations/whatsapp-setup-card";
import { Section } from "@/components/panel";
import type { IntegrationSectionId } from "@/components/settings/sections";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useSecrets } from "@/lib/queries";

function WhatsappSection({ companyName }: { companyName?: string }) {
  const query = useSecrets();
  return (
    <Section
      title="WhatsApp (Kapso)"
      description={`El número de ${companyName ?? "la empresa"} donde responde el asistente.`}
    >
      <WhatsappSetupCard secrets={query.data?.secrets} />
    </Section>
  );
}

/** Configuración → Integraciones, one section per provider. Secrets are write-only everywhere. */
export function IntegrationSection({
  id,
  companyName,
}: {
  id: IntegrationSectionId;
  companyName?: string;
}) {
  const query = useSecrets();
  const sections: Record<IntegrationSectionId, ReactNode> = {
    whatsapp: <WhatsappSection companyName={companyName} />,
    forms: <FormsSection />,
    hubspot: <HubspotSection companyName={companyName} />,
    anthropic: <AnthropicSection companyName={companyName} />,
  };
  return (
    <div className="flex flex-col gap-5">
      {query.isError ? (
        <Alert variant="destructive">
          <AlertTitle>No se pudieron cargar las claves</AlertTitle>
          <AlertDescription>{query.error.message}</AlertDescription>
        </Alert>
      ) : null}
      {sections[id]}
    </div>
  );
}
