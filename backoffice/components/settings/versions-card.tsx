"use client";

import { useState } from "react";
import {
  FileTextIcon,
  HistoryIcon,
  PhoneIcon,
  RotateCcwIcon,
  SlidersHorizontalIcon,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useRestoreSettingsVersion, useSettingsVersions } from "@/lib/queries";
import type { SettingsVersion } from "@/lib/types";
import { SettingsSection } from "./settings-layout";

type Kind = SettingsVersion["kind"];

const KIND_LABEL: Record<Kind, string> = {
  config: "Configuración",
  instructions: "Instrucciones",
  whatsappPhoneNumberId: "Número de WhatsApp",
};

const KIND_ICON: Record<Kind, LucideIcon> = {
  config: SlidersHorizontalIcon,
  instructions: FileTextIcon,
  whatsappPhoneNumberId: PhoneIcon,
};

/** How each kind reads inside a sentence. */
const KIND_PHRASE: Record<Kind, string> = {
  config: "la configuración",
  instructions: "las instrucciones",
  whatsappPhoneNumberId: "el número de WhatsApp",
};

const FILTERS: Array<{ value: Kind | "all"; label: string }> = [
  { value: "all", label: "Todo" },
  { value: "config", label: "Configuración" },
  { value: "instructions", label: "Instrucciones" },
  { value: "whatsappPhoneNumberId", label: "Número" },
];

function contentOf(version: SettingsVersion): string {
  if (version.kind === "instructions")
    return version.instructions || "(sin instrucciones)";
  if (version.kind === "whatsappPhoneNumberId")
    return version.whatsappPhoneNumberId ?? "(sin número)";
  return JSON.stringify(version.config, null, 2);
}

/** A version that no longer passes says why; a number another company took says only that. */
function restoreError(error: Error): string {
  if (!(error instanceof ApiError) || error.code !== "invalid_version")
    return error.message;
  return [error.message, ...Object.values(error.fields ?? {})].join(" ");
}

export function VersionsCard() {
  const query = useSettingsVersions();
  const restore = useRestoreSettingsVersion();
  const [filter, setFilter] = useState<Kind | "all">("all");
  const [viewing, setViewing] = useState<SettingsVersion | null>(null);
  const [confirming, setConfirming] = useState<SettingsVersion | null>(null);
  const versions = query.data?.versions ?? [];
  const byId = new Map(versions.map((version) => [version.id, version]));
  const shown =
    filter === "all"
      ? versions
      : versions.filter((version) => version.kind === filter);

  const runRestore = (version: SettingsVersion) =>
    restore.mutate(version.id, {
      onSuccess: (result) => {
        setConfirming(null);
        setViewing(null);
        toast.success(
          result.changed
            ? `Restauraste ${KIND_PHRASE[version.kind]} del ${formatDateTime(version.createdAt)}. Ya está en uso.`
            : "Esa versión ya es la que está en uso.",
        );
      },
      onError: (error) => toast.error(restoreError(error)),
    });

  return (
    <SettingsSection
      title="Historial"
      description="Cada vez que se guarda la configuración, las instrucciones o el número de WhatsApp queda una versión. Restaurar una la guarda como versión nueva; la actual queda en el historial."
    >
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((item) => (
          <Button
            key={item.value}
            size="sm"
            variant={filter === item.value ? "secondary" : "ghost"}
            className={cn(
              filter === item.value
                ? "text-foreground"
                : "text-muted-foreground",
            )}
            onClick={() => setFilter(item.value)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      {query.isError ? (
        <Alert variant="destructive">
          <AlertTitle>No se pudieron cargar las versiones</AlertTitle>
          <AlertDescription>{query.error.message}</AlertDescription>
        </Alert>
      ) : query.isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      ) : shown.length === 0 ? (
        <Empty className="rounded-xl border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HistoryIcon />
            </EmptyMedia>
            <EmptyTitle>Todavía no hay versiones</EmptyTitle>
            <EmptyDescription>
              Aparecen cuando se guarda la configuración, las instrucciones o el
              número de WhatsApp.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-xs">
          {shown.map((version) => {
            const Icon = KIND_ICON[version.kind];
            const restoredFrom = version.restoredFromId
              ? byId.get(version.restoredFromId)
              : undefined;
            return (
              <li
                key={version.id}
                className="flex items-center gap-4 px-5 py-3.5"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted/50 text-muted-foreground">
                  <Icon className="size-4" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">
                      {KIND_LABEL[version.kind]}
                    </span>
                    {version.current ? (
                      <Badge
                        variant="outline"
                        className="border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      >
                        En uso
                      </Badge>
                    ) : null}
                    {version.restoredFromId ? (
                      <span className="text-xs text-muted-foreground">
                        Restaurada
                        {restoredFrom
                          ? ` del ${formatDateTime(restoredFrom.createdAt)}`
                          : ""}
                      </span>
                    ) : null}
                  </div>
                  <p className="truncate text-[13px] text-muted-foreground">
                    <span className="tabular-nums">
                      {formatDateTime(version.createdAt)}
                    </span>
                    {" · "}
                    {version.createdByEmail ?? "Versión inicial"}
                    {version.viaSupport ? " · soporte" : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewing(version)}
                  >
                    Ver
                  </Button>
                  {version.current ? null : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirming(version)}
                    >
                      <RotateCcwIcon />
                      Restaurar
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog
        open={viewing !== null}
        onOpenChange={(open) => !open && setViewing(null)}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {viewing ? KIND_LABEL[viewing.kind] : null} ·{" "}
              {viewing ? formatDateTime(viewing.createdAt) : null}
            </DialogTitle>
            <DialogDescription>
              {viewing?.createdByEmail
                ? `Guardada por ${viewing.createdByEmail}${viewing.viaSupport ? " (soporte)" : ""}.`
                : "La que había antes de que se guardaran versiones."}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto rounded-md border bg-muted/40 p-4">
            <pre className="font-mono text-xs leading-relaxed whitespace-pre-wrap">
              {viewing ? contentOf(viewing) : null}
            </pre>
          </div>
          {viewing && !viewing.current ? (
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setConfirming(viewing)}>
                <RotateCcwIcon />
                Restaurar esta versión
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Restaurar {confirming ? KIND_PHRASE[confirming.kind] : null} del{" "}
              {confirming ? formatDateTime(confirming.createdAt) : null}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Se guarda como una versión nueva y queda en uso enseguida. Lo que
              está en uso ahora queda en el historial.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              disabled={restore.isPending}
              onClick={() => confirming && runRestore(confirming)}
            >
              {restore.isPending ? <Spinner /> : null}
              Restaurar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsSection>
  );
}
