"use client";

import Link from "next/link";
import {
  BookOpenTextIcon,
  Building2Icon,
  MessagesSquareIcon,
  SlidersHorizontalIcon,
} from "lucide-react";
import { AppLogoTile } from "@/components/app-logo";
import { NavMain } from "@/components/nav-main";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
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
              className="hover:bg-transparent active:bg-transparent"
              render={<Link href={hasCompany ? "/threads" : "/companies"} />}
            >
              <AppLogoTile />
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate font-heading text-[21px] font-semibold tracking-tight">
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
        <SidebarTrigger
          className="text-muted-foreground max-md:hidden"
          aria-label="Ocultar el menú"
        />
      </SidebarFooter>
    </Sidebar>
  );
}
