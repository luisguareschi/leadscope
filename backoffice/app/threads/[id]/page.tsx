"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { Shell } from "@/components/shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ChatMessage, Thread } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { POLL_MS, STATE_LABEL } from "@/lib/utils";

export default function ThreadDetailPage() {
  return (
    <Shell>
      <Detail />
    </Shell>
  );
}

function Detail() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { token } = useAuth();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["thread", id],
    enabled: Boolean(token && id),
    refetchInterval: POLL_MS,
    queryFn: () => api<{ thread: Thread; messages: ChatMessage[] }>(`/internal/threads/${id}`, token!),
  });

  const mutate = useMutation({
    mutationFn: (path: string) => api(`/internal/threads/${id}/${path}`, token!, { method: "POST" }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["thread", id] });
      void client.invalidateQueries({ queryKey: ["threads"] });
    },
  });

  const thread = query.data?.thread;

  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      <Link href="/threads" className="text-sm text-muted-foreground hover:text-foreground">
        Volver
      </Link>
      {query.isError ? <p className="text-sm text-destructive">No se encontró la conversación.</p> : null}
      {thread ? (
        <>
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-xl">{thread.phone}</CardTitle>
                <Badge variant="outline">{STATE_LABEL[thread.state] ?? thread.state}</Badge>
                {thread.paused ? <Badge variant="secondary">Pausado</Badge> : null}
                {thread.needsHuman ? <Badge variant="secondary">Espera asesor</Badge> : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Interés</dt>
                  <dd>{thread.interest || "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Presupuesto</dt>
                  <dd>{thread.budget || "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Conoce los proyectos</dt>
                  <dd>{thread.knowsProjects == null ? "—" : thread.knowsProjects ? "Sí" : "No"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Llamada</dt>
                  <dd>{thread.callTime || "—"}</dd>
                </div>
              </dl>
              <div className="flex flex-wrap gap-2">
                {thread.paused ? (
                  <Button variant="outline" onClick={() => mutate.mutate("resume")} disabled={mutate.isPending}>
                    Reanudar
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => mutate.mutate("pause")} disabled={mutate.isPending}>
                    Pausar
                  </Button>
                )}
                {thread.needsHuman ? (
                  <Button variant="secondary" onClick={() => mutate.mutate("clear-needs-human")} disabled={mutate.isPending}>
                    Liberar espera de asesor
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Mensajes</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2">
                {query.data?.messages.map((message) => (
                  <li
                    key={message.id}
                    className={
                      message.direction === "out"
                        ? "ml-8 rounded-lg bg-muted px-3 py-2 text-sm"
                        : "mr-8 rounded-lg border px-3 py-2 text-sm"
                    }
                  >
                    <span className="mb-1 block text-xs text-muted-foreground">
                      {message.direction === "in" ? "Lead" : "Asistente"}
                      {message.contentType !== "text" ? ` · ${message.contentType}` : ""}
                    </span>
                    {message.body || "(sin texto)"}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
