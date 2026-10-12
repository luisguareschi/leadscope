"use client";

import { KeyRoundIcon } from "lucide-react";
import { SecretRow } from "@/components/integrations/secret-row";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe, useSecrets } from "@/lib/queries";

export default function IntegrationsPage() {
  const me = useMe();
  const query = useSecrets();
  const company = me.data?.company.name;

  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      <Alert className="border-primary/30 bg-primary/5">
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

      <Card className="gap-0 pb-0 shadow-xs">
        <CardHeader className="border-b pb-4">
          <CardTitle>Integraciones</CardTitle>
          <CardDescription>
            {company ? `Claves de ${company}. ` : null}
            Anthropic responde, Meta es WhatsApp, HubSpot guarda el contacto, y
            el secreto del formulario autentica los leads que llegan desde un
            flujo.
          </CardDescription>
        </CardHeader>
        {query.isPending ? (
          <div className="flex flex-col gap-3 p-4 lg:p-6">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : query.data ? (
          <div className="divide-y">
            {query.data.secrets.map((secret) => (
              <SecretRow key={secret.name} secret={secret} />
            ))}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
