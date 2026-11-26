"use client";

import { useMemo } from "react";
import { toast } from "sonner";
import { UserRoundXIcon } from "lucide-react";
import { cn } from "cn";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/ui/combobox";
import { Spinner } from "@/components/ui/spinner";
import { useIsMobile } from "@/hooks/use-mobile";
import { initials } from "@/lib/format";
import {
  useAssignees,
  useAssignThread,
  useMe,
  useThreadAction,
} from "@/lib/queries";
import { operatorName } from "@/lib/thread-status";
import type { Thread } from "@/lib/types";
import { PickerSheet } from "./stage-picker";

type Option =
  | { kind: "me"; value: string; label: string; email: string }
  | { kind: "operator"; value: string; label: string; email: string }
  | { kind: "none"; value: "none"; label: string };

const fold = (text: string) =>
  text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

function matches(option: Option, query: string): boolean {
  const words = fold(query).trim().split(/\s+/).filter(Boolean);
  const haystack = fold(
    `${option.label} ${"email" in option ? option.email : ""}`,
  );
  return words.every((word) => haystack.includes(word));
}

function Initials({ email, className }: { email: string; className?: string }) {
  return (
    <Avatar className={cn("size-5", className)}>
      <AvatarFallback className="text-[9px]">{initials(email)}</AvatarFallback>
    </Avatar>
  );
}

/**
 * Who has the lead, and the one control to change it (Linear-style): Asignarme first, then the
 * company's active operators, then Sin asignar. A platform admin in support access has no
 * operator row in the company, so Asignarme is not offered.
 */
export function AssigneePicker({
  thread,
  size = "default",
}: {
  thread: Thread;
  /** `compact` fits a table cell. */
  size?: "default" | "compact";
}) {
  const me = useMe();
  const assignees = useAssignees();
  const assign = useAssignThread(thread.id);
  const take = useThreadAction(thread.id);
  const canBeAssigned = me.data ? !me.data.supportAccess : false;
  const myEmail = canBeAssigned ? (me.data?.operator?.email ?? null) : null;
  const pending = assign.isPending || take.isPending;

  const options = useMemo<Option[]>(() => {
    const list = assignees.data?.assignees ?? [];
    const mine = canBeAssigned ? list.find((operator) => operator.me) : null;
    return [
      ...(mine
        ? [
            {
              kind: "me" as const,
              value: mine.id,
              label: "Asignarme",
              email: mine.email,
            },
          ]
        : []),
      ...list
        .filter((operator) => operator.id !== mine?.id)
        .map((operator) => ({
          kind: "operator" as const,
          value: operator.id,
          label: operatorName(operator.email),
          email: operator.email,
        })),
      { kind: "none" as const, value: "none" as const, label: "Sin asignar" },
    ];
  }, [assignees.data, canBeAssigned]);

  const current = thread.assignee?.id ?? "none";
  const selected = options.find((option) => option.value === current) ?? null;
  const mine = Boolean(myEmail) && thread.assignee?.email === myEmail;

  const choose = (option: Option | null) => {
    if (!option || option.value === current) return;
    const done = {
      onError: (error: Error) => toast.error(error.message),
    };
    if (option.kind === "me") {
      take.mutate("take", {
        ...done,
        onSuccess: () => toast.success("Conversación asignada a ti."),
      });
      return;
    }
    assign.mutate(option.kind === "none" ? null : option.value, {
      ...done,
      onSuccess: ({ thread: updated }) =>
        toast.success(
          updated.assignee
            ? `Asignada a ${operatorName(updated.assignee.email)}.`
            : "Conversación sin asignar.",
        ),
    });
  };

  const compact = size === "compact";
  const assignee = thread.assignee;
  const isMobile = useIsMobile();

  const label = assignee
    ? `Asignada a ${assignee.email}. Cambiar asignación`
    : "Sin asignar. Asignar";
  const button = (
    <Button
      variant={compact ? "ghost" : "outline"}
      size="sm"
      disabled={pending}
      className={cn(
        "max-w-full min-w-0 justify-start gap-1.5 font-normal",
        compact
          ? "-ml-2 h-7 px-2 max-md:-ml-2.5 max-md:h-8 max-md:px-2.5"
          : "font-medium",
      )}
    />
  );
  const value = (
    <>
      {pending ? (
        <Spinner className="size-4" />
      ) : assignee ? (
        <Initials email={assignee.email} />
      ) : (
        <UserRoundXIcon className="text-muted-foreground" />
      )}
      <span
        className={cn(
          "truncate text-[13px]",
          !assignee && "text-muted-foreground",
        )}
      >
        {assignee
          ? mine
            ? "Tú"
            : operatorName(assignee.email)
          : "Sin asignar"}
      </span>
      {assignee?.archived ? (
        <span className="shrink-0 text-[11px] text-muted-foreground">
          (archivado)
        </span>
      ) : null}
    </>
  );

  if (isMobile) {
    return (
      <PickerSheet
        title="Asignar conversación"
        options={options}
        getKey={(option) => `${option.kind}-${option.value}`}
        isSelected={(option) => option.value === current}
        filter={matches}
        renderOption={(option) => (
          <>
            {option.kind === "none" ? (
              <span className="flex size-7 shrink-0 items-center justify-center">
                <UserRoundXIcon className="size-5 text-muted-foreground" />
              </span>
            ) : (
              <Initials email={option.email} className="size-7" />
            )}
            <span className="flex min-w-0 flex-col">
              <span className="truncate">{option.label}</span>
              {option.kind === "none" ? null : (
                <span className="truncate text-xs font-normal text-muted-foreground">
                  {option.email}
                </span>
              )}
            </span>
          </>
        )}
        onSelect={choose}
        searchPlaceholder="Buscar operador…"
        emptyText={assignees.isPending ? "Cargando…" : "No hay coincidencias."}
        trigger={button}
        triggerLabel={label}
        triggerTitle={assignee?.email}
      >
        {value}
      </PickerSheet>
    );
  }

  return (
    <Combobox
      items={options}
      value={selected}
      onValueChange={choose}
      itemToStringLabel={(option: Option) => option.label}
      itemToStringValue={(option: Option) => option.value}
      isItemEqualToValue={(a: Option, b: Option) => a.value === b.value}
      filter={matches}
      autoHighlight
    >
      <ComboboxTrigger
        aria-label={label}
        title={assignee?.email}
        render={button}
      >
        {value}
      </ComboboxTrigger>
      <ComboboxContent className="w-72 min-w-72" align="start">
        <ComboboxInput showTrigger={false} placeholder="Buscar operador…" />
        <ComboboxEmpty>
          {assignees.isPending ? "Cargando…" : "No hay coincidencias."}
        </ComboboxEmpty>
        <ComboboxList>
          {(option: Option) => (
            <ComboboxItem key={`${option.kind}-${option.value}`} value={option}>
              {option.kind === "none" ? (
                <UserRoundXIcon className="text-muted-foreground" />
              ) : (
                <Initials email={option.email} />
              )}
              <span className="truncate max-lg:shrink-0">{option.label}</span>
              {option.kind === "none" ? null : (
                <span className="ml-auto truncate pl-2 text-xs text-muted-foreground">
                  {option.email}
                </span>
              )}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
