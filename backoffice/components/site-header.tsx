"use client";

import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarTrigger } from "@/components/ui/sidebar";
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

  return (
    <header
      className={cn(
        "flex h-(--header-height) shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)",
        isIOSPWA ? "mt-4" : "mt-0",
      )}
    >
      <div className="flex w-full items-center gap-2 px-4 lg:px-6">
        <SidebarTrigger className="-ml-1.5 text-muted-foreground" />
        <h1 className="font-heading text-xl font-semibold tracking-tight lg:text-2xl">
          {titleFor(pathname, me.data?.platformAdmin === true)}
        </h1>
        <ThemeToggle className="ml-auto -mr-1.5" />
      </div>
    </header>
  );
}
