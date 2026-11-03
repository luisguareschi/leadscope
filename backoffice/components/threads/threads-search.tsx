"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { SearchIcon } from "lucide-react";
import { cn } from "cn";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";

const noSubscription = () => () => {};
const isMac = () => /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * The header's search, Revolut-style: it is the Conversaciones search (the `q` param).
 * On Conversaciones it filters as you type; elsewhere Enter opens Conversaciones with it.
 */
export function HeaderSearch({ className }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const onThreads = pathname === "/threads";
  const search = onThreads ? (params.get("q") ?? "") : "";
  const [value, setValue] = useState(search);
  const [synced, setSynced] = useState(search);
  const mac = useSyncExternalStore(noSubscription, isMac, () => false);
  const input = useRef<HTMLInputElement>(null);

  // The URL changed elsewhere (a filter, Conversaciones' own search, leaving the page).
  if (synced !== search) {
    setSynced(search);
    if (value.trim() !== search) setValue(search);
  }

  useEffect(() => {
    if (!onThreads) return;
    const timer = setTimeout(() => {
      const next = value.trim();
      if (next === search) return;
      const updated = new URLSearchParams(params);
      if (next) updated.set("q", next);
      else updated.delete("q");
      const query = updated.toString();
      router.replace(query ? `/threads?${query}` : "/threads", {
        scroll: false,
      });
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        input.current?.focus();
        input.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <form
      role="search"
      className={className}
      onSubmit={(event) => {
        event.preventDefault();
        const next = value.trim();
        if (!onThreads)
          router.push(
            next ? `/threads?q=${encodeURIComponent(next)}` : "/threads",
          );
      }}
    >
      <InputGroup className="h-9 rounded-full bg-card ring-1 ring-border/60 dark:bg-secondary dark:ring-0">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          ref={input}
          type="search"
          placeholder="Buscar conversaciones"
          aria-label="Buscar conversaciones por nombre o teléfono"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setValue("");
              event.currentTarget.blur();
            }
          }}
          className="[&::-webkit-search-cancel-button]:hidden"
        />
        <InputGroupAddon align="inline-end" className="max-lg:hidden">
          <kbd
            className={cn(
              "flex h-5 items-center gap-0.5 rounded-md bg-background/70 px-1.5 font-sans text-[11px] font-medium text-muted-foreground dark:bg-white/8",
            )}
          >
            {mac ? "⌘" : "Ctrl"} K
          </kbd>
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}
