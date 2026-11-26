"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TabBar, type TabBarItem } from "@onlymoein/liquidglass";
import {
  isNavItemActive,
  isThreadDetailPath,
  useNavItems,
} from "@/lib/nav-items";

/**
 * Below `md`: floating iOS 27 Liquid Glass tab bar that hovers over scrolling content
 * (capped at 5 tabs; platform admins reach Empresas from the header switcher).
 */
export function MobileTabBar() {
  const pathname = usePathname();
  const allItems = useNavItems();
  const items =
    allItems.length > 5
      ? allItems.filter((item) => item.url !== "/companies")
      : allItems;

  if (isThreadDetailPath(pathname) || items.length === 0) return null;

  const active =
    items.find((item) => isNavItemActive(pathname, item.url))?.url ?? null;

  const tabItems: TabBarItem[] = items.map((item) => {
    const Icon = item.icon;
    return {
      value: item.url,
      label: item.shortTitle,
      href: item.url,
      icon: (
        <span className="relative flex size-full items-center justify-center">
          <Icon aria-hidden className="size-[21px] stroke-[1.9]" />
          {item.badge ? (
            <span
              aria-hidden
              className="absolute -top-1 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9.5px] leading-none font-bold text-primary-foreground tabular-nums shadow-xs"
            >
              {item.badge > 99 ? "99+" : item.badge}
            </span>
          ) : null}
        </span>
      ),
    };
  });

  // Fit up to 5 tabs cleanly on a 375px iPhone without clipping the glass capsule.
  const tabWidth = `min(76px, calc((100vw - 44px) / ${items.length}))`;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[max(0.75rem,calc(var(--safe-bottom)-0.75rem))] z-30 flex justify-center px-3 md:hidden">
      <TabBar
        aria-label="Navegación principal"
        items={tabItems}
        value={active}
        link={Link}
        className="ls-mobile-tabs pointer-events-auto"
        style={{ "--lg-tab-width": tabWidth } as CSSProperties}
      />
    </div>
  );
}
