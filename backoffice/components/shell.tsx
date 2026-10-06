"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export function Shell({ children }: { children: React.ReactNode }) {
  const { ready, token, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (ready && !token) router.replace("/login");
  }, [ready, token, router]);

  if (!ready || !token) return <p className="p-8 text-sm text-muted-foreground">Cargando…</p>;

  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <span className="text-sm font-semibold">LeadScope</span>
          <nav className="flex gap-4 text-sm">
            <Link className={pathname.startsWith("/threads") ? "font-medium" : "text-muted-foreground"} href="/threads">
              Conversaciones
            </Link>
            <Link className={pathname.startsWith("/knowledge") ? "font-medium" : "text-muted-foreground"} href="/knowledge">
              Conocimiento
            </Link>
          </nav>
          <Button className="sm:ml-auto" variant="outline" size="sm" onClick={() => void signOut().then(() => router.push("/login"))}>
            Salir
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
