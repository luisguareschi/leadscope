"use client";

import { useState } from "react";
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

export function SpendCard({ spend }: { spend: CompanyMetrics["spend"] }) {
  const [open, setOpen] = useState(false);
  const { anthropic, whatsapp } = spend;
  const callsLabel =
    anthropic.calls === 1
      ? "1 llamada"
      : `${formatCount(anthropic.calls)} llamadas`;

  return (
    <Panel
      title="Gasto estimado del cliente"
      actions={
        <HelpTip label="Cómo se estima el gasto">
          Estimación con los precios de lista de Anthropic y Meta. Lo paga la
          empresa directamente; la factura real puede variar. Cada plantilla de
          WhatsApp se cuenta como marketing, que es la categoría más cara.
        </HelpTip>
      }
    >
      <div className="flex flex-col gap-5 px-5 py-4">
        <div className="flex flex-col gap-0.5">
          <p className="font-heading text-2xl font-semibold tracking-tight tabular-nums">
            {formatUsd(spend.totalUsd)}
          </p>
          <p className="text-sm text-muted-foreground tabular-nums">
            {formatUsd(spend.perLeadUsd)} por lead
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="text-sm font-semibold">Anthropic</h4>
            <p className="text-sm tabular-nums">
              {formatUsd(anthropic.usd)}
              <span className="text-muted-foreground"> · {callsLabel}</span>
            </p>
          </div>
          {anthropic.unpricedModels.length > 0 ? (
            <p className="text-[13px] text-primary">
              Sin precio para: {anthropic.unpricedModels.join(", ")}
            </p>
          ) : null}
          <div>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto px-0"
              aria-expanded={open}
              onClick={() => setOpen((current) => !current)}
            >
              {open ? "Ocultar detalle" : "Ver detalle"}
            </Button>
            {open ? (
              anthropic.byModel.length === 0 ? (
                <p className="pt-2 text-[13px] text-muted-foreground">
                  Sin llamadas en este período.
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
                      <TableHead className="text-right">
                        Caché escrita
                      </TableHead>
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
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="text-sm font-semibold">WhatsApp</h4>
            <p className="text-sm tabular-nums">{formatUsd(whatsapp.usd)}</p>
          </div>
          <p className="text-[13px] text-muted-foreground">
            {formatCount(whatsapp.templates)}{" "}
            {whatsapp.templates === 1 ? "plantilla" : "plantillas"}
            {" · "}
            {formatCount(whatsapp.serviceMessages)}{" "}
            {whatsapp.serviceMessages === 1
              ? "mensaje de servicio"
              : "mensajes de servicio"}
            {whatsapp.freeServiceMessages > 0
              ? ` · ${formatCount(whatsapp.freeServiceMessages)} dentro del cupo gratis`
              : ""}
          </p>
        </div>

        <p className="text-[13px] text-muted-foreground">
          Kapso se cobra aparte con un plan fijo.
        </p>
      </div>
    </Panel>
  );
}
