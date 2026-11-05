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
    title: "Cómo se presenta",
    text: "Usa el nombre del asistente y se presenta como asistente virtual de la empresa, con los dos nombres de General. Habla en nombre de la empresa y nunca confunde un nombre con el otro. Si no hay nombre del asistente, se presenta solo como el asistente virtual de la empresa y no inventa uno.",
  },
  {
    title: "Formato de salida",
    text: "El modelo contesta con la herramienta submit_turn, que incluye la respuesta, lo que dijo el lead y la intención. El motor lee esos campos y decide el estado.",
  },
  {
    title: "Por contactar con los datos necesarios",
    text: "El lead pasa a Por contactar solo cuando están guardados todos los datos necesarios de Información a recopilar (si no hay ninguno, cuando da un horario). En ese momento, el asistente pide un horario para la llamada.",
  },
  {
    title: "Quiere hablar ya",
    text: 'Si el lead pide hablar con una persona ("llámenme", "quiero hablar con alguien"), pasa a Por contactar enseguida aunque falten datos, con horario "Lo antes posible", y el asistente deja de preguntar. Le dice que un asesor lo contactará lo antes posible. Un número para llamar en ese momento solo puede salir de tus Instrucciones.',
  },
  {
    title: "HubSpot desde el primer mensaje",
    text: "El contacto se crea con el primer mensaje (nombre de WhatsApp y teléfono) y se actualiza después de cada respuesta que cambia los datos, el resumen o la etapa.",
  },
  {
    title: "Cuando hace falta una persona",
    text: 'Envía el mensaje fijo "Hace falta un asesor", escribe en HubSpot y espera hasta que un operador marque la conversación como atendida.',
  },
  {
    title: "Temas prohibidos",
    text: "Una respuesta que los menciona no se envía. El lead recibe el mensaje de respaldo.",
  },
  {
    title: "Conocimiento por carpetas",
    text: 'Cada archivo de Conocimiento llega con su ruta, por ejemplo "Proyectos / Tres Cruces / Precios.xlsx", agrupado por carpeta. Así el asistente sabe de qué proyecto habla cada uno. Los límites de caracteres son los mismos.',
  },
  {
    title: "Ventana de 24 horas",
    text: "Solo responde dentro de las 24 horas del último mensaje del lead y nunca escribe primero.",
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
        Todavía no hay archivos en Conocimiento.
      </p>
    );
  return (
    <div className="flex flex-col gap-3 p-5">
      <p className="text-[13px] text-muted-foreground">
        En este orden van en el bloque fijo, agrupados por carpeta. Cada uno
        empieza con su ruta (
        <code className="font-mono text-xs">
          &lt;document path=&quot;…&quot;&gt;
        </code>
        ), que le dice al asistente de qué trata.
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
      description="Lo que el motor necesita para funcionar. Lo define LeadScope en el código, se completa con tu configuración y no se edita desde el panel."
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
        description="Lo que recibe el modelo en la próxima respuesta, con lo que ya está guardado."
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
              <AlertTitle>No se pudo armar el prompt</AlertTitle>
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
              En orden: el bloque fijo (se reutiliza entre respuestas), el
              contexto del turno y la herramienta de salida. Después van los
              últimos mensajes de la conversación.
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
                      (key === "rules" ? "" : "Armando el prompt…")}
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
