"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { AuthCard } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/lib/auth";

/** Where Supabase invitation and password-reset emails land. The link itself signs the operator in. */
export default function SetPasswordPage() {
  const { status, updatePassword } = useAuth();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      setError("Usá al menos 8 caracteres.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await updatePassword(password);
      toast.success("Contraseña guardada.");
      router.replace("/threads");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar la contraseña.");
    } finally {
      setPending(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    );
  }

  if (status === "signed_out") {
    return (
      <AuthCard title="El enlace venció" description="Pedí uno nuevo desde la pantalla de ingreso.">
        <Button className="w-full" onClick={() => router.replace("/login")}>
          Ir al ingreso
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Elegí tu contraseña" description="La vas a usar para entrar al panel.">
      <form onSubmit={onSubmit}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="password">Contraseña nueva</FieldLabel>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <FieldDescription>Al menos 8 caracteres.</FieldDescription>
          </Field>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? <Spinner /> : null}
            Guardar y entrar
          </Button>
        </FieldGroup>
      </form>
    </AuthCard>
  );
}
