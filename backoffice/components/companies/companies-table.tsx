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
import { DeleteCompanyDialog } from "@/components/companies/delete-company-dialog";
import { OperatorsPanel } from "@/components/operators/operators-panel";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
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
}: {
  companies: CompanySummary[];
  showingArchived: boolean;
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
              ? "Creá la primera con el formulario. Quedan la empresa y su operador."
              : "Creá una con el formulario, o mostrá las archivadas para restaurar una."}
          </EmptyDescription>
        </EmptyHeader>
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
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4 lg:pl-6">Empresa</TableHead>
            <TableHead>Identificador</TableHead>
            <TableHead className="hidden sm:table-cell">Operadores</TableHead>
            <TableHead className="hidden text-right md:table-cell">
              Creada
            </TableHead>
            <TableHead className="w-36 pr-4 lg:pr-6">
              <span className="sr-only">Acciones</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {companies.map((company) => {
            const archived = company.archivedAt !== null;
            return (
              <TableRow
                key={company.id}
                className={archived ? "bg-muted/40" : undefined}
              >
                <TableCell className="pl-4 font-medium lg:pl-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={archived ? "text-muted-foreground" : ""}>
                      {company.name}
                    </span>
                    {archived ? (
                      <Badge variant="outline">Archivada</Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {company.slug}
                </TableCell>
                <TableCell className="hidden max-w-72 truncate sm:table-cell">
                  {operatorsLabel(company)}
                </TableCell>
                <TableCell className="hidden text-right text-muted-foreground md:table-cell">
                  {formatDateTime(company.createdAt)}
                </TableCell>
                <TableCell className="pr-4 lg:pr-6">
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
                        <DropdownMenuItem
                          onClick={() => toggleArchive(company)}
                        >
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
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

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
          <div className="px-4 pb-6">
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
