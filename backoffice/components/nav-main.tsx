"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

type NavItem = {
  title: string;
  url: string;
  icon: React.ReactNode;
  badge?: number;
  badgeLabel?: string;
};

export function NavMain({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                tooltip={item.title}
                isActive={
                  pathname === item.url || pathname.startsWith(`${item.url}/`)
                }
                render={
                  <Link
                    href={item.url}
                    onClick={() => {
                      if (isMobile) setOpenMobile(false);
                    }}
                  />
                }
              >
                {item.icon}
                <span>{item.title}</span>
              </SidebarMenuButton>
              {item.badge ? (
                <SidebarMenuBadge
                  aria-label={`${item.badge} ${item.badgeLabel ?? ""}`}
                  className="bg-primary/15 text-primary"
                >
                  {item.badge}
                </SidebarMenuBadge>
              ) : null}
              {item.badge ? (
                <span
                  aria-hidden
                  className="pointer-events-none absolute top-2 left-7 hidden size-2 rounded-full bg-primary ring-2 ring-sidebar group-data-[collapsible=icon]:block"
                />
              ) : null}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
