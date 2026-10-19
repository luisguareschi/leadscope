"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useMe } from "@/lib/queries";
import {
  clearSupportCompany,
  leaveCompany,
  supportCompanyIdFor,
} from "@/lib/support";

export default function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status, signOut, email } = useAuth();
  const me = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const adminWithoutCompany =
    me.data?.platformAdmin === true && me.data.company == null;
  // The company this admin entered no longer exists, or was archived.
  const enteredCompanyGone =
    me.error instanceof ApiError &&
    (me.error.status === 404 || me.error.code === "company_archived") &&
    supportCompanyIdFor(email) !== null;
  const blockedMessage =
    me.error instanceof ApiError &&
    (me.error.code === "operator_archived" ||
      me.error.code === "company_archived")
      ? me.error.message
      : "Este usuario no tiene acceso al panel.";

  useEffect(() => {
    if (status === "signed_out") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (adminWithoutCompany && !pathname.startsWith("/companies")) {
      router.replace("/companies");
    }
  }, [adminWithoutCompany, pathname, router]);

  useEffect(() => {
    if (enteredCompanyGone) leaveCompany();
  }, [enteredCompanyGone]);

  useEffect(() => {
    // The API ignored the header (this login is not a platform admin): stop sending it.
    if (me.data && !me.data.supportAccess && supportCompanyIdFor(email))
      clearSupportCompany();
  }, [me.data, email]);

  if (status !== "signed_in" || me.isPending || enteredCompanyGone) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    );
  }

  if (me.isError) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="max-w-md text-sm text-muted-foreground">
          {blockedMessage}
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
        <div className="@container/main max-h-[calc(100svh-var(--header-height)-var(--spacing)*4)] overflow-y-auto flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
