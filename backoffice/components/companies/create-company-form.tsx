"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { toastInvite } from "@/lib/invite";
import { useCreateCompany } from "@/lib/queries";

function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function CreateCompanyDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useCreateCompany();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [operatorEmail, setOperatorEmail] = useState("");

  const reset = () => {
    setName("");
    setSlug("");
    setSlugEdited(false);
    setOperatorEmail("");
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate(
      {
        name: name.trim(),
        slug: slug.trim(),
        operatorEmail: operatorEmail.trim(),
      },
      {
        onSuccess: (result) => {
          reset();
          onOpenChange(false);
          toast.success(
            `${result.company.name} quedó creada. El operador carga las claves en Configuración.`,
          );
          const [operator] = result.company.operators;
          if (operator) toastInvite(operator.email, result.invite);
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva empresa</DialogTitle>
          <DialogDescription>
            Se crean la empresa, su identificador y el primer operador, que
            recibe la invitación por email. Las claves las carga esa persona en
            Configuración.
          </DialogDescription>
        </DialogHeader>
        <form
          id="create-company-form"
          onSubmit={onSubmit}
          className="flex flex-col gap-4"
        >
          <Field>
            <FieldLabel htmlFor="company-name">Nombre</FieldLabel>
            <Input
              id="company-name"
              required
              autoFocus
              maxLength={80}
              value={name}
              onChange={(event) => {
                const next = event.target.value;
                setName(next);
                if (!slugEdited) setSlug(slugify(next));
              }}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="company-slug">Identificador</FieldLabel>
            <Input
              id="company-slug"
              required
              maxLength={48}
              spellCheck={false}
              value={slug}
              className="font-mono text-xs md:text-xs"
              onChange={(event) => {
                setSlugEdited(true);
                setSlug(event.target.value);
              }}
              pattern="[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*"
              title="Letras, números y guiones. Por ejemplo: costa-sur"
            />
            <FieldDescription>
              En minúsculas, como en la dirección del formulario. Por ejemplo,
              costa-sur.
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="company-operator">
              Email del primer operador
            </FieldLabel>
            <Input
              id="company-operator"
              type="email"
              required
              autoComplete="off"
              placeholder="nombre@empresa.com"
              value={operatorEmail}
              onChange={(event) => setOperatorEmail(event.target.value)}
            />
            <FieldDescription>
              Un email nuevo: le llega un enlace para elegir su contraseña.
            </FieldDescription>
          </Field>
        </form>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="create-company-form"
            disabled={create.isPending}
          >
            {create.isPending ? <Spinner /> : null}
            Crear empresa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
