"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { HeaderSearch } from "@/components/header-search";
import { NavUser } from "@/components/nav-user";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { useMe } from "@/lib/queries";
import { useIsIOSPWA } from "@/hooks/use-is-ios-pwa";
import { cn } from "cn";

function titleFor(pathname: string, platformAdmin: boolean): string {
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
  const { state, isMobile } = useSidebar();
  const hasCompany = Boolean(me.data?.company);
  const supportAccess = me.data?.supportAccess === true;

  return (
    <header
      className={cn(
        "flex h-(--header-height) shrink-0 items-center transition-[width,height] ease-linear",
        isIOSPWA ? "mt-4" : "mt-0",
      )}
    >
      <div className="mx-auto grid w-full max-w-[1400px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 md:grid-cols-[minmax(0,1fr)_minmax(0,24rem)_minmax(0,1fr)] lg:px-6">
        <div className="flex min-w-0 items-center gap-2">
          {/* The sidebar has its own collapse button; this one brings it back. */}
          {isMobile || state === "collapsed" ? (
            <SidebarTrigger className="-ml-1.5 text-muted-foreground" />
          ) : null}
          <h1 className="truncate font-heading text-[22px] font-medium tracking-tight lg:text-2xl">
            {titleFor(pathname, me.data?.platformAdmin === true)}
          </h1>
        </div>
        {hasCompany ? (
          <Suspense fallback={<div className="max-md:hidden" />}>
            <HeaderSearch className="max-md:hidden" />
          </Suspense>
        ) : (
          <div className="max-md:hidden" />
        )}
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
