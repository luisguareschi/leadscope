"use client";

import { KeyRoundIcon } from "lucide-react";
import { SecretRow } from "@/components/integrations/secret-row";
import { WhatsappSetupCard } from "@/components/integrations/whatsapp-setup-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSecrets } from "@/lib/queries";
import type { SecretName } from "@/lib/types";

const WHATSAPP_SECRETS: SecretName[] = ["kapsoApiKey", "kapsoWebhookSecret"];

/** Configuración → Integraciones. Write-only: the full value never comes back to the browser. */
export function IntegrationsSection({
  companyName,
  onOpenAssistant,
}: {
  companyName?: string;
  /** Switches to the Asistente tab, where the WhatsApp phone number id is edited. */
  onOpenAssistant: () => void;
}) {
  const query = useSecrets();
  const others = query.data?.secrets.filter(
    (secret) => !WHATSAPP_SECRETS.includes(secret.name),
  );

  return (
    <div className="flex flex-col gap-4">
      <Alert>
        <KeyRoundIcon />
        <AlertTitle>Cada empresa carga sus propias claves</AlertTitle>
        <AlertDescription>
          Acá ves si están configuradas y los últimos 4 caracteres. El valor
          completo no vuelve al navegador. Dejar un campo vacío no borra la
          clave: para quitarla usá Quitar.
        </AlertDescription>
      </Alert>

      {query.isError ? (
        <Alert variant="destructive">
          <AlertTitle>No se pudieron cargar las claves</AlertTitle>
          <AlertDescription>{query.error.message}</AlertDescription>
        </Alert>
      ) : null}

      <WhatsappSetupCard
        secrets={query.data?.secrets}
        onOpenAssistant={onOpenAssistant}
      />

      <Card className="gap-0 pb-0 shadow-xs">
        <CardHeader className="border-b pb-4">
          <CardTitle>Otras integraciones</CardTitle>
          <CardDescription>
            {companyName ? `Claves de ${companyName}. ` : null}
            Anthropic responde, HubSpot guarda el contacto, y el secreto del
            formulario autentica los leads que llegan desde un flujo.
          </CardDescription>
        </CardHeader>
        {query.isPending ? (
          <div className="flex flex-col gap-3 p-4 lg:p-6">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : others ? (
          <div className="divide-y">
            {others.map((secret) => (
              <SecretRow key={secret.name} secret={secret} />
            ))}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
