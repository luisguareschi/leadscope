"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { SearchIcon } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";

const noSubscription = () => () => {};
const isMac = () => /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * Conversaciones' search by name or phone (the `q` param): it filters as you type,
 * ⌘K / Ctrl+K focuses it, and Escape clears it.
 */
export function ThreadsSearch({
  search,
  onSearch,
}: {
  search: string;
  onSearch: (q: string) => void;
}) {
  const [value, setValue] = useState(search);
  const [synced, setSynced] = useState(search);
  const mac = useSyncExternalStore(noSubscription, isMac, () => false);
  const input = useRef<HTMLInputElement>(null);

  // The URL changed elsewhere (back/forward, a link with ?q=).
  if (synced !== search) {
    setSynced(search);
    if (value.trim() !== search) setValue(search);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      const next = value.trim();
      if (next !== search) onSearch(next);
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
    <form role="search" onSubmit={(event) => event.preventDefault()}>
      <InputGroup className="h-10 rounded-full bg-card ring-1 ring-border/60 dark:bg-secondary dark:ring-0">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          ref={input}
          type="search"
          placeholder="Buscar por nombre o teléfono"
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
          <kbd className="flex h-5 items-center gap-0.5 rounded-md bg-background/70 px-1.5 font-sans text-[11px] font-medium text-muted-foreground dark:bg-white/8">
            {mac ? "⌘" : "Ctrl"} K
          </kbd>
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}
