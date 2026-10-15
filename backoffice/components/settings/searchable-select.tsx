"use client";

import { useMemo } from "react";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";

export type SearchableOption = {
  value: string;
  label: string;
  /** Shown on the right, and searched too (a code, a calling code, a model id). */
  detail?: string;
};

const fold = (text: string) =>
  text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

function matches(option: SearchableOption, query: string): boolean {
  const words = fold(query).trim().split(/\s+/).filter(Boolean);
  const haystack = fold(
    `${option.label} ${option.value} ${option.detail ?? ""}`,
  );
  return words.every((word) => haystack.includes(word));
}

/**
 * A select you can type into. A saved value that is not in `options` is kept as the first option,
 * so opening the form never changes what is stored.
 */
export function SearchableSelect({
  id,
  value,
  onValueChange,
  options,
  placeholder,
  invalid,
  mono,
}: {
  id: string;
  value: string;
  onValueChange: (value: string) => void;
  options: SearchableOption[];
  placeholder?: string;
  invalid?: boolean;
  mono?: boolean;
}) {
  const items = useMemo(() => {
    if (!value || options.some((option) => option.value === value))
      return options;
    return [{ value, label: value, detail: "valor guardado" }, ...options];
  }, [options, value]);
  const selected = items.find((option) => option.value === value) ?? null;

  return (
    <Combobox
      items={items}
      value={selected}
      onValueChange={(option: SearchableOption | null) => {
        if (option) onValueChange(option.value);
      }}
      itemToStringLabel={(option: SearchableOption) => option.label}
      itemToStringValue={(option: SearchableOption) => option.value}
      isItemEqualToValue={(a: SearchableOption, b: SearchableOption) =>
        a.value === b.value
      }
      filter={matches}
      autoHighlight
    >
      <ComboboxInput
        id={id}
        placeholder={placeholder ?? "Buscá…"}
        aria-invalid={invalid ? true : undefined}
        className={mono ? "w-full font-mono text-xs" : "w-full"}
      />
      <ComboboxContent>
        <ComboboxEmpty>No hay coincidencias.</ComboboxEmpty>
        <ComboboxList>
          {(option: SearchableOption) => (
            <ComboboxItem key={option.value} value={option}>
              <span className="truncate">{option.label}</span>
              {option.detail ? (
                <span className="ml-auto shrink-0 font-mono text-xs text-muted-foreground">
                  {option.detail}
                </span>
              ) : null}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
