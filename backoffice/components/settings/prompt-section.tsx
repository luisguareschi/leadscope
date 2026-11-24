"use client";

import { useState } from "react";
import { CopyIcon, LockIcon, ScrollTextIcon } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatNumber } from "@/lib/format";
import { usePromptPreview } from "@/lib/queries";
import type { PromptPreview } from "@/lib/types";
import { Panel, Section } from "@/components/panel";

const RULES = [
  {
    title: "Identidad",
    text: "Se presenta con el nombre del asistente y el nombre de la empresa configurados en General. Si no hay nombre propio, se presenta como asistente virtual de la empresa.",
  },
  {
    title: "Formato de salida",
    text: "Responde mediante submit_turn con el mensaje, los datos extraídos y la intención. El motor controla el estado de la conversación.",
  },
  {
    title: "Paso a Por contactar",
    text: "El lead pasa a Por contactar cuando se completan los datos obligatorios (o al indicar horario si no hay ninguno).",
  },
  {
    title: "Contacto inmediato",
    text: 'Si el lead pide hablar con una persona, pasa de inmediato a Por contactar con horario "Lo antes posible" y el asistente deja de hacer preguntas.',
  },
  {
    title: "Sincronización con HubSpot",
    text: "Si HubSpot está activo, el contacto se crea con el primer mensaje y se actualiza cuando cambian los datos, el resumen o la etapa.",
  },
  {
    title: "Intervención humana",
    text: 'Envía el mensaje fijo "Hace falta un asesor", actualiza HubSpot y detiene el asistente hasta que un operador marque la conversación como atendida.',
  },
  {
    title: "Temas prohibidos",
    text: "Cualquier respuesta que mencione un tema prohibido se bloquea y se sustituye por el mensaje fijo.",
  },
  {
    title: "Conocimiento por carpetas",
    text: 'Cada archivo incluye su ruta (por ejemplo, "Catálogo / Precios.xlsx") agrupado por carpeta para dar contexto al asistente.',
  },
  {
    title: "Ventana de 24 horas",
    text: "Solo responde dentro de las 24 horas desde el último mensaje del lead y nunca inicia conversaciones.",
  },
];

type Block = "rules" | "system" | "knowledge" | "turn" | "tool";

function copy(text: string, done: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success(done),
    () => toast.error("No se pudo copiar."),
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 px-5 py-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="truncate text-sm font-medium tabular-nums">{value}</span>
    </div>
  );
}

/** The files in the order the model reads them, each with the folder path that heads it. */
function KnowledgeOrder({
  documents,
}: {
  documents: PromptPreview["knowledge"]["documents"];
}) {
  if (documents.length === 0)
    return (
      <p className="p-5 text-sm text-muted-foreground">
        Aún no hay archivos en Conocimiento.
      </p>
    );
  return (
    <div className="flex flex-col gap-3 p-5">
      <p className="text-[13px] text-muted-foreground">
        Orden de los archivos en el prompt. Cada uno incluye su ruta (
        <code className="font-mono text-xs">
          &lt;document path=&quot;…&quot;&gt;
        </code>
        ).
      </p>
      <ol className="divide-y divide-border/70 rounded-xl bg-muted/60">
        {documents.map((doc, index) => {
          const parts = doc.path.split(" / ");
          const name = parts.pop();
          return (
            <li
              key={`${index}-${doc.path}`}
              className="flex items-center gap-3 px-3 py-2 text-sm"
            >
              <span className="w-6 shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0 flex-1 wrap-break-word">
                {parts.length ? (
                  <span className="text-muted-foreground">
                    {parts.join(" / ")} /{" "}
                  </span>
                ) : null}
                <span className="font-medium">{name}</span>
              </span>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {formatNumber(doc.chars)}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function PromptSection({ rules }: { rules: string }) {
  const query = usePromptPreview();
  const preview = query.data;
  const [open, setOpen] = useState(false);
  const [block, setBlock] = useState<Block>("system");

  const texts: Record<Block, string> = {
    rules,
    system: preview?.system ?? "",
    knowledge:
      preview?.knowledge.documents.map((doc) => doc.path).join("\n") ?? "",
    turn: preview?.turnContext ?? "",
    tool: preview ? JSON.stringify(preview.tool.input_schema, null, 2) : "",
  };
  const openAt = (next: Block) => {
    setBlock(next);
    setOpen(true);
  };

  return (
    <Section
      title="Reglas y prompt"
      description="Reglas base de LeadScope que completan el prompt. Son de solo lectura."
    >
      <Panel
        title="Reglas de la plataforma"
        actions={
          <Button variant="ghost" size="sm" onClick={() => openAt("rules")}>
            Ver texto exacto
          </Button>
        }
      >
        <ol className="divide-y">
          {RULES.map((rule, index) => (
            <li key={rule.title} className="flex gap-4 px-5 py-3.5">
              <span className="mt-px font-mono text-xs text-muted-foreground tabular-nums">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{rule.title}</span>
                <span className="text-[13px] leading-relaxed text-muted-foreground">
                  {rule.text}
                </span>
              </div>
            </li>
          ))}
        </ol>
        <p className="flex items-center gap-2 px-5 py-3 text-xs text-muted-foreground">
          <LockIcon className="size-3.5" />
          El texto que recibe el modelo está en inglés. El asistente responde en
          el idioma de la configuración.
        </p>
      </Panel>

      <Panel
        title="Prompt completo"
        description="Prompt que recibe el modelo con la configuración guardada."
        actions={
          <Button
            variant="outline"
            size="sm"
            disabled={!preview}
            onClick={() => openAt("system")}
          >
            <ScrollTextIcon />
            Ver prompt
          </Button>
        }
      >
        {query.isError ? (
          <div className="p-5">
            <Alert variant="destructive">
              <AlertTitle>No se pudo cargar el prompt</AlertTitle>
              <AlertDescription>{query.error.message}</AlertDescription>
            </Alert>
          </div>
        ) : !preview ? (
          <div className="grid grid-cols-5 gap-4 p-5">
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
          </div>
        ) : (
          <div className="grid grid-cols-1 divide-y sm:grid-cols-5 sm:divide-x sm:divide-y-0">
            <Stat
              label="Nombre del asistente"
              value={preview.names.assistant || "Sin nombre"}
            />
            <Stat label="Empresa" value={preview.names.company} />
            <Stat label="Modelo" value={preview.model} />
            <Stat
              label="Archivos de Conocimiento"
              value={formatNumber(preview.knowledge.files)}
            />
            <Stat
              label="Caracteres fijos"
              value={formatNumber(preview.system.length)}
            />
          </div>
        )}
      </Panel>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-3xl">
          <SheetHeader className="border-b pr-12">
            <SheetTitle>Prompt completo</SheetTitle>
            <SheetDescription>
              Bloque fijo reutilizable, contexto del turno y esquema de salida.
            </SheetDescription>
          </SheetHeader>
          <Tabs
            value={block}
            onValueChange={(value) => setBlock(value as Block)}
            className="min-h-0 flex-1 gap-0"
          >
            <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
              <TabsList
                variant="line"
                className="min-w-0 justify-start overflow-x-auto overflow-y-hidden pb-1.75 scrollbar-none group-data-horizontal/tabs:h-11"
              >
                <TabsTrigger value="system">Bloque fijo</TabsTrigger>
                <TabsTrigger value="knowledge">Conocimiento</TabsTrigger>
                <TabsTrigger value="turn">Contexto del turno</TabsTrigger>
                <TabsTrigger value="tool">
                  {preview?.tool.name ?? "Herramienta"}
                </TabsTrigger>
                <TabsTrigger value="rules">Reglas</TabsTrigger>
              </TabsList>
              <Button
                variant="ghost"
                size="sm"
                disabled={!texts[block]}
                onClick={() => copy(texts[block], "Copiado.")}
              >
                <CopyIcon />
                Copiar
              </Button>
            </div>
            {(Object.keys(texts) as Block[]).map((key) => (
              <TabsContent
                key={key}
                value={key}
                className="min-h-0 overflow-y-auto"
              >
                {key === "knowledge" && preview ? (
                  <KnowledgeOrder documents={preview.knowledge.documents} />
                ) : (
                  <pre className="p-5 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                    {texts[key] ||
                      (key === "rules" ? "" : "Cargando el prompt…")}
                  </pre>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </SheetContent>
      </Sheet>
    </Section>
  );
}
