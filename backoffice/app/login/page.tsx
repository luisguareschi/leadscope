"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AuthCard } from "@/components/auth-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const { mode, status, signIn, requestPasswordReset } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (status === "signed_in") router.replace("/threads");
  }, [status, router]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo entrar.");
    } finally {
      setPending(false);
    }
  }

  async function onForgotPassword() {
    if (!email) {
      setError("Escribí tu email y volvé a tocar el enlace.");
      return;
    }
    try {
      await requestPasswordReset(email);
      toast.success("Te enviamos un email para elegir una contraseña nueva.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo enviar el email.");
    }
  }

  return (
    <AuthCard title="Entrá al panel" description="Conversaciones del asistente de WhatsApp.">
      <form onSubmit={onSubmit}>
        <FieldGroup>
          {mode === "dev" ? (
            <Alert>
              <AlertDescription>
                Modo desarrollo: entrá con el email de un operador, sin contraseña (por ejemplo operador@example.com).
              </AlertDescription>
            </Alert>
          ) : null}
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>
          {mode === "supabase" ? (
            <Field>
              <div className="flex items-center">
                <FieldLabel htmlFor="password">Contraseña</FieldLabel>
                <button
                  type="button"
                  onClick={onForgotPassword}
                  className="ml-auto text-sm text-muted-foreground underline-offset-4 hover:underline"
                >
                  ¿La olvidaste?
                </button>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? <Spinner /> : null}
            Entrar
          </Button>
        </FieldGroup>
      </form>
    </AuthCard>
  );
}
