"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { SlidersHorizontalIcon } from "lucide-react";
import { ConfigForm } from "@/components/settings/config-form";
import { InstructionsCard } from "@/components/settings/instructions-card";
import { PlatformRulesCard } from "@/components/settings/platform-rules-card";
import { PromptPreviewCard } from "@/components/settings/prompt-preview-card";
import { VersionsCard } from "@/components/settings/versions-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMe, useSettings } from "@/lib/queries";

const TABS = [
  { value: "assistant", label: "Asistente" },
  { value: "prompt", label: "Instrucciones y prompt" },
  { value: "versions", label: "Versiones" },
] as const;
type Tab = (typeof TABS)[number]["value"];

function isTab(value: string | null): value is Tab {
  return TABS.some((tab) => tab.value === value);
}

function SettingsView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const rawTab = params.get("tab");
  const tab: Tab = isTab(rawTab) ? rawTab : "assistant";
  const me = useMe();
  const settings = useSettings();
  const data = settings.data;

  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      <Alert className="border-primary/30 bg-primary/5">
        <SlidersHorizontalIcon />
        <AlertTitle>
          Cómo trabaja el asistente de {me.data?.company?.name ?? "la empresa"}
        </AlertTitle>
        <AlertDescription>
          Lo que guardes acá se usa desde la próxima respuesta. Cada cambio
          queda como versión, con quién lo hizo y cuándo, y se puede restaurar.
        </AlertDescription>
      </Alert>

      {settings.isError ? (
        <Alert variant="destructive">
          <AlertTitle>No se pudo cargar la configuración</AlertTitle>
          <AlertDescription>{settings.error.message}</AlertDescription>
        </Alert>
      ) : null}

      <Tabs
        value={tab}
        onValueChange={(value) => {
          const next = new URLSearchParams(params);
          if (value === "assistant") next.delete("tab");
          else next.set("tab", String(value));
          const query = next.toString();
          router.replace(query ? `${pathname}?${query}` : pathname, {
            scroll: false,
          });
        }}
      >
        <TabsList>
          {TABS.map((item) => (
            <TabsTrigger key={item.value} value={item.value}>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="assistant" keepMounted className="pt-2">
          {data ? (
            <ConfigForm
              key={`${data.currentVersions.config}:${data.currentVersions.whatsappPhoneNumberId}`}
              config={data.config}
              whatsappPhoneNumberId={data.whatsappPhoneNumberId}
            />
          ) : (
            <Skeleton className="h-96 w-full rounded-xl" />
          )}
        </TabsContent>

        <TabsContent
          value="prompt"
          keepMounted
          className="flex flex-col gap-4 pt-2"
        >
          {data ? (
            <>
              <InstructionsCard
                key={data.currentVersions.instructions ?? "instructions"}
                instructions={data.instructions}
                maxChars={data.limits.instructionsMaxChars}
              />
              <PlatformRulesCard rules={data.platformRules} />
              {tab === "prompt" ? <PromptPreviewCard /> : null}
            </>
          ) : (
            <Skeleton className="h-96 w-full rounded-xl" />
          )}
        </TabsContent>

        <TabsContent value="versions" className="pt-2">
          <VersionsCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsView />
    </Suspense>
  );
}
