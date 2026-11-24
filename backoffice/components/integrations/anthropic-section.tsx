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
      description={`Modelo de IA del asistente. ${companyName ?? "La empresa"} paga el consumo en su cuenta de Anthropic.`}
    >
      <Panel
        title="Anthropic"
        description="Clave de API y modelo activo."
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
            readyText="Conexión verificada. El modelo está listo para responder."
          />
        ) : null}

        {key ? (
          <SecretRow
            secret={key}
            hint="Clave usada por el asistente para generar respuestas."
          />
        ) : (
          <RowSkeleton />
        )}

        <ModelRow />

        <Guide defaultOpen={key !== undefined && !key.set}>
          <ol className="flex flex-col gap-4">
            <Step n={1} title="Crea una clave en Anthropic">
              <p>
                Ingresa a{" "}
                <ExternalLink href="https://console.anthropic.com/settings/keys">
                  console.anthropic.com
                </ExternalLink>{" "}
                → <InlineCode>API keys</InlineCode> →{" "}
                <InlineCode>Create key</InlineCode> en la organización de la
                empresa.
              </p>
            </Step>
            <Step n={2} title="Guarda la clave">
              <p>
                Haz clic en Configurar en Clave de Anthropic y pégala. Al
                guardarla, la lista de modelos mostrará los disponibles en esa
                cuenta.
              </p>
            </Step>
            <Step n={3} title="Selecciona el modelo y prueba">
              <p>
                Por defecto se usa <InlineCode>claude-haiku-4-5</InlineCode>.
                Guarda los cambios y haz clic en Probar conexión (no consume
                tokens).
              </p>
            </Step>
          </ol>
        </Guide>
      </Panel>
    </Section>
  );
}
