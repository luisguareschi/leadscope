"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  Building2Icon,
  EllipsisVerticalIcon,
  LogInIcon,
  Trash2Icon,
  UsersIcon,
} from "lucide-react";
import { cn } from "cn";
import { DeleteCompanyDialog } from "@/components/companies/delete-company-dialog";
import { OperatorsPanel } from "@/components/operators/operators-panel";
import { StatusPill } from "@/components/panel";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth";
import { formatDate, initials } from "@/lib/format";
import { useCompanyAction } from "@/lib/queries";
import { enterCompany } from "@/lib/support";
import type { CompanySummary } from "@/lib/types";

function operatorsLabel(company: CompanySummary): string {
  if (company.operators.length === 0) return "—";
  return company.operators
    .map((operator) =>
      operator.archived ? `${operator.email} (archivado)` : operator.email,
    )
    .join(", ");
}

export function CompaniesTable({
  companies,
  showingArchived,
  onCreate,
}: {
  companies: CompanySummary[];
  showingArchived: boolean;
  onCreate: () => void;
}) {
  const { email } = useAuth();
  const action = useCompanyAction();
  const [managing, setManaging] = useState<CompanySummary | null>(null);
  const [deleting, setDeleting] = useState<CompanySummary | null>(null);

  if (companies.length === 0) {
    return (
      <Empty className="border-0">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Building2Icon />
          </EmptyMedia>
          <EmptyTitle>
            {showingArchived ? "No hay empresas" : "No hay empresas activas"}
          </EmptyTitle>
          <EmptyDescription>
            {showingArchived
              ? "Creá la primera: quedan la empresa y su operador, que recibe la invitación."
              : "Creá una, o mostrá las archivadas para restaurar una."}
          </EmptyDescription>
        </EmptyHeader>
        <Button size="sm" onClick={onCreate}>
          Nueva empresa
        </Button>
      </Empty>
    );
  }

  const toggleArchive = (company: CompanySummary) => {
    const restoring = company.archivedAt !== null;
    action.mutate(
      { companyId: company.id, action: restoring ? "restore" : "archive" },
      {
        onSuccess: () =>
          toast.success(
            restoring
              ? `${company.name} volvió: sus operadores entran y el asistente responde.`
              : `${company.name} quedó archivada: sus operadores no entran y el asistente no responde.`,
          ),
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <>
      <ul className="divide-y">
        {companies.map((company) => {
          const archived = company.archivedAt !== null;
          const active = company.operators.filter((item) => !item.archived);
          return (
            <li
              key={company.id}
              className={cn(
                "grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-x-3 px-5 py-3 @3xl/content:grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,16rem)_9rem_auto] @3xl/content:gap-x-5",
                archived && "bg-muted/30",
              )}
            >
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-lg border bg-muted/40 text-xs font-medium",
                  archived && "text-muted-foreground",
                )}
              >
                {initials(company.name)}
              </span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={cn(
                      "truncate text-sm font-medium",
                      archived && "text-muted-foreground",
                    )}
                  >
                    {company.name}
                  </span>
                  {archived ? (
                    <StatusPill tone="muted">Archivada</StatusPill>
                  ) : null}
                </div>
                <span className="truncate font-mono text-xs text-muted-foreground">
                  {company.slug}
                </span>
              </div>
              <div className="hidden min-w-0 flex-col gap-0.5 @3xl/content:flex">
                <span className="text-sm tabular-nums">
                  {active.length === 1
                    ? "1 operador"
                    : `${active.length} operadores`}
                </span>
                <span
                  className="truncate text-xs text-muted-foreground"
                  title={operatorsLabel(company)}
                >
                  {operatorsLabel(company)}
                </span>
              </div>
              <span className="hidden text-right text-xs text-muted-foreground tabular-nums @3xl/content:block">
                Creada el
                <span className="block text-sm text-foreground">
                  {formatDate(company.createdAt)}
                </span>
              </span>
              <div className="flex items-center justify-end gap-1">
                {archived ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={action.isPending}
                    onClick={() => toggleArchive(company)}
                  >
                    <ArchiveRestoreIcon />
                    Restaurar
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!email}
                    onClick={() => {
                      if (email) enterCompany(company.id, email);
                    }}
                    aria-label={`Entrar a ${company.name}`}
                  >
                    <LogInIcon />
                    Entrar
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Más acciones para ${company.name}`}
                      />
                    }
                  >
                    <EllipsisVerticalIcon />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-48">
                    <DropdownMenuItem onClick={() => setManaging(company)}>
                      <UsersIcon />
                      Operadores
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toggleArchive(company)}>
                      {archived ? <ArchiveRestoreIcon /> : <ArchiveIcon />}
                      {archived ? "Restaurar" : "Archivar"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setDeleting(company)}
                    >
                      <Trash2Icon />
                      Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </li>
          );
        })}
      </ul>

      <Sheet
        open={managing !== null}
        onOpenChange={(open) => !open && setManaging(null)}
      >
        <SheetContent className="w-full overflow-y-auto data-[side=right]:sm:max-w-lg">
          <SheetHeader className="border-b">
            <SheetTitle>Operadores de {managing?.name}</SheetTitle>
            <SheetDescription>
              Quienes entran al panel de esta empresa. Archivar corta el acceso
              y se puede deshacer.
            </SheetDescription>
          </SheetHeader>
          <div className="px-5 pt-1 pb-6">
            {managing ? (
              <OperatorsPanel
                companyId={managing.id}
                companyName={managing.name}
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      <DeleteCompanyDialog
        company={deleting}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
