"use client";

import { Panel } from "@/components/panel";
import { formatCount } from "@/lib/metrics-format";
import type { CompanyMetrics } from "@/lib/types";

const ITEMS = [
  { key: "inbound", label: "Recibidos" },
  { key: "assistant", label: "Del asistente" },
  { key: "advisor", label: "De asesores" },
  { key: "templates", label: "Plantillas" },
  { key: "failed", label: "Fallidos" },
] as const;

export function MessagesRow({
  messages,
}: {
  messages: CompanyMetrics["messages"];
}) {
  return (
    <Panel title="Mensajes">
      <dl className="grid grid-cols-2 gap-4 px-5 py-4 sm:grid-cols-5">
        {ITEMS.map((item) => (
          <div key={item.key} className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-[13px] text-muted-foreground">{item.label}</dt>
            <dd className="font-heading text-xl font-semibold tracking-tight tabular-nums">
              {formatCount(messages[item.key])}
            </dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}
