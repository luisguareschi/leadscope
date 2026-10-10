"use client";

import { HandIcon, MessageCircleIcon, PauseCircleIcon, PhoneCallIcon } from "lucide-react";
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ThreadsSummary, ThreadStatusFilter } from "@/lib/types";

const CARDS: Array<{
  status: Exclude<ThreadStatusFilter, "all" | "closed">;
  title: string;
  hint: string;
  icon: React.ReactNode;
}> = [
  { status: "active", title: "En curso", hint: "El asistente está calificando o respondiendo", icon: <MessageCircleIcon /> },
  { status: "handoff", title: "Derivadas", hint: "Esperan la llamada de un asesor", icon: <PhoneCallIcon /> },
  { status: "needs_human", title: "Requieren asesor", hint: "El asistente se detuvo y espera a una persona", icon: <HandIcon /> },
  { status: "paused", title: "Pausadas", hint: "Un asesor tomó la conversación", icon: <PauseCircleIcon /> },
];

export function SummaryCards({
  summary,
  active,
  onSelect,
}: {
  summary: ThreadsSummary | undefined;
  active: ThreadStatusFilter;
  onSelect: (status: ThreadStatusFilter) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {CARDS.map((card) => {
        const count = summary?.[card.status];
        const selected = active === card.status;
        const attention = card.status === "needs_human" && (count ?? 0) > 0;
        return (
          <button
            key={card.status}
            type="button"
            onClick={() => onSelect(selected ? "all" : card.status)}
            aria-pressed={selected}
            className="rounded-xl text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Card
              className={cn(
                "@container/card h-full shadow-xs transition-colors hover:bg-muted/40",
                selected && "ring-2 ring-primary",
              )}
            >
              <CardHeader>
                <CardDescription>{card.title}</CardDescription>
                <CardTitle
                  className={cn(
                    "text-2xl font-semibold tabular-nums @[250px]/card:text-3xl",
                    attention && "text-amber-700 dark:text-amber-300",
                  )}
                >
                  {count === undefined ? <Skeleton className="h-8 w-12" /> : count}
                </CardTitle>
                <CardAction
                  className={cn(
                    "rounded-lg bg-muted p-2 text-muted-foreground [&_svg]:size-4",
                    attention && "bg-amber-500/15 text-amber-800 dark:text-amber-300",
                  )}
                >
                  {card.icon}
                </CardAction>
              </CardHeader>
              <CardFooter className="text-sm text-muted-foreground">{card.hint}</CardFooter>
            </Card>
          </button>
        );
      })}
    </div>
  );
}
