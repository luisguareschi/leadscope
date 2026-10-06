"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Shell } from "@/components/shell";
import { Badge } from "@/components/ui/badge";
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

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Conversaciones</h1>
      {query.isError ? <p className="text-sm text-destructive">No se pudo cargar la lista.</p> : null}
      {query.data?.threads.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay conversaciones.</p>
      ) : null}
      <ul className="divide-y rounded-lg border">
        {query.data?.threads.map((thread) => (
          <li key={thread.id}>
            <Link href={`/threads/${thread.id}`} className="flex flex-col gap-2 px-4 py-3 hover:bg-muted/60 sm:flex-row sm:items-start sm:justify-between">
              <span className="min-w-0">
                <span className="block font-medium">{thread.phone}</span>
                <span className="block truncate text-sm text-muted-foreground">{thread.preview || "Sin mensajes"}</span>
              </span>
              <span className="flex flex-wrap gap-2">
                <Badge>{STATE_LABEL[thread.state] ?? thread.state}</Badge>
                {thread.paused ? <Badge>Pausado</Badge> : null}
                {thread.needsHuman ? <Badge>Espera asesor</Badge> : null}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
