"use client";

import Link from "next/link";
import {
  AlertTriangleIcon,
  BookOpenIcon,
  PauseCircleIcon,
  PlugZapIcon,
} from "lucide-react";
import { Notice } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { formatCount } from "@/lib/metrics-format";
import type { CompanyMetrics } from "@/lib/types";

export function OperationalAlerts({ metrics }: { metrics: CompanyMetrics }) {
  const { company, hubspot, assistant, knowledge } = metrics;
  const hasPaused = company.assistantPaused;
  const hasHubspotErrors = hubspot.enabled && hubspot.failing > 0;
  const hasFailedMessages = assistant.failedOutboundMessages > 0;
  const hasNoKnowledge = knowledge.files === 0;

  if (
    !hasPaused &&
    !hasHubspotErrors &&
    !hasFailedMessages &&
    !hasNoKnowledge
  ) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      {hasPaused ? (
        <Notice
          tone="error"
          icon={<PauseCircleIcon />}
          title="El asistente está pausado para toda la empresa"
          action={
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<Link href="/settings" />}
            >
              Ir a Configuración
            </Button>
          }
        >
          No se envían respuestas automáticas ni bienvenidas de formulario hasta
          que lo reanudes.
        </Notice>
      ) : null}

      {hasHubspotErrors ? (
        <Notice
          tone="error"
          icon={<PlugZapIcon />}
          title={
            hubspot.failing === 1
              ? "1 escritura a HubSpot con error"
              : `${formatCount(hubspot.failing)} escrituras a HubSpot con error`
          }
          action={
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<Link href="/settings?tab=hubspot" />}
            >
              Revisar HubSpot
            </Button>
          }
        >
          {hubspot.pending > hubspot.failing
            ? `Hay ${formatCount(hubspot.pending)} escrituras pendientes en total.`
            : "Revisa la conexión y los permisos de HubSpot en Configuración."}
        </Notice>
      ) : null}

      {hasFailedMessages ? (
        <Notice
          tone="warning"
          icon={<AlertTriangleIcon />}
          title={
            assistant.failedOutboundMessages === 1
              ? "1 mensaje de WhatsApp falló en este período"
              : `${formatCount(assistant.failedOutboundMessages)} mensajes de WhatsApp fallaron en este período`
          }
          action={
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<Link href="/settings?tab=whatsapp" />}
            >
              Revisar WhatsApp
            </Button>
          }
        >
          Comprueba el estado de la conexión con Kapso y el número de WhatsApp.
        </Notice>
      ) : null}

      {hasNoKnowledge ? (
        <Notice
          tone="neutral"
          icon={<BookOpenIcon />}
          title="Todavía no hay archivos en Conocimiento"
          action={
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<Link href="/knowledge" />}
            >
              Subir archivos
            </Button>
          }
        >
          Sube precios o información de proyectos para que el asistente responda
          con datos reales.
        </Notice>
      ) : null}
    </div>
  );
}
