"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  ChevronDownIcon,
  HandIcon,
  PhoneCallIcon,
  UserRoundPlusIcon,
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
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { formatDateTime, formatWaiting } from "@/lib/format";
import { useAssignees, useAssignThread, useMe } from "@/lib/queries";
import { operatorName } from "@/lib/thread-status";
import type { Thread } from "@/lib/types";
import { AssigneeLabel } from "./assignee-label";
import { StageBadge } from "./status-badge";
import { useThreadActionWithToast } from "./use-thread-action";

const UNASSIGNED = "__none__";

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-2 text-[13px]">
      <span className="text-muted-foreground">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function AssignMenu({ thread }: { thread: Thread }) {
  const assignees = useAssignees();
  const assign = useAssignThread(thread.id);
  const current = thread.assignee?.id ?? UNASSIGNED;
  const choose = (value: string) => {
    if (value === current) return;
    const operatorId = value === UNASSIGNED ? null : value;
    assign.mutate(operatorId, {
      onSuccess: ({ thread: updated }) =>
        toast.success(
          updated.assignee
            ? `Asignada a ${operatorName(updated.assignee.email)}.`
            : "La conversación quedó sin asignar.",
        ),
      onError: (error) => toast.error(error.message),
    });
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            size="sm"
            variant="outline"
            className="bg-background"
            disabled={assign.isPending}
          />
        }
      >
        {assign.isPending ? <Spinner /> : <UserRoundPlusIcon />}
        Asignar a…
        <ChevronDownIcon className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Operadores de la empresa</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={current} onValueChange={choose}>
            {(assignees.data?.assignees ?? []).map((operator) => (
              <DropdownMenuRadioItem
                key={operator.id}
                value={operator.id}
                closeOnClick
              >
                <span className="truncate">{operator.email}</span>
                {operator.me ? (
                  <span className="ml-auto pl-2 text-xs text-muted-foreground">
                    vos
                  </span>
                ) : null}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          {assignees.isPending ? (
            <div className="flex justify-center p-2">
              <Spinner />
            </div>
          ) : null}
        </DropdownMenuGroup>
        {thread.assignee ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => choose(UNASSIGNED)}>
              Quitar asignación
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Where the lead is for the sales team, who has it, and what an advisor can do next. */
export function FollowUpGroup({ thread }: { thread: Thread }) {
  const me = useMe();
  const { run, pending } = useThreadActionWithToast(thread.id);
  const [confirming, setConfirming] = useState(false);
  const canBeAssigned = me.data ? !me.data.supportAccess : false;
  const myEmail = canBeAssigned ? (me.data?.operator?.email ?? null) : null;
  const mine = Boolean(myEmail) && thread.assignee?.email === myEmail;
  const contacted = thread.stage === "contacted";

  return (
    <div className="flex flex-col gap-3 px-5 py-4">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-medium text-muted-foreground">
          Seguimiento
        </h4>
        <StageBadge stage={thread.stage} />
      </div>
      <div className="flex flex-col gap-2">
        <Row label="Asesor">
          <span className="flex items-center gap-2">
            <AssigneeLabel assignee={thread.assignee} myEmail={myEmail} />
            {thread.assignedAt ? (
              <span className="text-xs text-muted-foreground">
                desde {formatDateTime(thread.assignedAt)}
              </span>
            ) : null}
          </span>
        </Row>
        {thread.handedOffAt ? (
          <Row label="Por contactar">
            {formatDateTime(thread.handedOffAt)}
            {thread.stage === "to_contact" ? (
              <span className="text-muted-foreground">
                {" "}
                · espera desde hace {formatWaiting(thread.handedOffAt)}
              </span>
            ) : null}
          </Row>
        ) : null}
        {contacted ? (
          <Row label="Contactado">
            {formatDateTime(thread.contactedAt)}
            {thread.contactedBy ? (
              <span className="text-muted-foreground">
                {" "}
                · {operatorName(thread.contactedBy)}
              </span>
            ) : null}
          </Row>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {canBeAssigned && !mine ? (
          <Button
            size="sm"
            variant={thread.assignee ? "outline" : "default"}
            className={thread.assignee ? "bg-background" : undefined}
            onClick={() => run("take")}
            disabled={pending !== null}
          >
            {pending === "take" ? <Spinner /> : <HandIcon />}
            Tomar
          </Button>
        ) : null}
        <AssignMenu thread={thread} />
        {contacted ? null : (
          <Button
            size="sm"
            variant={mine || !canBeAssigned ? "default" : "outline"}
            className={mine || !canBeAssigned ? undefined : "bg-background"}
            onClick={() => setConfirming(true)}
            disabled={pending !== null}
          >
            {pending === "contacted" ? <Spinner /> : <PhoneCallIcon />}
            Marcar contactado
          </Button>
        )}
      </div>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Ya hablaste con este lead?</AlertDialogTitle>
            <AlertDialogDescription>
              La conversación pasa a Contactado y queda registrado quién y
              cuándo.{" "}
              {thread.assignee
                ? ""
                : canBeAssigned
                  ? "Como no tenía asesor, queda asignada a vos. "
                  : ""}
              El asistente sigue respondiendo sus preguntas sin volver a pedirle
              datos. No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              onClick={() => {
                setConfirming(false);
                run("contacted");
              }}
            >
              Marcar contactado
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
