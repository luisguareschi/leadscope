"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const THEMES = [
  { value: "system", label: "Sistema", icon: <MonitorIcon /> },
  { value: "light", label: "Claro", icon: <SunIcon /> },
  { value: "dark", label: "Oscuro", icon: <MoonIcon /> },
] as const;

/** Must match `--background` in globals.css. */
const THEME_COLOR = { light: "#edf0f7", dark: "#02040a" } as const;

/** The theme choices, for any dropdown menu (the header's and the user menu). */
export function ThemeMenuItems() {
  const { theme, setTheme } = useTheme();
  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel>Tema</DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={theme ?? "system"}
        onValueChange={(value) => setTheme(String(value))}
      >
        {THEMES.map((option) => (
          <DropdownMenuRadioItem key={option.value} value={option.value}>
            {option.icon}
            {option.label}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </DropdownMenuGroup>
  );
}

export function ThemeToggle({ className }: { className?: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Cambiar tema"
            className={cn("text-muted-foreground", className)}
          />
        }
      >
        <SunIcon className="dark:hidden" />
        <MoonIcon className="hidden dark:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <ThemeMenuItems />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Keeps the browser, PWA chrome, and Liquid Glass `data-theme` locked to the chosen theme. */
export function ThemeColorSync() {
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    if (resolvedTheme !== "light" && resolvedTheme !== "dark") return;
    document.documentElement.dataset.theme = resolvedTheme;
    for (const meta of document.querySelectorAll<HTMLMetaElement>(
      'meta[name="theme-color"]',
    )) {
      meta.content = THEME_COLOR[resolvedTheme];
    }
  }, [resolvedTheme]);
  return null;
}
