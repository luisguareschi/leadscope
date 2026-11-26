"use client";

import {
  BookOpenTextIcon,
  Building2Icon,
  ChartColumnIcon,
  FlaskConicalIcon,
  MessagesSquareIcon,
  SlidersHorizontalIcon,
  type LucideIcon,
} from "lucide-react";
import { useMe, useThreadsSummary } from "@/lib/queries";

/** A panel page, shown in the desktop sidebar and the phone tab bar. */
export type NavItem = {
  /** The full name: sidebar label, page title and screen-reader name. */
  title: string;
  /** One word for the phone tab bar, short enough for five tabs on a 375px screen. */
  shortTitle: string;
  url: string;
  icon: LucideIcon;
  badge?: number;
  badgeLabel?: string;
};

const METRICS: NavItem = {
  title: "Métricas",
  shortTitle: "Métricas",
  url: "/metrics",
  icon: ChartColumnIcon,
};

export function buildNavItems({
  hasCompany,
  platformAdmin,
  unassignedToContact,
}: {
  hasCompany: boolean;
  platformAdmin: boolean;
  unassignedToContact?: number;
}): NavItem[] {
  const items: NavItem[] = [];
  if (hasCompany) {
    items.push(
      {
        title: "Conversaciones",
        shortTitle: "Chats",
        url: "/threads",
        icon: MessagesSquareIcon,
        badge: unassignedToContact || undefined,
        badgeLabel: "leads por contactar sin asesor",
      },
      METRICS,
      {
        title: "Conocimiento",
        shortTitle: "Archivos",
        url: "/knowledge",
        icon: BookOpenTextIcon,
      },
      {
        title: "Probar asistente",
        shortTitle: "Probar",
        url: "/probar",
        icon: FlaskConicalIcon,
      },
      {
        title: "Configuración",
        shortTitle: "Ajustes",
        url: "/settings",
        icon: SlidersHorizontalIcon,
      },
    );
  }
  if (platformAdmin) {
    if (!hasCompany) items.push(METRICS);
    items.push({
      title: "Empresas",
      shortTitle: "Empresas",
      url: "/companies",
      icon: Building2Icon,
    });
  }
  return items;
}

/** The signed-in person's pages, with the Por contactar badge. */
export function useNavItems(): NavItem[] {
  const me = useMe();
  const hasCompany = Boolean(me.data?.company);
  const summary = useThreadsSummary(hasCompany);
  return buildNavItems({
    hasCompany,
    platformAdmin: me.data?.platformAdmin === true,
    unassignedToContact: summary.data?.unassignedToContact,
  });
}

export function isNavItemActive(pathname: string, url: string): boolean {
  return pathname === url || pathname.startsWith(`${url}/`);
}

/** `/threads/<id>`: below `lg` the thread page draws its own header and has no tab bar. */
export function isThreadDetailPath(pathname: string): boolean {
  return /^\/threads\/[^/]+$/.test(pathname);
}
