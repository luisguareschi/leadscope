"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";

export default function HomePage() {
  const { ready, token } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!ready) return;
    router.replace(token ? "/threads" : "/login");
  }, [ready, token, router]);
  return <p className="p-8 text-sm text-muted-foreground">Cargando…</p>;
}
