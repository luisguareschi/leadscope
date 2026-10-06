"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function KnowledgePage() {
  return (
    <Shell>
      <Knowledge />
    </Shell>
  );
}

function Knowledge() {
  const { token } = useAuth();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["knowledge"],
    enabled: Boolean(token),
    queryFn: () => api<{ projectCount: number; lastSyncedAt: string | null }>("/internal/knowledge", token!),
  });
  const sync = useMutation({
    mutationFn: () =>
      api<{ upserted: number; lastSyncedAt: string | null }>("/internal/knowledge/sync", token!, {
        method: "POST",
        body: JSON.stringify({ siteNotes: false }),
      }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["knowledge"] }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Planilla</CardTitle>
        <p className="text-sm text-muted-foreground">
          Sincroniza la ficha comercial. En local, sin una planilla real, carga el fixture de prueba.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm">
          Proyectos: {query.data?.projectCount ?? "—"}
          <br />
          Última sincronización: {query.data?.lastSyncedAt ? new Date(query.data.lastSyncedAt).toLocaleString() : "nunca"}
        </p>
        {sync.isError ? <p className="text-sm text-destructive">La sincronización falló.</p> : null}
        <Button onClick={() => sync.mutate()} disabled={sync.isPending}>
          {sync.isPending ? "Sincronizando…" : "Sincronizar ahora"}
        </Button>
      </CardContent>
    </Card>
  );
}
