"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/lib/auth";
import { useMe } from "@/lib/queries";

export default function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status, signOut } = useAuth();
  const me = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const adminWithoutCompany =
    me.data?.platformAdmin === true && me.data.company == null;

  useEffect(() => {
    if (status === "signed_out") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (adminWithoutCompany && !pathname.startsWith("/companies")) {
      router.replace("/companies");
    }
  }, [adminWithoutCompany, pathname, router]);

  if (status !== "signed_in" || me.isPending) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    );
  }

  if (me.isError) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-muted-foreground">
          Este usuario no tiene acceso al panel.
        </p>
        <Button
          variant="outline"
          onClick={() => {
            void signOut().then(() => router.replace("/login"));
          }}
        >
          Cerrar sesión
        </Button>
      </div>
    );
  }

  if (adminWithoutCompany && !pathname.startsWith("/companies")) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 64)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="@container/main flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
