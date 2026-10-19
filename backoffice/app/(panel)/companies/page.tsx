"use client";

import { useState } from "react";
import { PlusIcon, ShieldIcon } from "lucide-react";
import { CompaniesTable } from "@/components/companies/companies-table";
import { CreateCompanyDialog } from "@/components/companies/create-company-form";
import { Panel, Section } from "@/components/panel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useCompanies, useMe } from "@/lib/queries";

export default function CompaniesPage() {
  const me = useMe();
  const isAdmin = me.data?.platformAdmin === true;
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const query = useCompanies(isAdmin, showArchived ? "all" : "active");

  if (me.isPending) {
    return (
      <div className="flex flex-col gap-4 px-4 lg:px-6">
        <Skeleton className="h-12 w-96" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="px-4 lg:px-6">
        <Empty className="rounded-xl border">
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
    <div className="@container/content flex flex-col gap-4 px-4 lg:px-6">
      <Section
        title="Empresas de la plataforma"
        description="Cada empresa tiene su panel, sus operadores y sus claves. Entrar abre su panel como administrador; lo que cambies ahí o acá queda registrado."
        actions={
          <>
            <div className="flex items-center gap-2 px-2">
              <Switch
                id="companies-show-archived"
                checked={showArchived}
                onCheckedChange={setShowArchived}
              />
              <Label
                htmlFor="companies-show-archived"
                className="font-normal whitespace-nowrap text-muted-foreground"
              >
                Mostrar archivadas
              </Label>
            </div>
            <Button onClick={() => setCreating(true)}>
              <PlusIcon />
              Nueva empresa
            </Button>
          </>
        }
      >
        {query.isError ? (
          <Alert variant="destructive">
            <AlertTitle>No se pudieron cargar las empresas</AlertTitle>
            <AlertDescription>{query.error.message}</AlertDescription>
          </Alert>
        ) : (
          <Panel>
            {query.isPending ? (
              <div className="flex flex-col gap-2 p-5">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : query.data ? (
              <CompaniesTable
                companies={query.data.companies}
                showingArchived={showArchived}
                onCreate={() => setCreating(true)}
              />
            ) : null}
          </Panel>
        )}
      </Section>

      <CreateCompanyDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}
