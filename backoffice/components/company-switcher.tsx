"use client";

import { usePathname } from "next/navigation";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import { cn } from "cn";
import { PickerSheet } from "@/components/threads/stage-picker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth";
import { initials } from "@/lib/format";
import { useMe } from "@/lib/queries";
import { switchCompany } from "@/lib/support";
import type { MeCompany } from "@/lib/types";

const fold = (text: string) =>
  text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/**
 * Only for an operator of more than one company, never inside support access (the support bar is
 * the way out there). Picking another company reloads the panel in it.
 */
export function useCompanySwitcher() {
  const me = useMe();
  const { email } = useAuth();
  const pathname = usePathname();
  const companies = me.data?.companies ?? [];
  const active = me.data?.company ?? null;
  const enabled =
    companies.length > 1 &&
    me.data?.supportAccess === false &&
    active !== null &&
    Boolean(email);

  const choose = (company: MeCompany) => {
    if (!email || company.id === active?.id) return;
    switchCompany(company.id, email, pathname);
  };

  return { enabled, companies, active, choose };
}

function CompanyBadge({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/12 text-[10px] font-semibold text-primary dark:bg-primary/20",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

/** The expanded sidebar's company row: the current company, and the menu to pick another. */
export function SidebarCompanySwitcher() {
  const { enabled, companies, active, choose } = useCompanySwitcher();
  if (!enabled || !active) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Empresa: ${active.name}. Cambiar empresa`}
        className="flex w-full items-center gap-2.5 rounded-xl bg-card px-2.5 py-2 text-left ring-1 ring-border/60 transition-colors outline-none hover:bg-card/70 focus-visible:ring-3 focus-visible:ring-ring/40 aria-expanded:bg-card/70 dark:bg-white/5 dark:ring-0 dark:hover:bg-white/8 dark:aria-expanded:bg-white/8"
      >
        <CompanyBadge name={active.name} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {active.name}
        </span>
        <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-56" sideOffset={6}>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Tus empresas</DropdownMenuLabel>
          {companies.map((company) => {
            const current = company.id === active.id;
            return (
              <DropdownMenuItem
                key={company.id}
                aria-current={current ? "true" : undefined}
                className="gap-2.5"
                onClick={() => choose(company)}
              >
                <CompanyBadge name={company.name} />
                <span
                  className={cn("min-w-0 truncate", current && "font-medium")}
                >
                  {company.name}
                </span>
                {current ? (
                  <CheckIcon className="ml-auto text-primary" />
                ) : null}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Below md: a tappable subtitle under the page title that opens the companies as a bottom sheet. */
export function MobileCompanySwitcher() {
  const { enabled, companies, active, choose } = useCompanySwitcher();
  if (!enabled || !active) return null;

  return (
    <PickerSheet
      title="Cambiar empresa"
      options={companies}
      getKey={(company) => company.id}
      isSelected={(company) => company.id === active.id}
      filter={(company, query) => {
        const name = fold(company.name);
        return fold(query)
          .trim()
          .split(/\s+/)
          .every((word) => name.includes(word));
      }}
      renderOption={(company) => (
        <>
          <CompanyBadge name={company.name} className="size-8 text-xs" />
          <span className="min-w-0 truncate">{company.name}</span>
        </>
      )}
      onSelect={choose}
      searchPlaceholder="Buscar empresa…"
      emptyText="No hay coincidencias."
      trigger={
        <button
          type="button"
          className="-ml-1.5 inline-flex max-w-full min-w-0 items-center gap-1.5 self-start rounded-lg px-1.5 py-0.5 text-left text-[13px] font-medium text-muted-foreground transition-colors outline-none [-webkit-tap-highlight-color:transparent] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 active:bg-accent md:hidden"
        />
      }
      triggerLabel={`Empresa: ${active.name}. Cambiar empresa`}
    >
      <CompanyBadge
        name={active.name}
        className="size-4.5 rounded-[5px] text-[9px]"
      />
      <span className="min-w-0 truncate">{active.name}</span>
    </PickerSheet>
  );
}
