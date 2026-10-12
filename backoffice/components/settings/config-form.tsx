"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api";
import { useSaveConfig } from "@/lib/queries";
import type { CompanyConfig } from "@/lib/types";
import {
  errorsByField,
  FIELD_PATHS,
  fromDraft,
  toDraft,
  type ConfigDraft,
} from "./config-draft";

type TextKey = {
  [K in keyof ConfigDraft]: ConfigDraft[K] extends string ? K : never;
}[keyof ConfigDraft];

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card className="gap-0 shadow-xs">
      <CardHeader className="border-b">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <FieldGroup className="gap-5">{children}</FieldGroup>
      </CardContent>
    </Card>
  );
}

export function ConfigForm({ config }: { config: CompanyConfig }) {
  const initial = useMemo(() => toDraft(config), [config]);
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<
    Partial<Record<keyof ConfigDraft, string>>
  >({});
  const [formError, setFormError] = useState<string | null>(null);
  const save = useSaveConfig();
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  const set = <K extends keyof ConfigDraft>(key: K, value: ConfigDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setFormError(null);
  };

  const field = (
    key: TextKey,
    label: string,
    options: {
      description?: ReactNode;
      multiline?: boolean;
      mono?: boolean;
      inputMode?: "numeric" | "decimal";
      suffix?: string;
      maxLength?: number;
    } = {},
  ) => {
    const id = `config-${key}`;
    const error = errors[key];
    const common = {
      id,
      value: draft[key],
      maxLength: options.maxLength,
      spellCheck: options.mono ? false : undefined,
      "aria-invalid": error ? true : undefined,
      className: options.mono ? "font-mono text-xs md:text-xs" : undefined,
    };
    return (
      <Field data-invalid={error ? true : undefined}>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {options.multiline ? (
          <Textarea
            {...common}
            onChange={(event) => set(key, event.target.value)}
          />
        ) : (
          <div className="flex items-center gap-2">
            <Input
              {...common}
              inputMode={options.inputMode}
              className={
                options.suffix
                  ? `max-w-36 ${common.className ?? ""}`
                  : common.className
              }
              onChange={(event) => set(key, event.target.value)}
            />
            {options.suffix ? (
              <span className="text-sm text-muted-foreground">
                {options.suffix}
              </span>
            ) : null}
          </div>
        )}
        {options.description ? (
          <FieldDescription>{options.description}</FieldDescription>
        ) : null}
        <FieldError>{error}</FieldError>
      </Field>
    );
  };

  // A save re-keys this form with the new version, so the outcome is read from the promise:
  // callbacks passed to mutate() are dropped once the component unmounts.
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    save.mutateAsync(fromDraft(draft)).then(
      (result) =>
        toast.success(
          result.changed
            ? "Configuración guardada. El asistente la usa desde la próxima respuesta."
            : "No había cambios para guardar.",
        ),
      (error: Error) => {
        if (!(error instanceof ApiError) || !error.fields) {
          toast.error(error.message);
          return;
        }
        const next = errorsByField(error.fields);
        setErrors(next);
        setFormError(error.message);
        const first = (
          Object.keys(FIELD_PATHS) as Array<keyof ConfigDraft>
        ).find((key) => next[key]);
        if (first) document.getElementById(`config-${first}`)?.focus();
      },
    );
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="grid items-start gap-4 @4xl/main:grid-cols-2">
        <Section
          title="Empresa"
          description="Cómo se presenta el asistente y desde dónde atiende."
        >
          {field("displayName", "Nombre que usa el asistente", {
            maxLength: 80,
          })}
          {field("language", "Idioma", {
            description:
              "Código de idioma, por ejemplo es-UY. Define el idioma de las respuestas y el formato de las fechas.",
          })}
          {field("timezone", "Zona horaria", {
            description: "Por ejemplo America/Montevideo.",
          })}
          {field("defaultCountry", "País de los teléfonos", {
            maxLength: 2,
            description:
              "Para leer números escritos sin código de país. Por ejemplo UY.",
          })}
          {field("businessHours", "Horario para llamadas", {
            maxLength: 300,
            description:
              "Cuándo llaman los asesores. Si queda vacío, el asistente no promete un horario.",
          })}
        </Section>

        <Section
          title="Cómo escribe"
          description="El tono y el largo de cada mensaje de WhatsApp."
        >
          {field("tone", "Tono", {
            multiline: true,
            maxLength: 2000,
            description:
              "En tus palabras: registro, voseo, emojis, lo que no tiene que hacer.",
          })}
          {field("maxReplyChars", "Largo máximo de cada respuesta", {
            inputMode: "numeric",
            suffix: "caracteres",
            description:
              "Entre 80 y 4.096. Si se pasa, se corta en la última oración completa.",
          })}
        </Section>

        <Section
          title="Preguntas para calificar"
          description="El asistente hace estas tres. Con las tres respuestas pide un horario y deriva el lead a un asesor."
        >
          {field("interest", "Qué busca", { maxLength: 300 })}
          {field("budget", "Presupuesto", { maxLength: 300 })}
          {field("knowsProjects", "Si conoce los proyectos", {
            maxLength: 300,
          })}
        </Section>

        <Section
          title="Temas prohibidos"
          description="Lo que el asistente nunca responde. Si un lead pregunta por esto, pasa la conversación a una persona."
        >
          {field("forbiddenDescribe", "Temas, uno por línea", {
            multiline: true,
            description: "Se le pasan al modelo tal cual, como lista.",
          })}
          {field("forbiddenPatterns", "Patrones que bloquean una respuesta", {
            multiline: true,
            mono: true,
            description:
              "Expresiones regulares, una por línea. Si una respuesta coincide, no se envía: va el mensaje de respaldo. No distingue mayúsculas ni acentos.",
          })}
        </Section>

        <Section
          title="Mensajes fijos"
          description="Se envían tal cual, sin pasar por el modelo. Después el asistente espera a una persona."
        >
          {field("needsHuman", "Cuando hace falta un asesor", {
            multiline: true,
            maxLength: 1000,
            description:
              "Una queja, una compra existente, un tema prohibido, o un lead que insiste en hablar con alguien.",
          })}
          {field("fallback", "Respaldo", {
            multiline: true,
            maxLength: 1000,
            description:
              "Si el modelo falla o una respuesta menciona un tema prohibido.",
          })}
          {field("nonText", "Cuando mandan audio, fotos o stickers", {
            multiline: true,
            maxLength: 1000,
          })}
        </Section>

        <div className="flex flex-col gap-4">
          <Section
            title="WhatsApp"
            description="La plantilla aprobada por Meta que reciben los leads que llegan por un formulario."
          >
            <Field orientation="horizontal">
              <Switch
                id="config-welcomeEnabled"
                checked={draft.welcomeEnabled}
                onCheckedChange={(checked) => set("welcomeEnabled", checked)}
              />
              <FieldContent>
                <FieldLabel htmlFor="config-welcomeEnabled">
                  Enviar bienvenida a leads de formulario
                </FieldLabel>
                <FieldDescription>
                  Apagado: el lead queda registrado, pero no recibe mensaje.
                </FieldDescription>
              </FieldContent>
            </Field>
            {draft.welcomeEnabled ? (
              <>
                {field("templateName", "Nombre de la plantilla", {
                  mono: true,
                  maxLength: 512,
                  description:
                    "Igual que en Meta, por ejemplo bienvenida_formulario.",
                })}
                {field("templateLanguage", "Idioma de la plantilla", {
                  mono: true,
                  description: "El código de Meta, por ejemplo es o es_AR.",
                })}
                {field("templateBody", "Texto aprobado", {
                  multiline: true,
                  maxLength: 1024,
                  description:
                    "Para que la conversación y el asistente vean lo que recibió el lead.",
                })}
              </>
            ) : null}
          </Section>

          <Section
            title="HubSpot"
            description="Dónde queda el resumen de la conversación cuando se deriva o se cierra."
          >
            {field("transcriptProperty", "Propiedad para el resumen", {
              mono: true,
              maxLength: 100,
              description:
                "Nombre interno de una propiedad de texto largo del contacto. Vacío: solo se crea o actualiza el contacto.",
            })}
          </Section>
        </div>

        <Section
          title="Avanzado"
          description="Modelo y límites. Cambiarlos afecta el costo y la calidad de las respuestas."
        >
          {field("model", "Modelo de Anthropic", {
            mono: true,
            description: "Por defecto claude-haiku-4-5.",
          })}
          <div className="grid gap-5 @lg/field-group:grid-cols-3">
            {field("temperature", "Temperatura", {
              inputMode: "decimal",
              description: "Entre 0 y 1.",
            })}
            {field("historyLimit", "Mensajes de historial", {
              inputMode: "numeric",
              description: "Entre 4 y 200.",
            })}
            {field("timeoutSeconds", "Espera máxima", {
              inputMode: "numeric",
              suffix: "s",
              description: "Entre 1 y 60.",
            })}
          </div>
          <div className="grid gap-5 @lg/field-group:grid-cols-3">
            {field("maxFileMegabytes", "Tamaño por archivo", {
              inputMode: "decimal",
              suffix: "MB",
              description: "Hasta 50.",
            })}
            {field("maxCharsPerFile", "Texto por archivo", {
              inputMode: "numeric",
              description: "Caracteres.",
            })}
            {field("maxCharsTotal", "Texto en total", {
              inputMode: "numeric",
              description: "Caracteres, hasta 400.000.",
            })}
          </div>
        </Section>
      </div>

      <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background/95 px-4 py-3 shadow-sm backdrop-blur">
        <p
          role={formError ? "alert" : undefined}
          className={
            formError
              ? "text-sm font-medium text-destructive"
              : "text-sm text-muted-foreground"
          }
        >
          {formError ??
            (dirty
              ? "Hay cambios sin guardar."
              : "Cada vez que guardás queda una versión que podés restaurar.")}
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!dirty || save.isPending}
            onClick={() => {
              setDraft(initial);
              setErrors({});
              setFormError(null);
            }}
          >
            Descartar cambios
          </Button>
          <Button type="submit" disabled={!dirty || save.isPending}>
            {save.isPending ? <Spinner /> : null}
            Guardar configuración
          </Button>
        </div>
      </div>
    </form>
  );
}
