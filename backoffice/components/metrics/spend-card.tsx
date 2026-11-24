"use client";

import { useState } from "react";
import { cn } from "cn";
import { HelpTip } from "@/components/help-tip";
import { Panel } from "@/components/panel";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCount, formatUsd } from "@/lib/metrics-format";
import type { CompanyMetrics } from "@/lib/types";

const KAPSO_FREE_TIER_WARNING = 1800;

export function SpendCard({ spend }: { spend: CompanyMetrics["spend"] }) {
  const [open, setOpen] = useState(false);
  const { anthropic, whatsapp } = spend;
  const callsLabel =
    anthropic.calls === 1
      ? "1 llamada"
      : `${formatCount(anthropic.calls)} llamadas`;
  const nearKapsoCap =
    whatsapp.currentMonthTotalMessages >= KAPSO_FREE_TIER_WARNING;

  return (
    <Panel
      title="Gasto estimado"
      description="Costes variables de Anthropic y Meta en el período."
      actions={
        <HelpTip label="Cómo se estima el gasto">
          Estimación con precios de lista de Anthropic y Meta. La factura real
          puede variar. Las plantillas de WhatsApp se calculan con tarifa de
          marketing. El coste por lead usa solo conversaciones reales.
        </HelpTip>
      }
    >
      <div className="grid gap-5 px-5 py-4 sm:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-[13px] text-muted-foreground">Total estimado</p>
          <p className="font-heading text-2xl font-semibold tracking-tight tabular-nums">
            {formatUsd(spend.totalUsd)}
          </p>
          {spend.projectedMonthlyUsd != null ? (
            <p className="text-xs text-muted-foreground tabular-nums">
              Proyección 30 días: ~{formatUsd(spend.projectedMonthlyUsd)}
            </p>
          ) : null}
          {spend.perLeadUsd != null ? (
            <p className="text-xs text-muted-foreground tabular-nums">
              {formatUsd(spend.perLeadUsd)} por lead real
            </p>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-[13px] text-muted-foreground">Anthropic</p>
          <p className="font-heading text-2xl font-semibold tracking-tight tabular-nums">
            {formatUsd(anthropic.usd)}
          </p>
          {anthropic.testCalls > 0 ? (
            <>
              <p className="text-xs text-muted-foreground tabular-nums">
                Reales: {formatUsd(anthropic.realUsd)} · Pruebas:{" "}
                {formatUsd(anthropic.testUsd)}
              </p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {callsLabel} ({formatCount(anthropic.realCalls)} reales ·{" "}
                {formatCount(anthropic.testCalls)} de prueba)
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground tabular-nums">
              {callsLabel}
              {spend.anthropicPerLeadUsd != null
                ? ` · ${formatUsd(spend.anthropicPerLeadUsd)} por lead`
                : ""}
            </p>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-[13px] text-muted-foreground">WhatsApp (Meta)</p>
          <p className="font-heading text-2xl font-semibold tracking-tight tabular-nums">
            {formatUsd(whatsapp.usd)}
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {formatCount(whatsapp.templates)}{" "}
            {whatsapp.templates === 1 ? "plantilla" : "plantillas"} ·{" "}
            {formatCount(whatsapp.serviceMessages)} de servicio
          </p>
          {whatsapp.freeServiceMessages > 0 ||
          whatsapp.billableServiceMessages > 0 ? (
            <p className="text-xs text-muted-foreground tabular-nums">
              {formatCount(whatsapp.freeServiceMessages)} gratis ·{" "}
              {formatCount(whatsapp.billableServiceMessages)} facturables
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-3 px-5 py-3.5">
        {anthropic.unpricedModels.length > 0 ? (
          <p className="text-[13px] text-primary">
            Sin precio para: {anthropic.unpricedModels.join(", ")}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto px-0"
            aria-expanded={open}
            onClick={() => setOpen((current) => !current)}
          >
            {open ? "Ocultar detalle por modelo" : "Ver detalle por modelo"}
          </Button>
          <p
            className={cn(
              "text-xs tabular-nums",
              nearKapsoCap
                ? "font-medium text-primary"
                : "text-muted-foreground",
            )}
          >
            Kapso: {formatCount(whatsapp.currentMonthTotalMessages)} mensajes
            este mes (plan gratis hasta 2.000/mes; suscripción aparte).
          </p>
        </div>

        {open ? (
          anthropic.byModel.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">
              Sin llamadas a Anthropic en este período.
            </p>
          ) : (
            <Table className="min-w-[40rem]">
              <TableHeader>
                <TableRow>
                  <TableHead>Modelo</TableHead>
                  <TableHead className="text-right">Llamadas</TableHead>
                  <TableHead className="text-right">Entrada</TableHead>
                  <TableHead className="text-right">Salida</TableHead>
                  <TableHead className="text-right">Caché leída</TableHead>
                  <TableHead className="text-right">Caché escrita</TableHead>
                  <TableHead className="text-right">USD</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {anthropic.byModel.map((row) => (
                  <TableRow key={row.model}>
                    <TableCell className="font-mono text-xs">
                      {row.model}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCount(row.calls)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCount(row.inputTokens)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCount(row.outputTokens)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCount(row.cacheReadTokens)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCount(row.cacheWriteTokens)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatUsd(row.usd)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )
        ) : null}
      </div>
    </Panel>
  );
}
