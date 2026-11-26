"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  Building2Icon,
  CheckIcon,
  ChevronsUpDownIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { cn } from "cn";
import { PickerSheet } from "@/components/threads/stage-picker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth";
import { initials } from "@/lib/format";
import { useCompanies, useMe } from "@/lib/queries";
import { enterCompany, switchCompany } from "@/lib/support";
import type { MeCompany } from "@/lib/types";

const fold = (text: string) =>
  text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export type SwitcherCompany = MeCompany & {
  /** Platform admin entering a company they are not an operator of. */
  support: boolean;
};

/**
 * Company switcher for multi-company operators and platform admins.
 * - Regular operators see it only when they belong to 2+ active companies.
 * - Platform admins see their own operator companies plus every other active company (support access).
 */
export function useCompanySwitcher() {
  const me = useMe();
  const { email } = useAuth();
  const pathname = usePathname();
  const isAdmin = me.data?.platformAdmin === true;
  const adminCompanies = useCompanies(isAdmin, "active");

  const ownCompanies: SwitcherCompany[] = (me.data?.companies ?? []).map(
    (company) => ({ ...company, support: false }),
  );
  const ownIds = new Set(ownCompanies.map((company) => company.id));
  const supportCompanies: SwitcherCompany[] = isAdmin
    ? (adminCompanies.data?.companies ?? [])
        .filter((company) => !ownIds.has(company.id))
        .map((company) => ({
          id: company.id,
          name: company.name,
          slug: company.slug,
          assistantPaused: company.assistantPaused,
          support: true,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "es"))
    : [];

  const companies = [...ownCompanies, ...supportCompanies];
  const active = me.data?.company ?? null;
  const supportAccess = me.data?.supportAccess === true;
  const enabled =
    Boolean(email) &&
    (isAdmin
      ? companies.length > 0 || active !== null
      : ownCompanies.length > 1 && !supportAccess && active !== null);

  const choose = (company: SwitcherCompany) => {
    if (!email || company.id === active?.id) return;
    if (company.support) {
      enterCompany(company.id, email, pathname);
    } else {
      switchCompany(company.id, email, pathname);
    }
  };

  return {
    enabled,
    isAdmin,
    supportAccess,
    ownCompanies,
    supportCompanies,
    companies,
    active,
    choose,
  };
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

function PlatformBadge({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/12 text-primary dark:bg-primary/20",
        className,
      )}
    >
      <ShieldCheckIcon className="size-3.5" />
    </span>
  );
}

/** The sidebar's company row: full row when expanded, compact badge icon with tooltip when collapsed. */
export function SidebarCompanySwitcher({
  collapsed = false,
}: {
  collapsed?: boolean;
}) {
  const router = useRouter();
  const {
    enabled,
    isAdmin,
    supportAccess,
    ownCompanies,
    supportCompanies,
    active,
    choose,
  } = useCompanySwitcher();
  if (!enabled) return null;

  const label = active
    ? `Empresa: ${active.name}${supportAccess ? " (acceso de soporte)" : ""}. Cambiar empresa`
    : "Plataforma. Elegir empresa";

  return (
    <DropdownMenu>
      {collapsed ? (
        <DropdownMenuTrigger
          aria-label={label}
          render={
            <SidebarMenuButton
              tooltip={label}
              className="relative justify-center rounded-xl bg-card p-0! ring-1 ring-border/60 dark:bg-white/5 dark:ring-0"
            />
          }
        >
          {active ? (
            <CompanyBadge
              name={active.name}
              className="size-7 rounded-lg text-xs"
            />
          ) : (
            <PlatformBadge className="size-7 rounded-lg [&_svg]:size-4" />
          )}
          {supportAccess ? (
            <span
              aria-hidden
              className="pointer-events-none absolute -top-0.5 -right-0.5 size-2 rounded-full bg-primary ring-2 ring-sidebar"
            />
          ) : null}
        </DropdownMenuTrigger>
      ) : (
        <DropdownMenuTrigger
          aria-label={label}
          className="flex w-full items-center gap-2.5 rounded-xl bg-card px-2.5 py-2 text-left ring-1 ring-border/60 transition-colors outline-none hover:bg-card/70 focus-visible:ring-3 focus-visible:ring-ring/40 aria-expanded:bg-card/70 dark:bg-white/5 dark:ring-0 dark:hover:bg-white/8 dark:aria-expanded:bg-white/8"
        >
          {active ? <CompanyBadge name={active.name} /> : <PlatformBadge />}
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm leading-tight font-medium">
              {active ? active.name : "Plataforma"}
            </span>
            {supportAccess ? (
              <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] leading-tight font-medium text-primary">
                <ShieldCheckIcon className="size-3 shrink-0" />
                Acceso de soporte
              </span>
            ) : null}
          </span>
          <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>
      )}
      <DropdownMenuContent
        className="min-w-60"
        side={collapsed ? "right" : "bottom"}
        align="start"
        sideOffset={6}
      >
        {ownCompanies.length > 0 ? (
          <DropdownMenuGroup>
            <DropdownMenuLabel>Tus empresas</DropdownMenuLabel>
            {ownCompanies.map((company) => {
              const current = company.id === active?.id;
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
        ) : null}

        {supportCompanies.length > 0 ? (
          <>
            {ownCompanies.length > 0 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex items-center gap-1.5">
                <ShieldCheckIcon className="size-3.5 text-primary" />
                {ownCompanies.length > 0
                  ? "Otras empresas · Soporte"
                  : "Empresas · Soporte"}
              </DropdownMenuLabel>
              {supportCompanies.map((company) => {
                const current = company.id === active?.id;
                return (
                  <DropdownMenuItem
                    key={company.id}
                    aria-current={current ? "true" : undefined}
                    className="gap-2.5"
                    onClick={() => choose(company)}
                  >
                    <CompanyBadge name={company.name} />
                    <span
                      className={cn(
                        "min-w-0 truncate",
                        current && "font-medium",
                      )}
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
          </>
        ) : null}

        {isAdmin ? (
          <>
            {ownCompanies.length > 0 || supportCompanies.length > 0 ? (
              <DropdownMenuSeparator />
            ) : null}
            <DropdownMenuItem
              className="gap-2.5 text-muted-foreground"
              onClick={() => router.push("/companies")}
            >
              <Building2Icon className="size-4" />
              <span>Ver todas en Empresas</span>
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Below md: a tappable subtitle under the page title that opens the companies as a bottom sheet. */
export function MobileCompanySwitcher() {
  const router = useRouter();
  const { enabled, isAdmin, supportAccess, companies, active, choose } =
    useCompanySwitcher();
  if (!enabled) return null;

  const options: SwitcherCompany[] =
    companies.length > 0
      ? companies
      : active
        ? [{ ...active, support: supportAccess }]
        : [];
  if (options.length === 0) return null;

  const triggerLabel = active
    ? `Empresa: ${active.name}${supportAccess ? " (acceso de soporte)" : ""}. Cambiar empresa`
    : "Plataforma. Elegir empresa";

  return (
    <PickerSheet
      title="Cambiar empresa"
      options={options}
      getKey={(company) => company.id}
      isSelected={(company) => company.id === active?.id}
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
          <span className="min-w-0 flex-1 truncate">{company.name}</span>
          {company.support ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/12 px-2 py-0.5 text-[11px] font-medium text-primary">
              <ShieldCheckIcon className="size-3" />
              Soporte
            </span>
          ) : null}
        </>
      )}
      onSelect={choose}
      searchPlaceholder="Buscar empresa…"
      emptyText="No hay coincidencias."
      footer={
        isAdmin
          ? (close) => (
              <button
                type="button"
                className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[15px] text-muted-foreground outline-none select-none focus-visible:bg-accent active:bg-accent"
                onClick={() => {
                  close();
                  router.push("/companies");
                }}
              >
                <span
                  aria-hidden
                  className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
                >
                  <Building2Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                  Ver todas en Empresas
                </span>
              </button>
            )
          : undefined
      }
      trigger={
        <button
          type="button"
          className="-ml-1.5 inline-flex max-w-full min-w-0 items-center gap-1.5 self-start rounded-lg px-1.5 py-0.5 text-left text-[13px] font-medium text-muted-foreground transition-colors outline-none [-webkit-tap-highlight-color:transparent] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 active:bg-accent md:hidden"
        />
      }
      triggerLabel={triggerLabel}
    >
      {active ? (
        <CompanyBadge
          name={active.name}
          className="size-4.5 rounded-[5px] text-[9px]"
        />
      ) : (
        <PlatformBadge className="size-4.5 rounded-[5px] [&_svg]:size-3" />
      )}
      <span className="min-w-0 truncate">
        {active ? active.name : "Plataforma"}
      </span>
      {supportAccess ? (
        <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-primary/12 px-1.5 py-0.5 text-[10px] leading-none font-semibold text-primary">
          Soporte
        </span>
      ) : null}
    </PickerSheet>
  );
}
