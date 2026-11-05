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
import { InlineCode, Panel, Section } from "@/components/panel";
import { ModelRow } from "@/components/settings/config-sections";
import { useIntegrationCheck } from "@/lib/queries";

/** Configuración → Integraciones → Anthropic: the key, the model, and a free test. */
export function AnthropicSection({ companyName }: { companyName?: string }) {
  const key = useSecret("anthropicApiKey");
  const check = useIntegrationCheck("anthropic");
  const missing = key ? (key.set ? 0 : 1) : null;

  return (
    <Section
      title="Anthropic"
      description={`El modelo que responde a los leads. ${companyName ?? "La empresa"} paga el uso en su propia cuenta de Anthropic.`}
    >
      <Panel
        title="Anthropic"
        description="La clave de API y el modelo que usa el asistente."
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
            readyText="Listo. El asistente puede responder con este modelo."
          />
        ) : null}

        {key ? (
          <SecretRow secret={key} hint="La usa el asistente para responder." />
        ) : (
          <RowSkeleton />
        )}

        <ModelRow />

        <Guide defaultOpen={key !== undefined && !key.set}>
          <ol className="flex flex-col gap-4">
            <Step n={1} title="Crea la clave en la cuenta de la empresa">
              <p>
                Entra a{" "}
                <ExternalLink href="https://console.anthropic.com/settings/keys">
                  console.anthropic.com
                </ExternalLink>{" "}
                → <InlineCode>API keys</InlineCode> →{" "}
                <InlineCode>Create key</InlineCode>. Usa la organización de la
                empresa, que es la que paga el uso.
              </p>
            </Step>
            <Step n={2} title="Pégala aquí">
              <p>
                En Clave de Anthropic, toca Configurar y pégala. Con la clave,
                la lista de modelos muestra los de esa cuenta.
              </p>
            </Step>
            <Step n={3} title="Elige el modelo y prueba">
              <p>
                Por defecto, <InlineCode>claude-haiku-4-5</InlineCode>. Guarda y
                toca Probar conexión: revisa la clave y que el modelo guardado
                exista para ella, sin generar ninguna respuesta ni gastar
                tokens.
              </p>
            </Step>
          </ol>
        </Guide>
      </Panel>
    </Section>
  );
}
