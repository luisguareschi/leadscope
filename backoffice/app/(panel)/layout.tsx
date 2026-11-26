"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { AssistantTestProvider } from "@/components/assistant-test/assistant-test-provider";
import { MobileTabBar } from "@/components/mobile-tab-bar";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "cn";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { isThreadDetailPath } from "@/lib/nav-items";
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
  const isThreadDetail = isThreadDetailPath(pathname);
  const adminWithoutCompany =
    me.data?.platformAdmin === true && me.data.company == null;
  // Empresas is the admin home. Métricas is the other page they can open from there.
  const adminPlatformPage =
    pathname.startsWith("/companies") || pathname.startsWith("/metrics");
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
    if (adminWithoutCompany && !adminPlatformPage) {
      router.replace("/companies");
    }
  }, [adminWithoutCompany, adminPlatformPage, router]);

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

  if (adminWithoutCompany && !adminPlatformPage) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    );
  }

  return (
    <SidebarProvider
      className="max-md:h-dvh max-md:overflow-hidden"
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 64)",
          // Room for the 40px icon buttons once the sidebar is collapsed to icons.
          "--sidebar-width-icon": "3.5rem",
          "--header-height": "calc(var(--spacing) * 16)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <AssistantTestProvider>
        {/* Below md the shell is exactly one screen: header, the page's own scroll, tab bar. */}
        <SidebarInset className="max-md:min-h-0 max-md:overflow-hidden">
          {/* Below lg the thread page draws its own compact header. */}
          <SiteHeader
            className={isThreadDetail ? "max-lg:hidden" : undefined}
          />
          <div
            className={cn(
              "@container/main flex flex-1 flex-col gap-4 overflow-y-auto overscroll-contain pt-2 max-md:min-h-0 md:gap-6 *:mx-auto *:w-full *:max-w-350",
              // From md the inset has an outer margin (spacing * 4 in total) to leave room for.
              isThreadDetail
                ? "pb-0 md:max-h-[calc(100svh-var(--spacing)*4)] lg:max-h-[calc(100svh-var(--header-height)-var(--spacing)*4)] lg:pb-6"
                : "pb-4 md:max-h-[calc(100svh-var(--header-height)-var(--spacing)*4)] md:pb-6",
            )}
          >
            {children}
          </div>
          <MobileTabBar />
        </SidebarInset>
      </AssistantTestProvider>
    </SidebarProvider>
  );
}
