"use client";

import { Building2Icon } from "lucide-react";
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
import { formatDateTime } from "@/lib/format";
import type { CompanySummary } from "@/lib/types";

export function CompaniesTable({ companies }: { companies: CompanySummary[] }) {
  if (companies.length === 0) {
    return (
      <Empty className="border-0">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Building2Icon />
          </EmptyMedia>
          <EmptyTitle>Todavía no hay empresas</EmptyTitle>
          <EmptyDescription>
            Cuando crees una, aparece en esta lista.
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
          <TableHead className="hidden pr-4 text-right md:table-cell lg:pr-6">
            Creada
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
            <TableCell className="hidden pr-4 text-right text-muted-foreground md:table-cell lg:pr-6">
              {formatDateTime(company.createdAt)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
