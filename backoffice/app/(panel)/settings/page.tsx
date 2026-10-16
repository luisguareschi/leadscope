"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { SlidersHorizontalIcon } from "lucide-react";
import { IntegrationsSection } from "@/components/integrations/integrations-section";
import { OperatorsPanel } from "@/components/operators/operators-panel";
import { ConfigForm } from "@/components/settings/config-form";
import { InstructionsCard } from "@/components/settings/instructions-card";
import { PlatformRulesCard } from "@/components/settings/platform-rules-card";
import { PromptPreviewCard } from "@/components/settings/prompt-preview-card";
import { VersionsCard } from "@/components/settings/versions-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { useMe, useSettings } from "@/lib/queries";
import { supportCompanyIdFor } from "@/lib/support";

const TABS = [
  { value: "assistant", label: "Asistente" },
  { value: "prompt", label: "Instrucciones y prompt" },
  { value: "integrations", label: "Integraciones" },
  { value: "versions", label: "Versiones" },
  { value: "operators", label: "Operadores", supportOnly: true },
] as const;
type Tab = (typeof TABS)[number]["value"];

function isTab(value: string | null): value is Tab {
  return TABS.some((tab) => tab.value === value);
}

function SettingsView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { email } = useAuth();
  const me = useMe();
  const settings = useSettings();
  const data = settings.data;
  // Operators are managed by a platform admin, from Empresas or from here through support access.
  const supportCompanyId = me.data?.supportAccess
    ? supportCompanyIdFor(email)
    : null;
  const tabs = TABS.filter(
    (tab) => !("supportOnly" in tab) || supportCompanyId !== null,
  );
  const rawTab = params.get("tab");
  const tab: Tab =
    isTab(rawTab) && tabs.some((item) => item.value === rawTab)
      ? rawTab
      : "assistant";
  const companyName = me.data?.company?.name;

  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      <Alert className="border-primary/30 bg-primary/5">
        <SlidersHorizontalIcon />
        <AlertTitle>
          Cómo trabaja el asistente de {companyName ?? "la empresa"}
        </AlertTitle>
        <AlertDescription>
          Lo que guardes acá se usa desde la próxima respuesta. Cada cambio de
          configuración o instrucciones queda como versión, con quién lo hizo y
          cuándo, y se puede restaurar. Las claves de Integraciones no tienen
          versiones.
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
          {tabs.map((item) => (
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

        <TabsContent value="integrations" className="pt-2">
          <IntegrationsSection companyName={companyName} />
        </TabsContent>

        <TabsContent value="versions" className="pt-2">
          <VersionsCard />
        </TabsContent>

        {supportCompanyId ? (
          <TabsContent value="operators" className="pt-2">
            <Card className="shadow-xs">
              <CardHeader className="border-b">
                <CardTitle>Operadores</CardTitle>
                <CardDescription>
                  Quienes entran al panel de {companyName ?? "esta empresa"}.
                  Solo lo ve quien administra la plataforma.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <OperatorsPanel
                  companyId={supportCompanyId}
                  companyName={companyName ?? "esta empresa"}
                />
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}
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
