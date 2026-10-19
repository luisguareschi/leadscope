"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  EllipsisVerticalIcon,
  MailIcon,
  Trash2Icon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StatusPill } from "@/components/panel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { formatDateTime, initials } from "@/lib/format";
import { toastInvite } from "@/lib/invite";
import {
  useAddOperator,
  useDeleteOperator,
  useOperatorArchive,
  useOperators,
  useResendInvite,
} from "@/lib/queries";
import type { AuthUserRemoval, Operator } from "@/lib/types";

function StatusBadge({ operator }: { operator: Operator }) {
  if (operator.archivedAt)
    return <StatusPill tone="muted">Archivado</StatusPill>;
  if (operator.inviteError)
    return <StatusPill tone="error">Invitación fallida</StatusPill>;
  if (operator.invitedAt)
    return <StatusPill tone="pending">Invitación enviada</StatusPill>;
  if (operator.hasLogin)
    return <StatusPill tone="ok">Usuario vinculado</StatusPill>;
  return <StatusPill tone="warning">Sin invitación</StatusPill>;
}

function detailOf(operator: Operator): string | null {
  if (operator.archivedAt)
    return `No puede entrar al panel desde ${formatDateTime(operator.archivedAt)}.`;
  if (operator.inviteError) return operator.inviteError;
  if (operator.invitedAt)
    return `Último envío: ${formatDateTime(operator.invitedAt)}.`;
  if (operator.hasLogin) return "Ya tenía usuario: entra con su contraseña.";
  return "Todavía no recibió la invitación. Usá Reenviar invitación.";
}

function removalToast(email: string, removal: AuthUserRemoval) {
  switch (removal.status) {
    case "removed":
      toast.success(`Eliminaste a ${email} y su usuario de Supabase.`);
      return;
    case "kept_platform_admin":
      toast.success(
        `Eliminaste a ${email}. Su usuario de Supabase queda porque administra la plataforma.`,
      );
      return;
    case "kept_operator":
      toast.success(
        `Eliminaste a ${email}. Su usuario de Supabase queda porque sigue siendo operador.`,
      );
      return;
    case "none":
      toast.success(`Eliminaste a ${email}.`);
      return;
    case "failed":
      toast.warning(
        `Eliminaste a ${email}, pero su usuario de Supabase quedó`,
        {
          description: `${removal.message} Podés borrarlo a mano en Supabase.`,
        },
      );
  }
}

/** Add, invite, archive, and delete the operators of one company. For platform admins only. */
export function OperatorsPanel({
  companyId,
  companyName,
}: {
  companyId: string;
  companyName: string;
}) {
  const query = useOperators(companyId);
  const add = useAddOperator(companyId);
  const resend = useResendInvite(companyId);
  const archive = useOperatorArchive(companyId);
  const remove = useDeleteOperator(companyId);
  const [email, setEmail] = useState("");
  const [deleting, setDeleting] = useState<Operator | null>(null);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const value = email.trim();
    if (!value) return;
    add.mutate(value, {
      onSuccess: (result) => {
        setEmail("");
        toastInvite(result.operator.email, result.invite);
      },
      onError: (error) => toast.error(error.message),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <Field>
          <FieldLabel htmlFor={`operator-email-${companyId}`}>
            Agregar operador
          </FieldLabel>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id={`operator-email-${companyId}`}
              type="email"
              required
              autoComplete="off"
              placeholder="nombre@empresa.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Button type="submit" disabled={add.isPending || !email.trim()}>
              {add.isPending ? <Spinner /> : <UserPlusIcon />}
              Agregar e invitar
            </Button>
          </div>
          <FieldDescription>
            Le llega un email de Supabase con un enlace para elegir su
            contraseña. Si ya tenía usuario, se vincula y entra con la suya.
          </FieldDescription>
        </Field>
      </form>

      {query.isError ? (
        <Alert variant="destructive">
          <AlertTitle>No se pudieron cargar los operadores</AlertTitle>
          <AlertDescription>{query.error.message}</AlertDescription>
        </Alert>
      ) : query.isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : query.data.operators.length === 0 ? (
        <Empty className="rounded-xl border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UsersIcon />
            </EmptyMedia>
            <EmptyTitle>Sin operadores</EmptyTitle>
            <EmptyDescription>
              Nadie entra al panel de {companyName} hasta que agregues uno.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-xs">
          {query.data.operators.map((operator) => {
            const busy =
              (resend.isPending && resend.variables === operator.id) ||
              (archive.isPending &&
                archive.variables?.operatorId === operator.id);
            return (
              <li
                key={operator.id}
                className="flex items-center gap-3 px-4 py-3"
              >
                <Avatar className="size-8">
                  <AvatarFallback className="text-xs">
                    {initials(operator.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {operator.email}
                    </span>
                    <StatusBadge operator={operator} />
                    {busy ? <Spinner className="size-3.5" /> : null}
                  </div>
                  <p
                    className={
                      operator.inviteError && !operator.archivedAt
                        ? "text-xs text-destructive"
                        : "text-xs text-muted-foreground"
                    }
                  >
                    {detailOf(operator)}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Acciones para ${operator.email}`}
                      />
                    }
                  >
                    <EllipsisVerticalIcon />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-52">
                    {operator.archivedAt ? null : (
                      <DropdownMenuItem
                        onClick={() =>
                          resend.mutate(operator.id, {
                            onSuccess: (result) =>
                              toastInvite(result.operator.email, result.invite),
                            onError: (error) => toast.error(error.message),
                          })
                        }
                      >
                        <MailIcon />
                        Reenviar invitación
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() =>
                        archive.mutate(
                          {
                            operatorId: operator.id,
                            action: operator.archivedAt ? "restore" : "archive",
                          },
                          {
                            onSuccess: () =>
                              toast.success(
                                operator.archivedAt
                                  ? `${operator.email} puede volver a entrar.`
                                  : `${operator.email} ya no puede entrar al panel.`,
                              ),
                            onError: (error) => toast.error(error.message),
                          },
                        )
                      }
                    >
                      {operator.archivedAt ? (
                        <ArchiveRestoreIcon />
                      ) : (
                        <ArchiveIcon />
                      )}
                      {operator.archivedAt ? "Restaurar" : "Archivar"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setDeleting(operator)}
                    >
                      <Trash2Icon />
                      Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            );
          })}
        </ul>
      )}

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar a {deleting?.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              Deja de ser operador de {companyName}.{" "}
              {deleting?.platformAdmin
                ? "Su usuario de Supabase queda, porque administra la plataforma."
                : "También se borra su usuario de Supabase."}{" "}
              Para que pueda volver más adelante, mejor archivalo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => {
                const target = deleting;
                if (!target) return;
                remove.mutate(target.id, {
                  onSuccess: (result) => {
                    removalToast(target.email, result.authUser);
                    setDeleting(null);
                  },
                  onError: (error) => toast.error(error.message),
                });
              }}
            >
              {remove.isPending ? <Spinner /> : null}
              Eliminar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
