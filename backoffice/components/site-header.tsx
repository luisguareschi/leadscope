"use client";

import { usePathname } from "next/navigation";
import { Separator } from "@/components/ui/separator";
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
        "flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)",
        isIOSPWA ? "mt-4" : "mt-0",
      )}
    >
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 h-4 data-vertical:self-auto"
        />
        <h1 className="text-base font-medium">
          {titleFor(pathname, me.data?.platformAdmin === true)}
        </h1>
      </div>
    </header>
  );
}
