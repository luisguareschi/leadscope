"use client";

import { CopyIcon } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/format";
import { usePromptPreview } from "@/lib/queries";

function Block({ title, text }: { title: string; text: string }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">{title}</h3>
      <pre className="max-h-[32rem] overflow-y-auto rounded-md border bg-muted/40 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
        {text}
      </pre>
    </section>
  );
}

export function PromptPreviewCard() {
  const query = usePromptPreview();
  const preview = query.data;

  return (
    <Card className="gap-0 shadow-xs">
      <CardHeader className="border-b">
        <CardTitle>Prompt completo</CardTitle>
        <CardDescription>
          Lo que recibe el modelo en la próxima respuesta, armado con la
          configuración, las instrucciones y los archivos de Conocimiento
          guardados. Lo que no guardaste todavía no aparece.
        </CardDescription>
        {preview ? (
          <CardAction>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void navigator.clipboard
                  .writeText(preview.system)
                  .then(() => toast.success("Prompt copiado."));
              }}
            >
              <CopyIcon />
              Copiar
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="gap-5 pt-6">
        {query.isError ? (
          <Alert variant="destructive">
            <AlertTitle>No se pudo armar el prompt</AlertTitle>
            <AlertDescription>{query.error.message}</AlertDescription>
          </Alert>
        ) : !preview ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-64" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="font-mono">
                {preview.model}
              </Badge>
              <Badge variant="outline">
                {preview.knowledge.files === 1
                  ? "1 archivo"
                  : `${formatNumber(preview.knowledge.files)} archivos`}
              </Badge>
              <Badge variant="outline">
                {formatNumber(preview.system.length)} caracteres fijos
              </Badge>
            </div>
            <Block
              title="1. Bloque fijo: reglas, instrucciones y conocimiento (se reutiliza entre respuestas)"
              text={preview.system}
            />
            <Block
              title="2. Contexto del turno (cambia en cada respuesta; acá, un lead que escribe por primera vez)"
              text={preview.turnContext}
            />
            <Block
              title={`3. Herramienta de salida: ${preview.tool.name}`}
              text={JSON.stringify(preview.tool.input_schema, null, 2)}
            />
            <p className="text-sm text-muted-foreground">
              Después van los últimos mensajes de la conversación.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
