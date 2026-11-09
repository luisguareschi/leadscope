"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  BoldIcon,
  EyeIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ItalicIcon,
  ListIcon,
  ListOrderedIcon,
  PencilIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Markdown } from "@/components/markdown";
import { Section } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ApiError } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import {
  toggleLinePrefix,
  toggleWrap,
  type MarkdownEdit,
  type MarkdownLineKind,
  type MarkdownMarker,
} from "@/lib/markdown-format";
import { useSaveInstructions } from "@/lib/queries";

const VIEW_KEY = "leadscope:instructions-view";

const PLACEHOLDER =
  "## Quiénes somos\nQuiénes son, en qué zonas trabajan, cómo se presentan, qué conviene evitar…";

type InstructionsView = "edit" | "preview";

type FormatAction = {
  label: string;
  icon: ReactNode;
  sample: string;
  shortcut?: string;
} & ({ wrap: MarkdownMarker } | { line: MarkdownLineKind });

const FORMATS: FormatAction[] = [
  {
    wrap: "**",
    label: "Negrita",
    shortcut: "b",
    sample: "**texto**",
    icon: <BoldIcon />,
  },
  {
    wrap: "_",
    label: "Cursiva",
    shortcut: "i",
    sample: "_texto_",
    icon: <ItalicIcon />,
  },
  {
    line: "h1",
    label: "Título 1",
    sample: "# texto",
    icon: <Heading1Icon />,
  },
  {
    line: "h2",
    label: "Título 2",
    sample: "## texto",
    icon: <Heading2Icon />,
  },
  {
    line: "h3",
    label: "Título 3",
    sample: "### texto",
    icon: <Heading3Icon />,
  },
  {
    line: "bullet",
    label: "Lista",
    sample: "- texto",
    icon: <ListIcon />,
  },
  {
    line: "numbered",
    label: "Lista numerada",
    sample: "1. texto",
    icon: <ListOrderedIcon />,
  },
];

const VIEW_EVENT = "leadscope:instructions-view";

/** This visit's choice, including when localStorage refuses the write. */
let sessionView: InstructionsView | null = null;

function subscribeView(onChange: () => void) {
  window.addEventListener(VIEW_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(VIEW_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readStoredView(): InstructionsView | null {
  if (sessionView) return sessionView;
  try {
    const stored = localStorage.getItem(VIEW_KEY);
    return stored === "edit" || stored === "preview" ? stored : null;
  } catch {
    return null;
  }
}

function writeStoredView(view: InstructionsView) {
  sessionView = view;
  try {
    localStorage.setItem(VIEW_KEY, view);
  } catch {
    // Private mode or a full disk: the choice still applies for this visit.
  }
  window.dispatchEvent(new Event(VIEW_EVENT));
}

function defaultView(instructions: string): InstructionsView {
  return instructions.trim() ? "preview" : "edit";
}

const noSubscription = () => () => {};

export function InstructionsCard({
  instructions,
  maxChars,
}: {
  instructions: string;
  maxChars: number;
}) {
  const [draft, setDraft] = useState(instructions);
  const [error, setError] = useState<string | null>(null);
  const save = useSaveInstructions();
  const input = useRef<HTMLTextAreaElement>(null);
  const focusOnEdit = useRef(false);
  // Server and hydration both use the saved-text default. The browser's last choice is read on
  // the client afterwards, same as the dev sign-in token.
  const fallback = defaultView(instructions);
  const mode = useSyncExternalStore(
    subscribeView,
    () => readStoredView() ?? fallback,
    () => fallback,
  );
  const isMac = useSyncExternalStore(
    noSubscription,
    () => /Mac|iPhone|iPad/.test(navigator.userAgent),
    () => false,
  );
  const dirty = draft.trim() !== instructions;
  const length = draft.trim().length;
  const over = length > maxChars;

  useEffect(() => {
    if (!focusOnEdit.current || mode !== "edit") return;
    focusOnEdit.current = false;
    input.current?.focus();
  }, [mode]);

  const changeMode = (next: InstructionsView) => {
    writeStoredView(next);
  };

  const shortcutLabel = (key: string) =>
    `${isMac ? "⌘" : "Ctrl+"}${key.toUpperCase()}`;

  const apply = (
    edit: (value: string, start: number, end: number) => MarkdownEdit,
  ) => {
    const element = input.current;
    if (!element) return;
    const next = edit(
      element.value,
      element.selectionStart ?? 0,
      element.selectionEnd ?? 0,
    );
    setDraft(next.value);
    setError(null);
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(next.start, next.end);
    });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey)
      return;
    const key = event.key.toLowerCase();
    if (key !== "b" && key !== "i") return;
    event.preventDefault();
    apply((value, start, end) =>
      toggleWrap(value, start, end, key === "b" ? "**" : "_"),
    );
  };

  const startEditing = () => {
    focusOnEdit.current = true;
    changeMode("edit");
  };

  // A save re-keys this card with the new version, so the outcome is read from the promise.
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    save.mutateAsync(draft).then(
      (result) =>
        toast.success(
          result.changed
            ? "Instrucciones guardadas. El asistente las usa desde la próxima respuesta."
            : "No había cambios para guardar.",
        ),
      (cause: Error) => {
        setError(
          cause instanceof ApiError
            ? (cause.fields?.instructions ?? cause.message)
            : cause.message,
        );
        changeMode("edit");
      },
    );
  };

  return (
    <Section
      title="Instrucciones"
      description="Lo que el asistente tiene que saber de la empresa y cómo quieres que hable de ella. Admite Markdown: títulos, listas y negrita. Precios y proyectos van en Conocimiento."
    >
      <form
        onSubmit={onSubmit}
        className={cn(
          "overflow-hidden rounded-xl bg-card ring-1 ring-border/60 transition-shadow focus-within:ring-2 focus-within:ring-ring/50 dark:ring-0",
          error &&
            "ring-2 ring-destructive focus-within:ring-destructive/60 dark:ring-2",
        )}
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-border/70 px-3 py-2">
          <Tabs
            value={mode}
            onValueChange={(value) => {
              if (value === "edit" || value === "preview") changeMode(value);
            }}
            className="w-fit shrink-0"
          >
            <TabsList aria-label="Modo de las instrucciones" className="h-8!">
              <TabsTrigger
                value="edit"
                type="button"
                className="px-2.5 text-[13px]"
              >
                <PencilIcon />
                Editar
              </TabsTrigger>
              <TabsTrigger
                value="preview"
                type="button"
                className="px-2.5 text-[13px]"
              >
                <EyeIcon />
                Vista previa
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {mode === "edit" ? (
            <div className="ml-auto flex max-w-full flex-wrap items-center gap-0.5">
              {FORMATS.map((format) => {
                const shortcut = format.shortcut
                  ? shortcutLabel(format.shortcut)
                  : null;
                return (
                  <Tooltip key={format.label}>
                    <TooltipTrigger
                      render={
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          className="max-lg:size-8"
                          aria-label={
                            shortcut
                              ? `${format.label} (${shortcut})`
                              : format.label
                          }
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() =>
                            apply((value, start, end) =>
                              "wrap" in format
                                ? toggleWrap(value, start, end, format.wrap)
                                : toggleLinePrefix(
                                    value,
                                    start,
                                    end,
                                    format.line,
                                  ),
                            )
                          }
                        />
                      }
                    >
                      {format.icon}
                    </TooltipTrigger>
                    <TooltipContent>
                      {format.label}
                      {shortcut ? ` · ${shortcut}` : null}
                      {" · "}
                      <span className="font-mono">{format.sample}</span>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          ) : null}
        </div>
        {mode === "edit" ? (
          <>
            <label htmlFor="company-instructions" className="sr-only">
              Instrucciones de la empresa
            </label>
            <textarea
              ref={input}
              id="company-instructions"
              value={draft}
              maxLength={maxChars + 200}
              aria-invalid={error ? true : undefined}
              placeholder={PLACEHOLDER}
              className="field-sizing-content block min-h-80 w-full resize-none bg-transparent px-5 py-4 font-mono text-[13px] leading-relaxed outline-none placeholder:text-muted-foreground"
              onChange={(event) => {
                setDraft(event.target.value);
                setError(null);
              }}
              onKeyDown={onKeyDown}
            />
          </>
        ) : draft.trim() ? (
          <div onDoubleClick={startEditing}>
            <Markdown className="min-h-80 px-5 py-4">{draft}</Markdown>
          </div>
        ) : (
          <p
            className="min-h-80 px-5 py-4 text-sm leading-relaxed text-muted-foreground"
            onDoubleClick={startEditing}
          >
            Todavía no hay instrucciones. Cambia a Editar para escribirlas.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/70 px-5 py-2.5">
          <p
            role={error ? "alert" : undefined}
            className={cn(
              "min-w-0 flex-1 text-[13px]",
              error ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {error ??
              "Van después de las reglas de la plataforma. Si se contradicen, ganan las reglas."}
          </p>
          <span
            className={cn(
              "text-xs tabular-nums",
              over ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {formatNumber(length)} / {formatNumber(maxChars)}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!dirty || save.isPending}
              onClick={() => {
                setDraft(instructions);
                setError(null);
              }}
            >
              Descartar
            </Button>
            <Button type="submit" size="sm" disabled={!dirty || save.isPending}>
              {save.isPending ? <Spinner /> : null}
              Guardar
            </Button>
          </div>
        </div>
      </form>
    </Section>
  );
}
