"use client";

import { useMemo, useState, type ReactNode } from "react";
import { cn } from "cn";
import {
  PauseAssistantDialog,
  pausedByDetail,
  useToggleAssistantPaused,
} from "@/components/assistant-pause-dialog";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatNumber } from "@/lib/format";
import { useMe, useSettings, useSettingsOptions } from "@/lib/queries";
import type { ConfigDraft } from "./config-draft";
import { useConfigEditor } from "./config-editor";
import { CollectEditor } from "./collect-editor";
import { StagesEditor } from "./stages-editor";
import { SearchableSelect, type SearchableOption } from "./searchable-select";
import { Panel, FieldRow, Section, StatusPill } from "@/components/panel";
import type { AssistantSectionId } from "./sections";

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

function AssistantStatusPanel() {
  const settings = useSettings();
  const me = useMe();
  const [confirming, setConfirming] = useState(false);
  const { toggle, isPending } = useToggleAssistantPaused();
  const assistant = settings.data?.assistant;
  const paused =
    assistant?.paused ?? me.data?.company?.assistantPaused ?? undefined;
  const pausedAt = assistant?.pausedAt ?? me.data?.company?.assistantPausedAt;
  const pausedByEmail =
    assistant?.pausedByEmail ?? me.data?.company?.assistantPausedByEmail;
  const detail = paused ? pausedByDetail(pausedAt, pausedByEmail) : null;

  return (
    <>
      <Panel
        className={cn(
          paused && "ring-destructive/30 dark:ring-1 dark:ring-destructive/25",
        )}
      >
        <div className="flex items-start justify-between gap-6 px-5 py-4 sm:items-center">
          <div className="flex min-w-0 max-w-xl flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <Label
                htmlFor="assistant-active"
                className="font-heading text-[15px] leading-snug font-semibold tracking-tight"
              >
                Responder automáticamente
              </Label>
              {paused !== undefined ? (
                <StatusPill tone={paused ? "error" : "ok"}>
                  {paused ? "Pausado" : "Respondiendo"}
                </StatusPill>
              ) : null}
            </div>
            <p className="text-[13px] leading-relaxed text-pretty text-muted-foreground">
              {paused
                ? "No responde mensajes de WhatsApp ni envía bienvenidas de formularios. Los mensajes se siguen guardando y puedes responder manualmente."
                : "Responde mensajes de WhatsApp y envía bienvenidas de formularios automáticamente."}
            </p>
          </div>
          <Switch
            id="assistant-active"
            checked={paused === false}
            disabled={paused === undefined || isPending}
            onCheckedChange={(checked) => {
              if (checked) toggle(false);
              else setConfirming(true);
            }}
            className="mt-0.5 shrink-0 sm:mt-0"
          />
        </div>
        {detail ? (
          <div className="bg-destructive/[0.04] px-5 py-2.5 text-xs text-muted-foreground">
            {detail}
          </div>
        ) : null}
      </Panel>
      <PauseAssistantDialog
        open={confirming}
        onOpenChange={setConfirming}
        pending={isPending}
        onConfirm={() => toggle(true, () => setConfirming(false))}
      />
    </>
  );
}

function GeneralSection() {
  const choices = useChoices();
  const { draft } = useConfigEditor();
  const company = draft.companyName.trim() || "la empresa";
  const assistant = draft.assistantName.trim();
  return (
    <Section
      title="General"
      description="Identidad, idioma y horarios del asistente."
    >
      <AssistantStatusPanel />
      <Panel>
        <TextRow
          name="companyName"
          label="Nombre de la empresa"
          hint="Nombre visible en el panel y con el que se presenta el asistente."
          placeholder="Mi Empresa"
          maxLength={80}
        />
        <TextRow
          name="assistantName"
          label="Nombre del asistente"
          hint={
            assistant
              ? `Se presenta como "${assistant}, asistente virtual de ${company}".`
              : `Opcional. Si está vacío, se presenta como asistente virtual de ${company}.`
          }
          placeholder="Sofía"
          maxLength={60}
        />
        <SelectRow
          name="language"
          label="Idioma"
          hint="Idioma de las respuestas y fechas."
          options={choices.languages}
        />
        <SelectRow
          name="timezone"
          label="Zona horaria"
          hint="Zona horaria para el asistente y las llamadas."
          options={choices.timezones}
        />
        <SelectRow
          name="defaultCountry"
          label="País de los teléfonos"
          hint="Para interpretar números sin código de país."
          options={choices.countries}
        />
        <TextRow
          name="businessHours"
          label="Horario para llamadas"
          hint="Horario de atención de los asesores (opcional)."
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
      description="Estilo de respuesta y datos que recopila el asistente."
    >
      <Panel title="Estilo">
        <TextRow
          name="tone"
          label="Tono"
          hint="Formalidad, uso de emojis y qué evitar."
          multiline
          maxLength={2000}
        />
        <TextRow
          name="maxReplyChars"
          label="Largo máximo"
          hint="Entre 80 y 4.096 caracteres."
          inputMode="numeric"
          suffix="caracteres"
          narrow
        />
      </Panel>
      <CollectEditor />
    </Section>
  );
}

function StagesSection() {
  return (
    <Section
      title="Etapas"
      description="Configura el pipeline de Conversaciones para tu empresa."
    >
      <StagesEditor />
    </Section>
  );
}

function FollowUpSection() {
  const { draft, set } = useConfigEditor();
  return (
    <Section
      title="Seguimiento"
      description="Recordatorios automáticos dentro de las 24 h de WhatsApp y cierre por inactividad."
    >
      <Panel
        title="Seguimiento automático (dentro de 24 h)"
        description="Si un lead en Calificando deja de responder, el asistente redacta un recordatorio breve y contextual dentro de la ventana gratuita de 24 horas."
        actions={
          <Switch
            id={fieldId("followUpEnabled")}
            aria-label="Activar seguimiento automático"
            checked={draft.followUpEnabled}
            onCheckedChange={(checked) => set("followUpEnabled", checked)}
          />
        }
      >
        {draft.followUpEnabled ? (
          <>
            <TextRow
              name="followUpDelayHours"
              label="Esperar antes de escribir"
              hint="Horas sin respuesta del lead antes de enviar un seguimiento (entre 1 y 20 h)."
              inputMode="numeric"
              suffix="horas"
              narrow
            />
            <TextRow
              name="followUpMaxCount"
              label="Máximo de seguimientos"
              hint="Cuántos recordatorios enviar por cada silencio del lead (1 o 2)."
              inputMode="numeric"
              suffix="intentos"
              narrow
            />
          </>
        ) : (
          <p className="px-5 py-4 text-sm text-muted-foreground">
            Desactivado. El asistente solo responde cuando el lead vuelve a
            escribir.
          </p>
        )}
      </Panel>

      <Panel
        title="Sin respuesta por inactividad"
        description="Mueve automáticamente a Sin respuesta las conversaciones en Calificando que llevan tiempo sin actividad. Si el lead vuelve a escribir, retoma la calificación."
        actions={
          <Switch
            id={fieldId("noResponseEnabled")}
            aria-label="Marcar leads inactivos como Sin respuesta"
            checked={draft.noResponseEnabled}
            onCheckedChange={(checked) => set("noResponseEnabled", checked)}
          />
        }
      >
        {draft.noResponseEnabled ? (
          <TextRow
            name="noResponseHours"
            label="Marcar tras"
            hint="Horas desde el último mensaje antes de pasar a Sin respuesta (entre 1 y 720 h)."
            inputMode="numeric"
            suffix="horas"
            narrow
          />
        ) : (
          <p className="px-5 py-4 text-sm text-muted-foreground">
            Desactivado. Los leads en Calificando no cambian de etapa por
            inactividad.
          </p>
        )}
      </Panel>
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
      description="Temas sobre los que el asistente no responderá. Si un lead pregunta por alguno, envía el mensaje fijo y se detiene."
    >
      <Panel>
        <TextRow
          name="forbiddenDescribe"
          label="Temas"
          hint={`Uno por línea, en lenguaje simple${
            topics.length ? ` (${topics.length})` : ""
          }.`}
          placeholder="Ej.: descuentos no autorizados, garantías o asesoría legal."
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
      description="Respuestas exactas que se envían sin pasar por el modelo."
    >
      <Panel>
        <TextRow
          name="needsHuman"
          label="Hace falta un asesor"
          hint="Se envía ante temas prohibidos, quejas o consultas que requieren a una persona."
          multiline
          maxLength={1000}
        />
        <TextRow
          name="fallback"
          label="Respaldo"
          hint="Se envía si el modelo falla o no responde a tiempo."
          multiline
          maxLength={1000}
        />
        <TextRow
          name="nonText"
          label="Audio, fotos o stickers"
          hint="Se envía cuando el lead manda un mensaje que no es texto."
          multiline
          maxLength={1000}
        />
      </Panel>
    </Section>
  );
}

/** Formularios: the welcome a form lead gets. Fields of the config draft. */
export function WelcomeTemplatePanel() {
  const { draft, set } = useConfigEditor();
  return (
    <Panel
      title="Bienvenida a leads de formulario"
      description="Plantilla aprobada en Meta que se envía una vez a leads de formulario."
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
            hint="Nombre exacto de la plantilla en Meta."
            placeholder="bienvenida_formulario"
            mono
            maxLength={512}
          />
          <TextRow
            name="templateLanguage"
            label="Idioma de la plantilla"
            hint="Código de idioma en Meta, por ejemplo es o es_LA."
            mono
            narrow
          />
          <TextRow
            name="templateBody"
            label="Texto aprobado"
            hint="Vista previa que verá el equipo en la conversación."
            multiline
            maxLength={1024}
          />
        </>
      ) : (
        <p className="px-5 py-4 text-sm text-muted-foreground">
          Desactivada. El lead queda registrado, pero no recibe mensaje
          automático.
        </p>
      )}
    </Panel>
  );
}

/** HubSpot: the long-text property that receives the summary. Field of the config draft. */
export function TranscriptPropertyRow() {
  return (
    <TextRow
      name="transcriptProperty"
      label="Propiedad del resumen"
      hint="Nombre interno de la propiedad de texto multilínea en HubSpot. Si está vacío, solo se sincroniza el contacto."
      placeholder="leadscope_resumen"
      mono
      maxLength={100}
    />
  );
}

/** Anthropic: which model answers. Field of the config draft. */
export function ModelRow() {
  const choices = useChoices();
  return (
    <SelectRow
      name="model"
      label="Modelo"
      hint={
        choices.modelSource === "anthropic"
          ? "Modelos disponibles en tu cuenta de Anthropic. Por defecto: claude-haiku-4-5."
          : "Configura tu clave de Anthropic para listar los modelos de tu cuenta. Por defecto: claude-haiku-4-5."
      }
      options={choices.models}
    />
  );
}

function LimitsSection() {
  return (
    <Section
      title="Respuestas y límites"
      description="Parámetros del modelo y límites de archivos. El modelo se selecciona en Integraciones → Anthropic."
    >
      <Panel title="Respuestas">
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
          hint="Mensajes recientes de contexto (4 a 200)."
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
        description="Los límites deben ser mayores o iguales al contenido actual."
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

export const CONFIG_SECTIONS: Record<AssistantSectionId, () => ReactNode> = {
  general: GeneralSection,
  conversation: ConversationSection,
  stages: StagesSection,
  followup: FollowUpSection,
  forbidden: ForbiddenSection,
  messages: MessagesSection,
  limits: LimitsSection,
};
