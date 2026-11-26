"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { SearchField } from "@onlymoein/liquidglass";

const noSubscription = () => () => {};
const isMac = () => /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * Conversaciones' search by name or phone (the `q` param): Liquid Glass pill field that filters
 * as you type, ⌘K / Ctrl+K focuses it, and Escape clears it.
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
    <form
      role="search"
      className="relative"
      onSubmit={(event) => event.preventDefault()}
    >
      <SearchField
        ref={input}
        variant="glass"
        placeholder="Buscar por nombre o teléfono"
        aria-label="Buscar conversaciones por nombre o teléfono"
        value={value}
        onValueChange={setValue}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setValue("");
            event.currentTarget.blur();
          }
        }}
        className="ls-search-field w-full lg:pr-16"
      />
      {!value ? (
        <kbd className="pointer-events-none absolute top-1/2 right-3.5 hidden h-5 -translate-y-1/2 items-center gap-0.5 rounded-md bg-foreground/6 px-1.5 font-sans text-[11px] font-medium text-muted-foreground lg:flex dark:bg-white/10">
          {mac ? "⌘" : "Ctrl"} K
        </kbd>
      ) : null}
    </form>
  );
}
