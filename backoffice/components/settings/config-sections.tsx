"use client";

import { useMemo, type ReactNode } from "react";
import { cn } from "cn";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatNumber } from "@/lib/format";
import { useSettingsOptions } from "@/lib/queries";
import type { ConfigDraft } from "./config-draft";
import { useConfigEditor } from "./config-editor";
import { CollectEditor } from "./collect-editor";
import { SearchableSelect, type SearchableOption } from "./searchable-select";
import { Panel, FieldRow, Section } from "@/components/panel";
import type { ConfigSectionId } from "./sections";

type TextKey = {
  [K in keyof ConfigDraft]: ConfigDraft[K] extends string ? K : never;
}[keyof ConfigDraft];

export const fieldId = (key: keyof ConfigDraft) => `config-${key}`;

function TextRow({
  name,
  label,
  hint,
  multiline,
  mono,
  inputMode,
  suffix,
  maxLength,
  placeholder,
  narrow,
  compact,
}: {
  name: TextKey;
  label: ReactNode;
  hint?: ReactNode;
  multiline?: boolean;
  /** A multiline field that starts at one line and grows with its text. */
  compact?: boolean;
  mono?: boolean;
  inputMode?: "numeric" | "decimal";
  suffix?: string;
  maxLength?: number;
  placeholder?: string;
  narrow?: boolean;
}) {
  const { draft, errors, set } = useConfigEditor();
  const id = fieldId(name);
  const error = errors[name];
  const value = draft[name];
  const common = {
    id,
    value,
    maxLength,
    placeholder,
    spellCheck: mono ? false : undefined,
    "aria-invalid": error ? true : undefined,
  };
  const monoClass = mono ? "font-mono text-xs md:text-xs" : undefined;

  let control: ReactNode;
  if (multiline) {
    control = (
      <div className="flex flex-col gap-1.5">
        <Textarea
          {...common}
          className={cn(compact ? "min-h-9" : "min-h-20", monoClass)}
          onChange={(event) => set(name, event.target.value)}
        />
        {maxLength && !compact ? (
          <span className="self-end text-xs text-muted-foreground tabular-nums">
            {formatNumber(value.length)} / {formatNumber(maxLength)}
          </span>
        ) : null}
      </div>
    );
  } else if (suffix) {
    control = (
      <InputGroup className={narrow ? "max-w-56" : undefined}>
        <InputGroupInput
          {...common}
          inputMode={inputMode}
          className={cn("tabular-nums", monoClass)}
          onChange={(event) => set(name, event.target.value)}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupText>{suffix}</InputGroupText>
        </InputGroupAddon>
      </InputGroup>
    );
  } else {
    control = (
      <Input
        {...common}
        inputMode={inputMode}
        className={cn(
          narrow && "max-w-56",
          inputMode && "tabular-nums",
          monoClass,
        )}
        onChange={(event) => set(name, event.target.value)}
      />
    );
  }

  return (
    <FieldRow label={label} hint={hint} htmlFor={id} error={error}>
      {control}
    </FieldRow>
  );
}

function SelectRow({
  name,
  label,
  hint,
  options,
  mono,
}: {
  name: "language" | "timezone" | "defaultCountry" | "model";
  label: string;
  hint?: ReactNode;
  options: SearchableOption[];
  mono?: boolean;
}) {
  const { draft, errors, set } = useConfigEditor();
  const id = fieldId(name);
  return (
    <FieldRow label={label} hint={hint} htmlFor={id} error={errors[name]}>
      <SearchableSelect
        id={id}
        value={draft[name]}
        onValueChange={(value) => set(name, value)}
        options={options}
        invalid={Boolean(errors[name])}
        mono={mono}
      />
    </FieldRow>
  );
}

function useChoices() {
  const options = useSettingsOptions();
  return useMemo(() => {
    const data = options.data;
    return {
      modelSource: data?.models.source,
      languages: (data?.languages ?? []).map((option) => ({
        ...option,
        detail: option.value,
      })),
      timezones: data?.timezones ?? [],
      countries: (data?.countries ?? []).map((option) => ({
        value: option.value,
        label: option.label,
        detail: `${option.value} · +${option.callingCode}`,
      })),
      models: (data?.models.options ?? []).map((option) => ({
        value: option.value,
        label: option.legacy ? `${option.label} (anterior)` : option.label,
        detail: option.value,
      })),
    };
  }, [options.data]);
}

function GeneralSection() {
  const choices = useChoices();
  const { draft } = useConfigEditor();
  const company = draft.companyName.trim() || "la empresa";
  const assistant = draft.assistantName.trim();
  return (
    <Section
      title="General"
      description="Cómo se presenta el asistente y desde dónde atiende."
    >
      <Panel>
        <TextRow
          name="companyName"
          label="Nombre de la empresa"
          hint="Para quién trabaja el asistente. También es el nombre en Empresas y en el panel."
          placeholder="Altamira"
          maxLength={80}
        />
        <TextRow
          name="assistantName"
          label="Nombre del asistente"
          hint={
            assistant
              ? `Se presenta como «${assistant}, asistente virtual de ${company}».`
              : `Opcional. Vacío: se presenta como «el asistente virtual de ${company}», sin nombre propio.`
          }
          placeholder="Almira"
          maxLength={60}
        />
        <SelectRow
          name="language"
          label="Idioma"
          hint="De las respuestas y las fechas."
          options={choices.languages}
        />
        <SelectRow
          name="timezone"
          label="Zona horaria"
          hint="Para la hora que ve el asistente y el horario de llamadas."
          options={choices.timezones}
        />
        <SelectRow
          name="defaultCountry"
          label="País de los teléfonos"
          hint="Para leer números sin código de país, como 099 123 456."
          options={choices.countries}
        />
        <TextRow
          name="businessHours"
          label="Horario para llamadas"
          hint="Cuándo llaman los asesores. Vacío: no promete un horario."
          placeholder="Lunes a viernes de 9 a 18 h"
          maxLength={300}
        />
      </Panel>
    </Section>
  );
}

function ConversationSection() {
  return (
    <Section
      title="Conversación"
      description="Cómo escribe y qué averigua del lead antes de derivarlo."
    >
      <Panel title="Estilo">
        <TextRow
          name="tone"
          label="Tono"
          hint="En tus palabras: registro, voseo, emojis, lo que tiene que evitar."
          multiline
          maxLength={2000}
        />
        <TextRow
          name="maxReplyChars"
          label="Largo máximo"
          hint="De 80 a 4.096. Si se pasa, corta en la última oración completa."
          inputMode="numeric"
          suffix="caracteres"
          narrow
        />
      </Panel>
      <CollectEditor />
    </Section>
  );
}

function ForbiddenSection() {
  const { draft } = useConfigEditor();
  const topics = draft.forbiddenDescribe
    .split("\n")
    .filter((line) => line.trim());
  return (
    <Section
      title="Temas prohibidos"
      description="Lo que el asistente nunca responde. Si un lead pregunta por uno, el asistente no contesta con sus palabras: envía el mensaje fijo «Hace falta un asesor», se detiene y deja el lead en HubSpot."
    >
      <Panel>
        <TextRow
          name="forbiddenDescribe"
          label="Temas"
          hint={`Uno por línea, en palabras simples, como se lo explicarías a una persona. El asistente marca cuál tocó el lead${
            topics.length ? ` (${topics.length} cargados)` : ""
          }.`}
          placeholder="Rentabilidad futura, renta proyectada o retorno de la inversión."
          multiline
        />
      </Panel>
    </Section>
  );
}

function MessagesSection() {
  return (
    <Section
      title="Mensajes fijos"
      description="Se envían tal cual, sin pasar por el modelo."
    >
      <Panel>
        <TextRow
          name="needsHuman"
          label="Hace falta un asesor"
          hint="Un tema prohibido, una queja, una compra existente o algo que solo puede responder una persona. Después espera a una persona. Un lead que pide hablar con alguien ya no recibe este mensaje: pasa a Por contactar."
          multiline
          maxLength={1000}
        />
        <TextRow
          name="fallback"
          label="Respaldo"
          hint="Si el modelo falla, tarda demasiado o devuelve una respuesta vacía."
          multiline
          maxLength={1000}
        />
        <TextRow
          name="nonText"
          label="Audio, fotos o stickers"
          hint="Cuando el lead manda algo que no es texto."
          multiline
          maxLength={1000}
        />
      </Panel>
    </Section>
  );
}

function CrmSection() {
  const { draft, set } = useConfigEditor();
  return (
    <Section
      title="Bienvenida y CRM"
      description="Qué recibe un lead que llega por un formulario, y dónde queda la conversación en HubSpot."
    >
      <Panel
        title="Bienvenida a leads de formulario"
        description="Una plantilla aprobada en Meta, enviada una vez."
        actions={
          <Switch
            id={fieldId("welcomeEnabled")}
            aria-label="Enviar bienvenida a leads de formulario"
            checked={draft.welcomeEnabled}
            onCheckedChange={(checked) => set("welcomeEnabled", checked)}
          />
        }
      >
        {draft.welcomeEnabled ? (
          <>
            <TextRow
              name="templateName"
              label="Plantilla"
              hint="El nombre exacto en Meta."
              placeholder="bienvenida_formulario"
              mono
              maxLength={512}
            />
            <TextRow
              name="templateLanguage"
              label="Idioma de la plantilla"
              hint="El código de Meta, como es o es_AR."
              mono
              narrow
            />
            <TextRow
              name="templateBody"
              label="Texto aprobado"
              hint="Para que la conversación muestre lo que recibió el lead."
              multiline
              maxLength={1024}
            />
          </>
        ) : (
          <p className="px-5 py-4 text-sm text-muted-foreground">
            Apagada: el lead queda registrado, pero no recibe mensaje.
          </p>
        )}
      </Panel>
      <Panel title="HubSpot">
        <TextRow
          name="transcriptProperty"
          label="Propiedad del resumen"
          hint="Nombre interno de una propiedad de texto largo del contacto. Vacío: solo crea o actualiza el contacto."
          mono
          maxLength={100}
        />
      </Panel>
    </Section>
  );
}

function ModelSection() {
  const choices = useChoices();
  return (
    <Section
      title="Modelo y límites"
      description="Cambiarlos afecta el costo y la calidad de las respuestas."
    >
      <Panel title="Modelo">
        <SelectRow
          name="model"
          label="Modelo de Anthropic"
          hint={
            choices.modelSource === "anthropic"
              ? "Los de la cuenta de Anthropic de la empresa. Por defecto, claude-haiku-4-5."
              : "Con la clave de Anthropic cargada se listan los de su cuenta. Por defecto, claude-haiku-4-5."
          }
          options={choices.models}
        />
        <TextRow
          name="temperature"
          label="Temperatura"
          hint="De 0 a 1."
          inputMode="decimal"
          narrow
        />
        <TextRow
          name="historyLimit"
          label="Historial"
          hint="Mensajes anteriores que lee, de 4 a 200."
          inputMode="numeric"
          suffix="mensajes"
          narrow
        />
        <TextRow
          name="timeoutSeconds"
          label="Espera máxima"
          hint="De 1 a 60."
          inputMode="numeric"
          suffix="s"
          narrow
        />
      </Panel>
      <Panel
        title="Conocimiento"
        description="Tienen que entrar los archivos que ya están subidos."
      >
        <TextRow
          name="maxFileMegabytes"
          label="Tamaño por archivo"
          hint="Hasta 50 MB."
          inputMode="decimal"
          suffix="MB"
          narrow
        />
        <TextRow
          name="maxCharsPerFile"
          label="Texto por archivo"
          inputMode="numeric"
          suffix="caracteres"
          narrow
        />
        <TextRow
          name="maxCharsTotal"
          label="Texto en total"
          hint="Hasta 400.000."
          inputMode="numeric"
          suffix="caracteres"
          narrow
        />
      </Panel>
    </Section>
  );
}

export const CONFIG_SECTIONS: Record<ConfigSectionId, () => ReactNode> = {
  general: GeneralSection,
  conversation: ConversationSection,
  forbidden: ForbiddenSection,
  messages: MessagesSection,
  crm: CrmSection,
  model: ModelSection,
};
