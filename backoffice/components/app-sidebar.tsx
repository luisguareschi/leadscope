"use client";

import Link from "next/link";
import { BookOpenTextIcon, MessagesSquareIcon, RadarIcon } from "lucide-react";
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

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const me = useMe();
  const summary = useThreadsSummary();

  const items = [
    {
      title: "Conversaciones",
      url: "/threads",
      icon: <MessagesSquareIcon />,
      badge: summary.data?.needs_human || undefined,
      badgeLabel: "conversaciones que requieren un asesor",
    },
    { title: "Conocimiento", url: "/knowledge", icon: <BookOpenTextIcon /> },
  ];

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/threads" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <RadarIcon className="size-4" />
              </div>
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate text-base font-semibold">LeadScope</span>
                <span className="truncate text-xs text-muted-foreground">{me.data?.company.name ?? " "}</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={items} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser email={me.data?.operator.email ?? ""} />
      </SidebarFooter>
    </Sidebar>
  );
}
