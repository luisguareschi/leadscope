"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";

const DEV_TOKEN_KEY = "leadscope.devToken";

export type AuthMode = "dev" | "supabase";

type AuthValue = {
  mode: AuthMode;
  status: "loading" | "signed_out" | "signed_in";
  email: string | null;
  getToken(): Promise<string | null>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export const AUTH_MODE: AuthMode = process.env.NEXT_PUBLIC_AUTH_MODE === "supabase" ? "supabase" : "dev";

let supabase: SupabaseClient | null = null;

function supabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Falta configurar NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  supabase ??= createClient(url, key);
  return supabase;
}

const SUPABASE_ERRORS: Record<string, string> = {
  "Invalid login credentials": "Email o contraseña incorrectos.",
  "Email not confirmed": "Confirmá tu email antes de entrar.",
};

const DEV_TOKEN_EVENT = "leadscope:dev-token";

function subscribeDevToken(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(DEV_TOKEN_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(DEV_TOKEN_EVENT, onChange);
  };
}

function writeDevToken(token: string | null) {
  if (token) localStorage.setItem(DEV_TOKEN_KEY, token);
  else localStorage.removeItem(DEV_TOKEN_KEY);
  window.dispatchEvent(new Event(DEV_TOKEN_EVENT));
}

/** Dev sign-in lives in localStorage. `undefined` until the browser has been read (first render). */
function useDevToken(): string | null | undefined {
  return useSyncExternalStore(subscribeDevToken, () => localStorage.getItem(DEV_TOKEN_KEY), () => undefined);
}

/**
 * Operators sign in with Supabase Auth (email + password, no public signup). In development the
 * backend accepts `dev:<email>` instead, so the panel can run without a Supabase project.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const devToken = useDevToken();
  const [supabaseStatus, setSupabaseStatus] = useState<AuthValue["status"]>("loading");
  const [supabaseEmail, setSupabaseEmail] = useState<string | null>(null);

  const status: AuthValue["status"] =
    AUTH_MODE === "dev" ? (devToken === undefined ? "loading" : devToken ? "signed_in" : "signed_out") : supabaseStatus;
  const email = AUTH_MODE === "dev" ? (devToken ? devToken.slice(4) : null) : supabaseEmail;

  useEffect(() => {
    if (AUTH_MODE === "dev") return;
    const client = supabaseClient();
    void client.auth.getSession().then(({ data }) => {
      setSupabaseEmail(data.session?.user.email ?? null);
      setSupabaseStatus(data.session ? "signed_in" : "signed_out");
    });
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      setSupabaseEmail(session?.user.email ?? null);
      setSupabaseStatus(session ? "signed_in" : "signed_out");
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const getToken = useCallback(async () => {
    if (AUTH_MODE === "dev") return localStorage.getItem(DEV_TOKEN_KEY);
    const { data } = await supabaseClient().auth.getSession();
    return data.session?.access_token ?? null;
  }, []);

  const signIn = useCallback(async (rawEmail: string, password: string) => {
    const address = rawEmail.trim().toLowerCase();
    if (AUTH_MODE === "dev") {
      writeDevToken(`dev:${address}`);
      return;
    }
    const { error } = await supabaseClient().auth.signInWithPassword({ email: address, password });
    if (error) throw new Error(SUPABASE_ERRORS[error.message] ?? error.message);
  }, []);

  const signOut = useCallback(async () => {
    if (AUTH_MODE === "dev") {
      writeDevToken(null);
      return;
    }
    await supabaseClient().auth.signOut();
  }, []);

  const requestPasswordReset = useCallback(async (address: string) => {
    const { error } = await supabaseClient().auth.resetPasswordForEmail(address.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/auth/set-password`,
    });
    if (error) throw new Error(error.message);
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabaseClient().auth.updateUser({ password });
    if (error) throw new Error(error.message);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ mode: AUTH_MODE, status, email, getToken, signIn, signOut, requestPasswordReset, updatePassword }),
    [status, email, getToken, signIn, signOut, requestPasswordReset, updatePassword],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
