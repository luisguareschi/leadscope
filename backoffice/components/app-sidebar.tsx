"use client";

import Link from "next/link";
import {
  BookOpenTextIcon,
  Building2Icon,
  MessagesSquareIcon,
  SlidersHorizontalIcon,
} from "lucide-react";
import { AppLogo } from "@/components/app-logo";
import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useMe, useThreadsSummary } from "@/lib/queries";
import { SupportBar } from "./support-bar";

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const me = useMe();
  const hasCompany = Boolean(me.data?.company);
  const supportAccess = me.data?.supportAccess === true;
  const summary = useThreadsSummary(hasCompany);

  const items = [
    ...(hasCompany
      ? [
          {
            title: "Conversaciones",
            url: "/threads",
            icon: <MessagesSquareIcon />,
            badge: summary.data?.unassignedToContact || undefined,
            badgeLabel: "leads por contactar sin asesor",
          },
          {
            title: "Conocimiento",
            url: "/knowledge",
            icon: <BookOpenTextIcon />,
          },
          {
            title: "Configuración",
            url: "/settings",
            icon: <SlidersHorizontalIcon />,
          },
        ]
      : []),
    // Inside a company, the support bar is the way back to Empresas.
    ...(me.data?.platformAdmin && !supportAccess
      ? [
          {
            title: "Empresas",
            url: "/companies",
            icon: <Building2Icon />,
          },
        ]
      : []),
  ];

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link href={hasCompany ? "/threads" : "/companies"} />}
            >
              <AppLogo className="min-w-9 min-h-9" />
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate text-base font-semibold">
                  LeadScope
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {me.data?.company?.name ??
                    (me.data?.platformAdmin ? "Plataforma" : " ")}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={items} />
      </SidebarContent>
      <SidebarFooter>
        {me.data?.supportAccess && me.data?.company && (
          <SupportBar companyName={me.data?.company.name} />
        )}
        <NavUser
          email={me.data?.operator?.email ?? ""}
          label={hasCompany && !supportAccess ? "Operador" : "Administración"}
        />
      </SidebarFooter>
    </Sidebar>
  );
}
