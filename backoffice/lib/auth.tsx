"use client";

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

const TOKEN_KEY = "leadscope.token";

type AuthValue = {
  ready: boolean;
  token: string | null;
  mode: "fake" | "supabase";
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

function supabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const mode = process.env.NEXT_PUBLIC_AUTH_MODE === "supabase" ? "supabase" : "fake";
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const client = useMemo(() => (mode === "supabase" ? supabaseClient() : null), [mode]);

  useEffect(() => {
    let active = true;
    if (mode === "fake") {
      setToken(sessionStorage.getItem(TOKEN_KEY));
      setReady(true);
      return;
    }
    if (!client) {
      setReady(true);
      return;
    }
    void client.auth.getSession().then(({ data }) => {
      if (!active) return;
      const access = data.session?.access_token ?? null;
      setToken(access);
      if (access) sessionStorage.setItem(TOKEN_KEY, access);
      setReady(true);
    });
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      const access = session?.access_token ?? null;
      setToken(access);
      if (access) sessionStorage.setItem(TOKEN_KEY, access);
      else sessionStorage.removeItem(TOKEN_KEY);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [client, mode]);

  const value: AuthValue = {
    ready,
    token,
    mode,
    async signIn(email, password) {
      if (mode === "fake") {
        const next = `fake:${email.trim()}`;
        sessionStorage.setItem(TOKEN_KEY, next);
        setToken(next);
        return;
      }
      if (!client) throw new Error("Supabase no está configurado");
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    async signOut() {
      if (client) await client.auth.signOut();
      sessionStorage.removeItem(TOKEN_KEY);
      setToken(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider missing");
  return value;
}
