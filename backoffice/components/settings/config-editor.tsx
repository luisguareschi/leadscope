"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FlaskConicalIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api";
import { testChatOwner } from "@/lib/assistant-test-storage";
import { useAuth } from "@/lib/auth";
import { useMe, useSaveConfig } from "@/lib/queries";
import {
  clearSettingsTestDraftKeys,
  loadSettingsTestDraft,
  saveSettingsTestDraft,
} from "@/lib/settings-draft-storage";
import type { CompanyConfig } from "@/lib/types";
import {
  errorsByField,
  FIELD_PATHS,
  fromDraft,
  itemErrors,
  sameDraftValue,
  stageErrors,
  toDraft,
  type ConfigDraft,
} from "./config-draft";
import { CONFIG_SECTION_FIELDS, type ConfigSectionId } from "./sections";

type Errors = Partial<Record<keyof ConfigDraft, string>>;

export type ConfigEditor = {
  draft: ConfigDraft;
  errors: Errors;
  /** Errors on one collect item, keyed "<index>.<field>". */
  itemErrors: Record<string, string>;
  /** Errors on one pipeline stage, keyed "<index>.<field>". */
  stageErrors: Record<string, string>;
  formError: string | null;
  changedKeys: Array<keyof ConfigDraft>;
  saving: boolean;
  set: <K extends keyof ConfigDraft>(key: K, value: ConfigDraft[K]) => void;
  discard: () => void;
  /** Resolves with the first field the API rejected, if any. */
  save: () => Promise<keyof ConfigDraft | null>;
  /** Stores the unsaved config in sessionStorage and opens Probar asistente. */
  testDraft: () => void;
  sectionState: (section: ConfigSectionId) => "error" | "changed" | null;
};

/**
 * The config draft lives above the sections, so moving between them keeps unsaved edits. A new
 * config version (a save or a restore) replaces the draft.
 */
export function useConfigEditorState(
  config: CompanyConfig,
  companyName: string,
  version: string,
): ConfigEditor {
  const router = useRouter();
  const { email } = useAuth();
  const me = useMe();
  const companyId = me.data?.company?.id ?? null;
  const owner = email && companyId ? testChatOwner(email, companyId) : null;

  const [base, setBase] = useState(() => ({
    version,
    initial: toDraft(config, companyName),
  }));
  const [hydratedOwner, setHydratedOwner] = useState<string | null>(owner);
  const [draft, setDraft] = useState(() => {
    const saved = owner ? loadSettingsTestDraft(owner) : null;
    if (saved && (saved.config || saved.companyName !== undefined)) {
      return toDraft(saved.config ?? config, saved.companyName ?? companyName);
    }
    return base.initial;
  });
  const [errors, setErrors] = useState<Errors>({});
  const [itemErrorsState, setItemErrors] = useState<Record<string, string>>({});
  const [stageErrorsState, setStageErrors] = useState<Record<string, string>>(
    {},
  );
  const [formError, setFormError] = useState<string | null>(null);
  const mutation = useSaveConfig();

  if (base.version !== version) {
    const initial = toDraft(config, companyName);
    setBase({ version, initial });
    setDraft(initial);
    setErrors({});
    setItemErrors({});
    setStageErrors({});
    setFormError(null);
  }

  const changedKeys = (Object.keys(draft) as Array<keyof ConfigDraft>).filter(
    (key) => !sameDraftValue(key, draft[key], base.initial[key]),
  );

  // Hydrate an unsaved draft from sessionStorage if `me` finished loading after `settings`.
  if (owner && owner !== hydratedOwner) {
    setHydratedOwner(owner);
    if (changedKeys.length === 0) {
      const saved = loadSettingsTestDraft(owner);
      if (saved && (saved.config || saved.companyName !== undefined)) {
        setDraft(
          toDraft(saved.config ?? config, saved.companyName ?? companyName),
        );
      }
    }
  }

  useEffect(() => {
    if (changedKeys.length === 0) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [changedKeys.length]);

  return {
    draft,
    errors,
    itemErrors: itemErrorsState,
    stageErrors: stageErrorsState,
    formError,
    changedKeys,
    saving: mutation.isPending,
    set: (key, value) => {
      setDraft((current) => ({ ...current, [key]: value }));
      setErrors((current) => ({ ...current, [key]: undefined }));
      if (key === "collect") setItemErrors({});
      if (key === "stages") setStageErrors({});
      setFormError(null);
    },
    discard: () => {
      setDraft(base.initial);
      setErrors({});
      setItemErrors({});
      setStageErrors({});
      setFormError(null);
      if (owner) clearSettingsTestDraftKeys(owner, ["config", "companyName"]);
    },
    testDraft: () => {
      const parsed = fromDraft(draft);
      const numericChecks: Array<[keyof ConfigDraft, number]> = [
        ["maxReplyChars", parsed.maxReplyChars],
        ["temperature", parsed.llm.temperature],
        ["historyLimit", parsed.llm.historyLimit],
        ["timeoutSeconds", parsed.llm.timeoutMs],
        ["maxFileMegabytes", parsed.knowledge.maxFileBytes],
        ["maxCharsPerFile", parsed.knowledge.maxCharsPerFile],
        ["maxCharsTotal", parsed.knowledge.maxCharsTotal],
        ...(parsed.followUp.enabled
          ? ([
              ["followUpDelayHours", parsed.followUp.delayHours],
              ["followUpMaxCount", parsed.followUp.maxCount],
            ] as Array<[keyof ConfigDraft, number]>)
          : []),
        ...(parsed.inactivity.noResponseHours !== null
          ? ([["noResponseHours", parsed.inactivity.noResponseHours]] as Array<
              [keyof ConfigDraft, number]
            >)
          : []),
      ];
      const invalid = numericChecks.filter(
        ([, value]) => !Number.isFinite(value),
      );
      if (invalid.length > 0) {
        const nextErrors: Errors = {};
        for (const [key] of invalid) {
          nextErrors[key] = "Ingresa un número válido.";
        }
        setErrors((current) => ({ ...current, ...nextErrors }));
        setFormError(
          "Completa los valores numéricos marcados antes de probar el borrador.",
        );
        return;
      }
      if (owner) {
        saveSettingsTestDraft(owner, {
          companyName: draft.companyName,
          config: parsed,
        });
      }
      router.push("/probar");
    },
    // The outcome is read from the promise: a save replaces the draft before mutate() callbacks run.
    save: () =>
      mutation
        .mutateAsync({
          config: fromDraft(draft),
          companyName: draft.companyName,
        })
        .then(
          (result) => {
            if (owner)
              clearSettingsTestDraftKeys(owner, ["config", "companyName"]);
            toast.success(
              result.changed
                ? "Configuración guardada."
                : "No hay cambios para guardar.",
            );
            return null;
          },
          (error: Error) => {
            setFormError(error.message);
            if (!(error instanceof ApiError) || !error.fields) return null;
            const next = errorsByField(error.fields);
            setErrors(next);
            setItemErrors(itemErrors(error.fields));
            setStageErrors(stageErrors(error.fields));
            return (
              (Object.keys(FIELD_PATHS) as Array<keyof ConfigDraft>).find(
                (key) => next[key],
              ) ?? null
            );
          },
        ),
    sectionState: (section) => {
      const keys = CONFIG_SECTION_FIELDS[section];
      if (keys.some((key) => errors[key])) return "error";
      if (keys.some((key) => changedKeys.includes(key))) return "changed";
      return null;
    },
  };
}

const ConfigEditorContext = createContext<ConfigEditor | null>(null);

export const ConfigEditorProvider = ConfigEditorContext.Provider;

export function useConfigEditor(): ConfigEditor {
  const editor = useContext(ConfigEditorContext);
  if (!editor) throw new Error("useConfigEditor needs a ConfigEditorProvider");
  return editor;
}

/** Shown only while there is something to save or an error to read. */
export function ConfigSaveBar() {
  const editor = useConfigEditor();
  const count = editor.changedKeys.length;
  if (count === 0 && !editor.formError) return null;
  return (
    <div className="sticky bottom-4 z-10 mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-full bg-popover/95 py-2 pr-2 pl-5 shadow-xl ring-1 shadow-black/10 ring-border/70 backdrop-blur dark:shadow-black/40 dark:ring-white/10 animate-in duration-200 fade-in slide-in-from-bottom-2">
      <p
        role={editor.formError ? "alert" : undefined}
        className={cn(
          "min-w-0 flex-1 text-sm",
          editor.formError
            ? "font-medium text-destructive"
            : "text-muted-foreground",
        )}
      >
        {editor.formError ??
          (count === 1
            ? "1 cambio sin guardar."
            : `${count} cambios sin guardar.`)}
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={count === 0 || editor.saving}
          onClick={editor.discard}
        >
          Descartar
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={count === 0 || editor.saving}
          onClick={editor.testDraft}
        >
          <FlaskConicalIcon />
          Probar borrador
        </Button>
        <Button type="submit" size="sm" disabled={count === 0 || editor.saving}>
          {editor.saving ? <Spinner /> : null}
          Guardar cambios
        </Button>
      </div>
    </div>
  );
}
