"use client";

import { useState } from "react";
import Link from "next/link";
import { Button as LiquidButton } from "@onlymoein/liquidglass";
import { FlaskConicalIcon, InfoIcon, RotateCcwIcon } from "lucide-react";
import { cn } from "cn";
import { AssistantTestChat } from "@/components/assistant-test/assistant-test-chat";
import { AssistantTestLead } from "@/components/assistant-test/assistant-test-lead";
import { useAssistantTest } from "@/components/assistant-test/assistant-test-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { LiquidSegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { useSettings } from "@/lib/queries";

type MobileView = "chat" | "lead";

/**
 * Probar asistente: chat with the company's assistant as a lead, on the saved settings and files
 * (or an unsaved draft from Configuración), with no WhatsApp number. Nothing reaches
 * Conversaciones, WhatsApp, or HubSpot.
 */
export default function AssistantTestPage() {
  const settings = useSettings();
  const test = useAssistantTest();
  const [view, setView] = useState<MobileView>("chat");
  const savedConfig = settings.data?.config;
  const config = test.settingsDraft?.config ?? savedConfig;
  const { chat } = test;
  const draftParts: string[] = [];
  if (
    test.settingsDraft?.config ||
    test.settingsDraft?.companyName !== undefined
  ) {
    draftParts.push("Configuración");
  }
  if (test.settingsDraft?.instructions !== undefined) {
    draftParts.push("Instrucciones");
  }

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
    <div className="@container/content flex min-h-0 flex-1 flex-col gap-2.5 px-4 lg:gap-4 lg:px-6">
      <header className="flex min-h-8 flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <InfoIcon className="size-4 shrink-0" />
          Simula una conversación como si fueras un lead.
        </p>
        {chat.messages.length > 0 ? (
          <LiquidButton
            type="button"
            variant="glass"
            size="small"
            icon={<RotateCcwIcon className="size-3.5" />}
            className="!h-9 !px-3.5 !text-[13px] !font-semibold"
            onClick={() => {
              test.reset();
              setView("chat");
            }}
            disabled={test.pending}
          >
            Nueva conversación
          </LiquidButton>
        ) : null}
      </header>

      {draftParts.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-primary/10 px-4 py-2.5 text-[13px] ring-1 ring-primary/20">
          <div className="flex items-center gap-2">
            <FlaskConicalIcon className="size-4 shrink-0 text-primary" />
            <span>
              Probando borrador sin guardar ({draftParts.join(" e ")}). Todavía
              no afecta a leads reales.
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={test.clearSettingsDraft}
            >
              Usar versión guardada
            </Button>
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={
                <Link
                  href={
                    draftParts.length === 1 && draftParts[0] === "Instrucciones"
                      ? "/settings?tab=instructions"
                      : "/settings"
                  }
                />
              }
            >
              Volver a Configuración
            </Button>
          </div>
        </div>
      ) : null}

      <div className="lg:hidden">
        <LiquidSegmentedControl
          aria-label="Vista de prueba"
          value={view}
          onValueChange={(value) => setView(value as MobileView)}
          className="w-full"
          items={[
            { value: "chat", label: "Conversación" },
            { value: "lead", label: "Lead" },
          ]}
        />
      </div>

      {/* Below md the shell is exactly one screen, so the row takes what is left above the tab
          bar. From md a basis taller than any screen, so it always shrinks to the space left. */}
      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)] gap-2.5 md:flex-[1_1_100svh] lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-4">
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
