"use client";

import { useState } from "react";
import { toast } from "sonner";
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
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useDeleteCompany } from "@/lib/queries";
import type { CompanySummary } from "@/lib/types";

/** Permanent. Enabled only once the slug is typed exactly; the API checks it again. */
export function DeleteCompanyDialog({
  company,
  onClose,
}: {
  company: CompanySummary | null;
  onClose: () => void;
}) {
  const remove = useDeleteCompany();
  const [typed, setTyped] = useState("");
  const matches =
    company !== null && typed.trim().toLowerCase() === company.slug;

  const close = () => {
    setTyped("");
    onClose();
  };

  return (
    <AlertDialog
      open={company !== null}
      onOpenChange={(open) => !open && close()}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            ¿Eliminar {company?.name} permanentemente?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Se eliminarán la empresa, sus operadores, conversaciones, archivos y
            configuración. Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form
          id="delete-company-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!company || !matches) return;
            remove.mutate(
              { companyId: company.id, confirmSlug: typed.trim() },
              {
                onSuccess: (result) => {
                  toast.success(`Empresa ${company.name} eliminada.`, {
                    description: result.authUsers.failed.length
                      ? `No se pudieron eliminar estas cuentas en Supabase: ${result.authUsers.failed.join(", ")}.`
                      : undefined,
                  });
                  close();
                },
                onError: (error) => toast.error(error.message),
              },
            );
          }}
        >
          <Field>
            <FieldLabel htmlFor="delete-company-slug">
              Escribe <span className="font-mono">{company?.slug}</span> para
              confirmar
            </FieldLabel>
            <Input
              id="delete-company-slug"
              autoComplete="off"
              spellCheck={false}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              className="font-mono"
            />
            <FieldDescription>
              Identificador único de la empresa.
            </FieldDescription>
          </Field>
        </form>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <Button
            type="submit"
            form="delete-company-form"
            variant="destructive"
            disabled={!matches || remove.isPending}
          >
            {remove.isPending ? <Spinner /> : null}
            Eliminar empresa
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
