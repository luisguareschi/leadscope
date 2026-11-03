"use client";

import Link from "next/link";
import {
  BookOpenTextIcon,
  Building2Icon,
  MessagesSquareIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  SlidersHorizontalIcon,
} from "lucide-react";
import { AppLogoTile } from "@/components/app-logo";
import { NavMain } from "@/components/nav-main";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useMe, useThreadsSummary } from "@/lib/queries";
import { SupportBar } from "./support-bar";

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const me = useMe();
  const hasCompany = Boolean(me.data?.company);
  const supportAccess = me.data?.supportAccess === true;
  const summary = useThreadsSummary(hasCompany);
  const { state, isMobile, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";

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
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            {collapsed ? (
              // Collapsed: the logo tile is the way back; hovering it turns it into the expand icon.
              <SidebarMenuButton
                size="lg"
                tooltip="Expandir menú"
                aria-label="Expandir menú"
                onClick={toggleSidebar}
              >
                <span className="relative flex size-9 shrink-0 items-center justify-center">
                  <AppLogoTile className="transition-opacity group-hover/menu-button:opacity-0 group-focus-visible/menu-button:opacity-0" />
                  <PanelLeftOpenIcon className="absolute text-muted-foreground opacity-0 transition-opacity group-hover/menu-button:opacity-100 group-focus-visible/menu-button:opacity-100" />
                </span>
              </SidebarMenuButton>
            ) : (
              <>
                <SidebarMenuButton
                  size="lg"
                  className="pr-12 hover:bg-transparent active:bg-transparent"
                  render={
                    <Link href={hasCompany ? "/threads" : "/companies"} />
                  }
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
                {/* Shown while the pointer is over the sidebar. Phones use the header's sheet button. */}
                {isMobile ? null : (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Contraer menú"
                          className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-sidebar-accent"
                          onClick={toggleSidebar}
                        />
                      }
                    >
                      <PanelLeftCloseIcon />
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Contraer menú</TooltipContent>
                  </Tooltip>
                )}
              </>
            )}
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
      </SidebarFooter>
    </Sidebar>
  );
}
