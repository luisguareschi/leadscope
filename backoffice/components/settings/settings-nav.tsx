"use client";

import { cn } from "cn";
import type { SectionId, SectionItem } from "./sections";

export function SettingsNav({
  groups,
  active,
  onSelect,
  stateOf,
}: {
  groups: Array<{ label: string; items: SectionItem[] }>;
  active: SectionId;
  onSelect: (id: SectionId) => void;
  stateOf?: (id: SectionId) => "error" | "changed" | null;
}) {
  return (
    <nav
      aria-label="Secciones de configuración"
      className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] lg:-mx-6 lg:px-6 @4xl/main:mx-0 @4xl/main:overflow-visible @4xl/main:px-0"
    >
      <div className="flex w-max gap-1 @4xl/main:w-auto @4xl/main:flex-col @4xl/main:gap-6">
        {groups.map((group) => (
          <div
            key={group.label}
            className="flex gap-1 @4xl/main:flex-col @4xl/main:gap-0.5"
          >
            <p className="hidden px-2.5 pb-1.5 text-xs font-medium text-muted-foreground @4xl/main:block">
              {group.label}
            </p>
            {group.items.map((item) => {
              const Icon = item.icon;
              const current = item.id === active;
              const state = stateOf?.(item.id) ?? null;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={current ? "page" : undefined}
                  onClick={() => onSelect(item.id)}
                  className={cn(
                    "flex shrink-0 items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    current
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  <Icon
                    className={cn(
                      "size-4 shrink-0",
                      current ? "text-foreground" : "text-muted-foreground",
                    )}
                  />
                  <span className="flex-1 text-left">{item.label}</span>
                  {state ? (
                    <span
                      className={cn(
                        "size-1.5 shrink-0 rounded-full",
                        state === "error" ? "bg-destructive" : "bg-primary",
                      )}
                    >
                      <span className="sr-only">
                        {state === "error" ? "Con errores" : "Sin guardar"}
                      </span>
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </nav>
  );
}
