"use client";

import { useState } from "react";
import { EyeIcon, HistoryIcon, RotateCcwIcon } from "lucide-react";
import { toast } from "sonner";
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
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiError } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useRestoreSettingsVersion, useSettingsVersions } from "@/lib/queries";
import type { SettingsVersion } from "@/lib/types";

const KIND_LABEL: Record<SettingsVersion["kind"], string> = {
  config: "Configuración",
  instructions: "Instrucciones",
  whatsappPhoneNumberId: "Número de WhatsApp",
};

/** How each kind reads inside a sentence. */
const KIND_PHRASE: Record<SettingsVersion["kind"], string> = {
  config: "la configuración",
  instructions: "las instrucciones",
  whatsappPhoneNumberId: "el número de WhatsApp",
};

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
  const [viewing, setViewing] = useState<SettingsVersion | null>(null);
  const [confirming, setConfirming] = useState<SettingsVersion | null>(null);
  const versions = query.data?.versions ?? [];
  const byId = new Map(versions.map((version) => [version.id, version]));

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
    <>
      <Card className="gap-0 pb-0 shadow-xs">
        <CardHeader className="border-b pb-4">
          <CardTitle>Versiones</CardTitle>
          <CardDescription>
            Cada vez que se guarda la configuración, las instrucciones o el
            número de WhatsApp queda una versión. Restaurar una la vuelve a
            guardar como versión nueva; la que está en uso queda en el
            historial.
          </CardDescription>
        </CardHeader>
        {query.isError ? (
          <div className="p-4 lg:p-6">
            <Alert variant="destructive">
              <AlertTitle>No se pudieron cargar las versiones</AlertTitle>
              <AlertDescription>{query.error.message}</AlertDescription>
            </Alert>
          </div>
        ) : query.isPending ? (
          <div className="flex flex-col gap-2 p-4 lg:p-6">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : versions.length === 0 ? (
          <Empty className="border-0">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HistoryIcon />
              </EmptyMedia>
              <EmptyTitle>Todavía no hay versiones</EmptyTitle>
              <EmptyDescription>
                Aparecen cuando se guarda la configuración, las instrucciones o
                el número de WhatsApp.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4 lg:pl-6">Fecha</TableHead>
                <TableHead>Qué</TableHead>
                <TableHead className="hidden md:table-cell">Quién</TableHead>
                <TableHead className="pr-4 text-right lg:pr-6">
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {versions.map((version) => {
                const restoredFrom = version.restoredFromId
                  ? byId.get(version.restoredFromId)
                  : undefined;
                return (
                  <TableRow key={version.id}>
                    <TableCell className="pl-4 tabular-nums lg:pl-6">
                      {formatDateTime(version.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">
                          {KIND_LABEL[version.kind]}
                        </Badge>
                        {version.restoredFromId ? (
                          <span className="text-xs text-muted-foreground">
                            Restaurada
                            {restoredFrom
                              ? ` del ${formatDateTime(restoredFrom.createdAt)}`
                              : ""}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={
                            version.createdByEmail
                              ? undefined
                              : "text-muted-foreground"
                          }
                        >
                          {version.createdByEmail ?? "Versión inicial"}
                        </span>
                        {version.viaSupport ? (
                          <Badge variant="secondary">Soporte</Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="pr-4 lg:pr-6">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewing(version)}
                        >
                          <EyeIcon />
                          Ver
                        </Button>
                        {version.current ? (
                          <Badge className="bg-green-600 text-white">
                            En uso
                          </Badge>
                        ) : (
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
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

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
    </>
  );
}
