"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Shell } from "@/components/shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, Thread } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { POLL_MS, STATE_LABEL } from "@/lib/utils";

export default function ThreadsPage() {
  return (
    <Shell>
      <ThreadList />
    </Shell>
  );
}

function ThreadList() {
  const { token } = useAuth();
  const query = useQuery({
    queryKey: ["threads"],
    enabled: Boolean(token),
    refetchInterval: POLL_MS,
    queryFn: () => api<{ threads: (Thread & { preview: string })[] }>("/internal/threads", token!),
  });

  const threads = query.data?.threads ?? [];
  const stats = [
    { label: "En calificación", value: threads.filter((thread) => thread.state === "Qualify").length },
    { label: "Derivados", value: threads.filter((thread) => thread.state === "Handoff").length },
    { label: "Pausados", value: threads.filter((thread) => thread.paused).length },
    { label: "Esperan un asesor", value: threads.filter((thread) => thread.needsHuman).length },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader>
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums">{query.data ? stat.value : "—"}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Conversaciones</CardTitle>
          <CardDescription>La lista se actualiza sola.</CardDescription>
        </CardHeader>
        <CardContent>
          {query.isError ? <p className="text-sm text-destructive">No se pudo cargar la lista.</p> : null}
          {query.data?.threads.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay conversaciones.</p>
          ) : null}
          <ul className="divide-y">
            {threads.map((thread) => (
              <li key={thread.id}>
                <Link
                  href={`/threads/${thread.id}`}
                  className="flex flex-col gap-2 rounded-lg px-2 py-3 hover:bg-muted/60 sm:flex-row sm:items-start sm:justify-between"
                >
                  <span className="min-w-0">
                    <span className="block font-medium">{thread.phone}</span>
                    <span className="block truncate text-sm text-muted-foreground">{thread.preview || "Sin mensajes"}</span>
                  </span>
                  <span className="flex flex-wrap gap-2">
                    <Badge variant="outline">{STATE_LABEL[thread.state] ?? thread.state}</Badge>
                    {thread.paused ? <Badge variant="secondary">Pausado</Badge> : null}
                    {thread.needsHuman ? <Badge variant="secondary">Espera asesor</Badge> : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
