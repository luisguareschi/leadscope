"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

export function CreateCompanyForm() {
  const create = useCreateCompany();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [operatorEmail, setOperatorEmail] = useState("");

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
          setName("");
          setSlug("");
          setSlugEdited(false);
          setOperatorEmail("");
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
    <Card className="shadow-xs">
      <CardHeader className="border-b">
        <CardTitle>Nueva empresa</CardTitle>
        <CardDescription>
          Se crea la empresa, su identificador y el primer operador. Las claves
          no se cargan acá.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="company-name">Nombre</FieldLabel>
            <Input
              id="company-name"
              required
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
              onChange={(event) => {
                setSlugEdited(true);
                setSlug(event.target.value);
              }}
              pattern="[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*"
              title="Letras, números y guiones. Por ejemplo: costa-sur"
            />
            <FieldDescription>
              Queda en minúsculas, como en la dirección del formulario. Por
              ejemplo, costa-sur.
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
              value={operatorEmail}
              onChange={(event) => setOperatorEmail(event.target.value)}
            />
            <FieldDescription>
              Tiene que ser un email nuevo. Le llega una invitación para elegir
              su contraseña; entra al panel de esta empresa y carga las claves
              en Configuración.
            </FieldDescription>
          </Field>
          <Button type="submit" disabled={create.isPending} className="w-fit">
            {create.isPending ? <Spinner /> : null}
            Crear empresa
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
