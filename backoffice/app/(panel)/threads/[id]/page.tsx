"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeftIcon, FileTextIcon } from "lucide-react";
import { ChatTranscript } from "@/components/threads/chat-transcript";
import { LeadDetails } from "@/components/threads/lead-details";
import { StatusBadge } from "@/components/threads/status-badge";
import { ThreadAlerts } from "@/components/threads/thread-alerts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import { formatPhone } from "@/lib/format";
import { useThread } from "@/lib/queries";

export default function ThreadPage() {
  const { id } = useParams<{ id: string }>();
  const query = useThread(id);

  const back = (
    <Button variant="ghost" size="sm" className="w-fit" nativeButton={false} render={<Link href="/threads" />}>
      <ArrowLeftIcon />
      Conversaciones
    </Button>
  );

  if (query.isError) {
    const missing = query.error instanceof ApiError && query.error.status === 404;
    return (
      <div className="flex flex-col gap-4 px-4 lg:px-6">
        {back}
        <Alert variant={missing ? "default" : "destructive"}>
          <AlertTitle>{missing ? "Esta conversación no existe" : "No se pudo cargar la conversación"}</AlertTitle>
          <AlertDescription>{missing ? "Puede que la hayan eliminado." : query.error.message}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const data = query.data;
  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      <div className="flex flex-col gap-2">
        {back}
        {data ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="text-xl font-semibold">{data.thread.name ?? formatPhone(data.thread.phone)}</h2>
            <StatusBadge thread={data.thread} />
            {data.thread.source === "form" ? (
              <Badge variant="outline" className="gap-1 text-muted-foreground">
                <FileTextIcon />
                Formulario
              </Badge>
            ) : null}
            {data.thread.name ? <span className="text-sm text-muted-foreground">{formatPhone(data.thread.phone)}</span> : null}
          </div>
        ) : (
          <Skeleton className="h-7 w-64" />
        )}
      </div>

      {data ? <ThreadAlerts thread={data.thread} /> : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="gap-0 overflow-hidden py-0 shadow-xs">
          <CardHeader className="border-b py-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Conversación</CardTitle>
          </CardHeader>
          <div className="h-[calc(100svh-17rem)] min-h-96 overflow-y-auto bg-muted/30">
            {data ? (
              <ChatTranscript messages={data.messages} />
            ) : (
              <div className="flex flex-col gap-3 p-4">
                <Skeleton className="h-12 w-2/3" />
                <Skeleton className="ml-auto h-16 w-2/3" />
                <Skeleton className="h-10 w-1/2" />
              </div>
            )}
          </div>
        </Card>
        {data ? <LeadDetails thread={data.thread} /> : <Skeleton className="h-96 w-full" />}
      </div>
    </div>
  );
}
