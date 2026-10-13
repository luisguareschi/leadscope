"use client";

import { LockIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const RULES = [
  {
    title: "Formato de salida.",
    text: "El modelo contesta con la herramienta submit_turn: la respuesta, lo que dijo el lead (interés, presupuesto, si conoce los proyectos, horario) y la intención. El motor lee esos campos y decide el estado.",
  },
  {
    title: "Derivación con las tres respuestas.",
    text: "El lead pasa a un asesor recién cuando están guardados el interés, el presupuesto y si conoce los proyectos. Ahí el asistente pide un horario para la llamada.",
  },
  {
    title: "Cuando hace falta una persona.",
    text: "Se envía el mensaje fijo «Cuando hace falta un asesor», se escribe en HubSpot y el asistente espera hasta que un operador marque la conversación como atendida.",
  },
  {
    title: "Temas prohibidos.",
    text: "Una respuesta que los menciona no se envía: el lead recibe el mensaje de respaldo.",
  },
  {
    title: "Ventana de 24 horas.",
    text: "Solo responde dentro de las 24 horas del último mensaje del lead y nunca escribe primero.",
  },
];

export function PlatformRulesCard({ rules }: { rules: string }) {
  return (
    <Card className="gap-0 shadow-xs">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <LockIcon className="size-4 text-muted-foreground" />
          Reglas de la plataforma
        </CardTitle>
        <CardDescription>
          Las define LeadScope en el código y no se editan desde el panel,
          porque el motor depende de ellas. Se completan con tu configuración:
          las preguntas, los temas prohibidos y los mensajes fijos.
        </CardDescription>
      </CardHeader>
      <CardContent className="gap-4 pt-6">
        <ul className="flex flex-col gap-2 text-sm">
          {RULES.map((rule) => (
            <li key={rule.title}>
              <span className="font-medium">{rule.title}</span>{" "}
              <span className="text-muted-foreground">{rule.text}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">
            Texto exacto que recibe el modelo. Está en inglés; el asistente
            responde en el idioma de la configuración.
          </p>
          <pre className="max-h-96 overflow-y-auto rounded-md border bg-muted/40 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
            {rules}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}
