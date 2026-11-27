"use client";

import { useState } from "react";
import { CheckIcon, ChevronRightIcon, ChevronsUpDownIcon } from "lucide-react";
import { cn } from "cn";
import { LiquidSheet } from "@/components/ui/liquid-sheet";
import type { SectionGroup, SectionId } from "./sections";

type SectionState = "error" | "changed" | null;

function StateDot({ state, label }: { state: SectionState; label?: string }) {
  if (!state) return null;
  return (
    <span
      className={cn(
        "size-1.5 shrink-0 rounded-full",
        state === "error" ? "bg-destructive" : "bg-primary",
      )}
    >
      <span className="sr-only">
        {label ?? (state === "error" ? "Con errores" : "Sin guardar")}
      </span>
    </span>
  );
}

export function SettingsNav({
  groups,
  active,
  onSelect,
  stateOf,
}: {
  groups: SectionGroup[];
  active: SectionId;
  onSelect: (id: SectionId) => void;
  stateOf?: (id: SectionId) => SectionState;
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const stateFor = (id: SectionId) => stateOf?.(id) ?? null;
  // The advanced group opens by itself when it holds the current section or something to fix.
  const isExpanded = (group: SectionGroup) =>
    !group.advanced ||
    advancedOpen ||
    group.items.some(
      (item) => item.id === active || stateFor(item.id) !== null,
    );

  const activeGroup = groups.find((group) =>
    group.items.some((item) => item.id === active),
  );
  const activeItem = activeGroup?.items.find((item) => item.id === active);
  const ActiveIcon = activeItem?.icon;
  const states = groups.flatMap((group) =>
    group.items.map((item) => stateFor(item.id)),
  );
  const summary: SectionState = states.includes("error")
    ? "error"
    : states.includes("changed")
      ? "changed"
      : null;

  return (
    <>
      {/* Below @4xl/main: one selector that opens every section in a Liquid Glass bottom sheet. */}
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={sheetOpen}
        onClick={() => setSheetOpen(true)}
        className="revolut-card flex min-h-12 w-full items-center gap-3 rounded-[20px] px-3.5 py-2.5 text-left transition-colors outline-none [-webkit-tap-highlight-color:transparent] focus-visible:ring-3 focus-visible:ring-ring/40 active:scale-[0.99] @4xl/main:hidden"
      >
        {ActiveIcon ? (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
            <ActiveIcon className="size-4" />
          </span>
        ) : null}
        <span className="flex min-w-0 flex-1 flex-col">
          {activeGroup ? (
            <span className="truncate text-xs text-muted-foreground">
              {activeGroup.label}
            </span>
          ) : null}
          <span className="truncate text-sm font-semibold">
            {activeItem?.label ?? "Secciones de configuración"}
          </span>
        </span>
        <StateDot
          state={summary}
          label={
            summary === "error"
              ? "Hay secciones con errores"
              : "Hay cambios sin guardar"
          }
        />
        <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground" />
      </button>

      <LiquidSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="Secciones de configuración"
        detents={["medium", "large"]}
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-2">
          {groups.map((group) => {
            const expanded = isExpanded(group);
            return (
              <div key={group.label} className="flex flex-col pt-2">
                {group.advanced ? (
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setAdvancedOpen((v) => !v)}
                    className="flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-xs font-medium text-muted-foreground transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40 active:bg-muted/60"
                  >
                    <ChevronRightIcon
                      className={cn(
                        "size-3.5 transition-transform",
                        expanded && "rotate-90",
                      )}
                    />
                    {group.label}
                  </button>
                ) : (
                  <p className="px-3 pt-1 pb-1.5 text-xs font-medium text-muted-foreground">
                    {group.label}
                  </p>
                )}
                {expanded ? (
                  <ul className="flex flex-col gap-0.5">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const current = item.id === active;
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            aria-current={current ? "page" : undefined}
                            onClick={() => {
                              onSelect(item.id);
                              setSheetOpen(false);
                            }}
                            className={cn(
                              "flex min-h-11 w-full items-center gap-3 rounded-2xl px-3 text-left text-[15px] transition-colors outline-none [-webkit-tap-highlight-color:transparent] focus-visible:ring-3 focus-visible:ring-ring/40",
                              current
                                ? "bg-primary/12 font-semibold text-foreground dark:bg-white/10"
                                : "text-foreground active:bg-muted/60",
                            )}
                          >
                            <Icon
                              className={cn(
                                "size-4.5 shrink-0",
                                current
                                  ? "text-primary"
                                  : "text-muted-foreground",
                              )}
                            />
                            <span className="min-w-0 flex-1 truncate">
                              {item.label}
                            </span>
                            <StateDot state={stateFor(item.id)} />
                            {current ? (
                              <CheckIcon className="size-4 shrink-0 text-primary" />
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </div>
      </LiquidSheet>

      {/* From @4xl/main: the vertical sidebar. */}
      <nav
        aria-label="Secciones de configuración"
        className="hidden flex-col gap-6 @4xl/main:flex"
      >
        {groups.map((group) => {
          const expanded = isExpanded(group);
          return (
            <div key={group.label} className="flex flex-col gap-0.5">
              {group.advanced ? (
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setAdvancedOpen((v) => !v)}
                  className="flex shrink-0 items-center gap-1.5 px-3 pb-1.5 text-xs font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ChevronRightIcon
                    className={cn(
                      "size-3.5 transition-transform",
                      expanded && "rotate-90",
                    )}
                  />
                  {group.label}
                </button>
              ) : (
                <p className="px-3 pb-1.5 text-xs font-medium text-muted-foreground">
                  {group.label}
                </p>
              )}
              {expanded
                ? group.items.map((item) => {
                    const Icon = item.icon;
                    const current = item.id === active;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-current={current ? "page" : undefined}
                        onClick={() => onSelect(item.id)}
                        className={cn(
                          "flex shrink-0 items-center gap-2.5 rounded-full px-3 py-2 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                          current
                            ? "bg-white/95 font-semibold text-foreground shadow-[0_2px_8px_rgb(16_24_40/0.07),inset_0_1px_0_rgb(255_255_255/0.8)] dark:bg-white/14 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.14)]"
                            : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground dark:hover:bg-white/7",
                        )}
                      >
                        <Icon
                          className={cn(
                            "size-4 shrink-0",
                            current ? "text-primary" : "text-muted-foreground",
                          )}
                        />
                        <span className="flex-1 text-left">{item.label}</span>
                        <StateDot state={stateFor(item.id)} />
                      </button>
                    );
                  })
                : null}
            </div>
          );
        })}
      </nav>
    </>
  );
}
