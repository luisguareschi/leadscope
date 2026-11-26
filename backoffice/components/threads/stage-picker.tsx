"use client";

import { useRef, useState, type ReactElement, type ReactNode } from "react";
import { toast } from "sonner";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { cn } from "cn";
import { StatusDot } from "@/components/panel";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { useIsMobile } from "@/hooks/use-mobile";
import { useChangeStage, useSettings } from "@/lib/queries";
import { stageMetaOf, stagesForCompany } from "@/lib/thread-status";
import type { LeadStage, StageConfig, Thread } from "@/lib/types";

const fold = (text: string) =>
  text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

function matches(
  stage: LeadStage,
  query: string,
  stages: StageConfig[],
): boolean {
  const words = fold(query).trim().split(/\s+/).filter(Boolean);
  const label = fold(stageMetaOf(stage, stages).label);
  return words.every((word) => label.includes(word));
}

/** Past this many options the sheet gets a search field. */
const SEARCH_ABOVE = 6;

/**
 * Below md, the pickers' list as a bottom sheet: big rows, one tap picks and closes. The search
 * field only shows for long lists, and nothing focuses it, so the keyboard stays down.
 */
export function PickerSheet<T>({
  title,
  options,
  getKey,
  isSelected,
  filter,
  renderOption,
  onSelect,
  searchPlaceholder,
  emptyText,
  trigger,
  triggerLabel,
  triggerTitle,
  footer,
  children,
}: {
  title: string;
  options: T[];
  getKey: (option: T) => string;
  isSelected: (option: T) => boolean;
  filter: (option: T, query: string) => boolean;
  renderOption: (option: T) => ReactNode;
  onSelect: (option: T) => void;
  searchPlaceholder: string;
  emptyText: string;
  /** The trigger button; `children` is what it shows. */
  trigger: ReactElement;
  triggerLabel: string;
  triggerTitle?: string;
  /** Optional pinned action below the list (e.g. "Ver todas en Empresas"). */
  footer?: (close: () => void) => ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const list = useRef<HTMLDivElement>(null);
  const selected = useRef<HTMLButtonElement>(null);
  const searchable = options.length > SEARCH_ABOVE;
  const visible = query
    ? options.filter((option) => filter(option, query))
    : options;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (next) setQuery("");
        setOpen(next);
      }}
    >
      <SheetTrigger
        aria-label={triggerLabel}
        title={triggerTitle}
        className="[&_svg:not([class*='size-'])]:size-4"
        render={trigger}
      >
        {children}
        <ChevronDownIcon className="pointer-events-none size-4 text-muted-foreground" />
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="gap-0 px-0 pt-0"
        initialFocus={() => selected.current ?? list.current}
      >
        <div
          aria-hidden
          className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30"
        />
        <SheetHeader className="px-4 pt-2.5 pb-2">
          <SheetTitle className="text-base">{title}</SheetTitle>
        </SheetHeader>
        {searchable ? (
          <div className="px-4 pb-2">
            <Input
              type="search"
              enterKeyHint="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="h-11 rounded-xl text-base"
            />
          </div>
        ) : null}
        <div
          ref={list}
          tabIndex={-1}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 outline-none"
        >
          {visible.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {emptyText}
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {visible.map((option) => {
                const current = isSelected(option);
                return (
                  <li key={getKey(option)}>
                    <button
                      ref={current ? selected : undefined}
                      type="button"
                      aria-current={current ? "true" : undefined}
                      className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[15px] outline-none select-none focus-visible:bg-accent active:bg-accent aria-[current=true]:font-medium [&_svg]:shrink-0"
                      onClick={() => {
                        onSelect(option);
                        setOpen(false);
                      }}
                    >
                      {renderOption(option)}
                      {current ? (
                        <CheckIcon className="ml-auto size-5 text-primary" />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {footer ? (
          <div className="shrink-0 border-t border-border/70 px-2 pt-2">
            {footer(() => setOpen(false))}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

/**
 * The lead stage, and the one control to change it (Linear-style): any configured stage, in any
 * direction. Contactado records who and when; leaving it clears that. No confirmation.
 */
export function StagePicker({
  thread,
  size = "default",
}: {
  thread: Thread;
  /** `compact` fits a table cell. */
  size?: "default" | "compact";
}) {
  const settings = useSettings();
  const stages = stagesForCompany(settings.data?.config.stages);
  const stageKeys = stages.map((stage) => stage.key);
  const change = useChangeStage(thread.id);
  const meta = stageMetaOf(thread.stage, stages);
  const compact = size === "compact";
  const isMobile = useIsMobile();

  const choose = (stage: LeadStage | null) => {
    if (!stage || stage === thread.stage) return;
    change.mutate(stage, {
      onError: (error) => toast.error(error.message),
      onSuccess: ({ thread: updated }) => {
        if (stage !== "contacted") {
          toast.success(`Etapa: ${stageMetaOf(stage, stages).label}.`);
          return;
        }
        const assignedNow = !thread.assignee && updated.assignee;
        toast.success(
          assignedNow
            ? "Marcada como contactada y asignada a ti."
            : "Marcada como contactada.",
        );
      },
    });
  };

  const label = `Etapa: ${meta.label}. Cambiar etapa`;
  const button = (
    <Button
      variant={compact ? "ghost" : "outline"}
      size="sm"
      disabled={change.isPending}
      className={cn(
        "max-w-full min-w-0 justify-start gap-1.5 font-normal",
        compact
          ? "-ml-2 h-7 px-2 max-md:-ml-2.5 max-md:h-8 max-md:px-2.5"
          : "font-medium",
      )}
    />
  );
  const value = (
    <>
      {change.isPending ? (
        <Spinner className="size-4" />
      ) : (
        <StatusDot tone={meta.tone} />
      )}
      <span className="truncate text-[13px]">{meta.label}</span>
    </>
  );

  if (isMobile) {
    return (
      <PickerSheet
        title="Cambiar etapa"
        options={stageKeys}
        getKey={(stage) => stage}
        isSelected={(stage) => stage === thread.stage}
        filter={(stage, query) => matches(stage, query, stages)}
        renderOption={(stage) => {
          const item = stageMetaOf(stage, stages);
          return (
            <>
              <StatusDot tone={item.tone} className="size-2.5" />
              <span className="min-w-0 truncate">{item.label}</span>
            </>
          );
        }}
        onSelect={choose}
        searchPlaceholder="Buscar etapa…"
        emptyText="No hay coincidencias."
        trigger={button}
        triggerLabel={label}
      >
        {value}
      </PickerSheet>
    );
  }

  return (
    <Combobox
      items={stageKeys}
      value={thread.stage}
      onValueChange={choose}
      itemToStringLabel={(stage: LeadStage) => stageMetaOf(stage, stages).label}
      filter={(stage, query) => matches(stage, query, stages)}
      autoHighlight
    >
      <ComboboxTrigger aria-label={label} render={button}>
        {value}
      </ComboboxTrigger>
      <ComboboxContent className="w-56 min-w-56" align="start">
        <ComboboxInput showTrigger={false} placeholder="Cambiar etapa…" />
        <ComboboxEmpty>No hay coincidencias.</ComboboxEmpty>
        <ComboboxList>
          {(stage: LeadStage) => {
            const item = stageMetaOf(stage, stages);
            return (
              <ComboboxItem key={stage} value={stage}>
                <StatusDot tone={item.tone} />
                <span className="truncate">{item.label}</span>
              </ComboboxItem>
            );
          }}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
