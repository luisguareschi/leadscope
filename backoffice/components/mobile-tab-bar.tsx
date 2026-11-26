"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  isNavItemActive,
  isThreadDetailPath,
  useNavItems,
} from "@/lib/nav-items";
import { cn } from "cn";

/** Below `md`: the iPhone-style tab bar that replaces the sidebar. */
export function MobileTabBar() {
  const pathname = usePathname();
  const items = useNavItems();

  if (isThreadDetailPath(pathname) || items.length === 0) return null;

  return (
    <nav
      aria-label="Navegación principal"
      className="shrink-0 border-t border-border/70 bg-background/90 pt-1.5 pr-[max(0.5rem,var(--safe-right))] pb-[max(0.375rem,var(--safe-bottom))] pl-[max(0.5rem,var(--safe-left))] backdrop-blur-lg md:hidden"
    >
      <ul className="grid auto-cols-fr grid-flow-col">
        {items.map((item) => {
          const active = isNavItemActive(pathname, item.url);
          const Icon = item.icon;
          return (
            <li key={item.url} className="min-w-0">
              <Link
                href={item.url}
                aria-label={
                  item.badge
                    ? `${item.title}, ${item.badge} ${item.badgeLabel ?? ""}`
                    : item.title
                }
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 text-[11px] leading-tight font-medium text-muted-foreground transition-colors outline-none [-webkit-tap-highlight-color:transparent] focus-visible:ring-2 focus-visible:ring-ring/50 active:opacity-70",
                  active && "font-semibold text-primary",
                )}
              >
                <span
                  className={cn(
                    "relative flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                    active && "bg-primary/12",
                  )}
                >
                  <Icon aria-hidden className="size-5" />
                  {item.badge ? (
                    <span
                      aria-hidden
                      className="absolute -top-1 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-none font-semibold text-primary-foreground tabular-nums ring-2 ring-background"
                    >
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  ) : null}
                </span>
                <span className="max-w-full truncate">{item.shortTitle}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
