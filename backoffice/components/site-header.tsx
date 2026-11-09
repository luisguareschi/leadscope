"use client";

import { usePathname } from "next/navigation";
import { HelpTip } from "@/components/help-tip";
import { NavUser } from "@/components/nav-user";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { useMe } from "@/lib/queries";
import { useIsIOSPWA } from "@/hooks/use-is-ios-pwa";
import { cn } from "cn";

function titleFor(pathname: string, platformAdmin: boolean): string {
  if (pathname.startsWith("/metrics")) return "Métricas";
  if (pathname.startsWith("/knowledge")) return "Conocimiento";
  if (pathname.startsWith("/settings")) return "Configuración";
  if (pathname.startsWith("/companies"))
    return platformAdmin ? "Empresas" : "Sin acceso";
  return "Conversaciones";
}

export function SiteHeader() {
  const pathname = usePathname();
  const me = useMe();
  const isIOSPWA = useIsIOSPWA();
  const { isMobile } = useSidebar();
  const hasCompany = Boolean(me.data?.company);
  const supportAccess = me.data?.supportAccess === true;
  const title = titleFor(pathname, me.data?.platformAdmin === true);

  return (
    <header
      className={cn(
        "flex h-(--header-height) shrink-0 items-center transition-[width,height] ease-linear",
        isIOSPWA ? "mt-4" : "mt-0",
      )}
    >
      <div className="mx-auto grid w-full max-w-350 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-2">
          {/* On desktop the sidebar has its own collapse button; on phones it is a sheet. */}
          {isMobile ? (
            <SidebarTrigger className="-ml-1.5 text-muted-foreground" />
          ) : null}
          <div className="flex min-w-0 items-center gap-0.5">
            <h1 className="truncate font-heading text-[22px] font-medium tracking-tight lg:text-2xl">
              {title}
            </h1>
            {pathname.startsWith("/metrics") ? (
              <HelpTip label="Cómo se cuentan las métricas">
                Cada lead cuenta en el día en que escribió por primera vez, con
                su etapa actual. «Ahora mismo» no depende del período.
              </HelpTip>
            ) : null}
          </div>
        </div>
        <div className="flex items-center justify-end gap-1.5">
          <NavUser
            email={me.data?.operator?.email ?? ""}
            label={hasCompany && !supportAccess ? "Operador" : "Administración"}
          />
        </div>
      </div>
    </header>
  );
}
