"use client"

import Link from "next/link"
import { BookOpenIcon, MessagesSquareIcon } from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useAuth } from "@/lib/auth"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { token } = useAuth()
  const email = token?.startsWith("fake:") ? token.slice(5) : "operador@example.com"

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:p-1.5!">
              <Link href="/threads">
                <MessagesSquareIcon className="size-5!" />
                <span className="text-base font-semibold">LeadScope</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain
          items={[
            {
              title: "Conversaciones",
              url: "/threads",
              icon: <MessagesSquareIcon />,
            },
            {
              title: "Conocimiento",
              url: "/knowledge",
              icon: <BookOpenIcon />,
            },
          ]}
        />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={{ name: "Operador", email }} />
      </SidebarFooter>
    </Sidebar>
  )
}
