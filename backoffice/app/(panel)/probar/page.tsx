"use client";

import { useState } from "react";
import { InfoIcon, RotateCcwIcon } from "lucide-react";
import { cn } from "cn";
import { AssistantTestChat } from "@/components/assistant-test/assistant-test-chat";
import { AssistantTestLead } from "@/components/assistant-test/assistant-test-lead";
import { useAssistantTest } from "@/components/assistant-test/assistant-test-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSettings } from "@/lib/queries";

type MobileView = "chat" | "lead";

/**
 * Probar asistente: chat with the company's assistant as a lead, on the saved settings and files,
 * with no WhatsApp number. Nothing reaches Conversaciones, WhatsApp, or HubSpot.
 */
export default function AssistantTestPage() {
  const settings = useSettings();
  const test = useAssistantTest();
  const [view, setView] = useState<MobileView>("chat");
  const config = settings.data?.config;
  const { chat } = test;

  if (settings.isError) {
    return (
      <div className="px-4 lg:px-6">
        <Alert variant="destructive">
          <AlertTitle>No se pudo cargar la configuración</AlertTitle>
          <AlertDescription>{settings.error.message}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    // Fills the panel's scroll area: each column scrolls inside itself, like a conversation.
    <div className="@container/content flex min-h-0 flex-1 flex-col gap-4 px-4 lg:px-6">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <p className="flex max-w-3xl items-start gap-2 text-[13px] leading-relaxed text-muted-foreground">
          <InfoIcon className="mt-0.5 size-4 shrink-0" />
          <span>
            Escribe como si fueras un lead que llega por WhatsApp. El asistente
            usa la configuración, las instrucciones y los archivos guardados. No
            se envía nada por WhatsApp ni a HubSpot, y la conversación no
            aparece en Conversaciones. Cada mensaje usa la clave de Anthropic de
            la empresa, como una conversación real.
          </span>
        </p>
        {chat.messages.length > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              test.reset();
              setView("chat");
            }}
            disabled={test.pending}
          >
            <RotateCcwIcon />
            Nueva conversación
          </Button>
        ) : null}
      </header>

      <Tabs
        value={view}
        onValueChange={(value) => setView(value as MobileView)}
        className="lg:hidden"
      >
        <TabsList className="w-full">
          <TabsTrigger value="chat">Conversación</TabsTrigger>
          <TabsTrigger value="lead">Lead</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* A basis taller than any screen, so the row always shrinks to the space that is left. */}
      <div className="grid min-h-0 flex-[1_1_100svh] grid-cols-1 grid-rows-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {config ? (
          <>
            <AssistantTestChat
              className={cn(view !== "chat" && "max-lg:hidden")}
              messages={
                test.sending ? [...chat.messages, test.sending] : chat.messages
              }
              pending={test.pending}
              stopped={chat.stopped}
              error={test.error}
              leadName={chat.leadName}
              onLeadNameChange={test.setLeadName}
              draft={test.draft}
              onDraftChange={test.setDraft}
              onSend={(body) => test.send(body, config.llm.historyLimit)}
              onContinue={test.resume}
              onReset={test.reset}
            />
            <AssistantTestLead
              className={cn(view !== "lead" && "max-lg:hidden")}
              config={config}
              lead={chat.lead}
              lastTurn={chat.lastTurn}
            />
          </>
        ) : (
          <>
            <Skeleton
              className={cn(
                "h-full w-full rounded-xl",
                view !== "chat" && "max-lg:hidden",
              )}
            />
            <Skeleton
              className={cn(
                "h-full w-full rounded-xl",
                view !== "lead" && "max-lg:hidden",
              )}
            />
          </>
        )}
      </div>
    </div>
  );
}
