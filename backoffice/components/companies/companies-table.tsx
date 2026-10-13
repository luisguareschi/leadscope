"use client";

import { Building2Icon, LogInIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
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
import { enterCompany } from "@/lib/support";
import type { CompanySummary } from "@/lib/types";

export function CompaniesTable({ companies }: { companies: CompanySummary[] }) {
  const { email } = useAuth();

  if (companies.length === 0) {
    return (
      <Empty className="border-0">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Building2Icon />
          </EmptyMedia>
          <EmptyTitle>Todavía no hay empresas</EmptyTitle>
          <EmptyDescription>
            Creá la primera con el formulario. Quedan la empresa y su operador.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-4 lg:pl-6">Empresa</TableHead>
          <TableHead>Identificador</TableHead>
          <TableHead className="hidden sm:table-cell">Operadores</TableHead>
          <TableHead className="hidden text-right md:table-cell">
            Creada
          </TableHead>
          <TableHead className="w-24 pr-4 lg:pr-6">
            <span className="sr-only">Acciones</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {companies.map((company) => (
          <TableRow key={company.id}>
            <TableCell className="pl-4 font-medium lg:pl-6">
              {company.name}
            </TableCell>
            <TableCell className="font-mono text-xs text-muted-foreground">
              {company.slug}
            </TableCell>
            <TableCell className="hidden sm:table-cell">
              {company.operators.length > 0
                ? company.operators.map((operator) => operator.email).join(", ")
                : "—"}
            </TableCell>
            <TableCell className="hidden text-right text-muted-foreground md:table-cell">
              {formatDateTime(company.createdAt)}
            </TableCell>
            <TableCell className="pr-4 text-right lg:pr-6">
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
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
