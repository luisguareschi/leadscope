"use client";

import { Building2Icon, ShieldIcon } from "lucide-react";
import { CompaniesTable } from "@/components/companies/companies-table";
import { CreateCompanyForm } from "@/components/companies/create-company-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompanies, useMe } from "@/lib/queries";

export default function CompaniesPage() {
  const me = useMe();
  const isAdmin = me.data?.platformAdmin === true;
  const query = useCompanies(isAdmin);

  if (me.isPending) {
    return (
      <div className="flex flex-col gap-4 px-4 lg:px-6">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="px-4 lg:px-6">
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ShieldIcon />
            </EmptyMedia>
            <EmptyTitle>No tenés acceso a esta página</EmptyTitle>
            <EmptyDescription>
              Solo quien administra la plataforma puede ver y crear empresas.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      <Alert className="border-primary/30 bg-primary/5">
        <Building2Icon />
        <AlertTitle>Empresas de la plataforma</AlertTitle>
        <AlertDescription>
          Creá la empresa y el primer operador. Las claves las carga esa persona
          en Integraciones. Esta pantalla no abre las conversaciones de otra
          empresa.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 @4xl/main:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <CreateCompanyForm />
        <Card className="gap-0 pb-0 shadow-xs">
          <CardHeader className="border-b pb-4">
            <CardTitle>Empresas</CardTitle>
            <CardDescription>
              Las que ya existen. El nombre no abre sus conversaciones.
            </CardDescription>
          </CardHeader>
          {query.isError ? (
            <div className="p-4 lg:p-6">
              <Alert variant="destructive">
                <AlertTitle>No se pudieron cargar las empresas</AlertTitle>
                <AlertDescription>{query.error.message}</AlertDescription>
              </Alert>
            </div>
          ) : query.isPending ? (
            <div className="flex flex-col gap-2 p-4 lg:p-6">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : query.data ? (
            <CompaniesTable companies={query.data.companies} />
          ) : null}
        </Card>
      </div>
    </div>
  );
}
