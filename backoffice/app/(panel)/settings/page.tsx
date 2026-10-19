"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useEffect,
  useRef,
  type FormEvent,
  type ReactNode,
} from "react";
import { IntegrationsSection } from "@/components/integrations/integrations-section";
import { OperatorsPanel } from "@/components/operators/operators-panel";
import type { ConfigDraft } from "@/components/settings/config-draft";
import {
  ConfigEditorProvider,
  ConfigSaveBar,
  useConfigEditorState,
} from "@/components/settings/config-editor";
import {
  CONFIG_SECTIONS,
  fieldId,
} from "@/components/settings/config-sections";
import { InstructionsCard } from "@/components/settings/instructions-card";
import { PromptSection } from "@/components/settings/prompt-section";
import {
  CONFIG_SECTION_FIELDS,
  DEFAULT_SECTION,
  isConfigSection,
  LEGACY_SECTIONS,
  SECTION_GROUPS,
  sectionOfField,
  type ConfigSectionId,
  type SectionId,
} from "@/components/settings/sections";
import { Section } from "@/components/panel";
import { SettingsNav } from "@/components/settings/settings-nav";
import { VersionsCard } from "@/components/settings/versions-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { useMe, useSettings } from "@/lib/queries";
import { supportCompanyIdFor } from "@/lib/support";
import type { CompanySettings } from "@/lib/types";

type Navigation = {
  groups: typeof SECTION_GROUPS;
  active: SectionId;
  select: (id: SectionId) => void;
};

function Shell({
  nav,
  stateOf,
  children,
}: {
  nav: Navigation;
  stateOf?: (id: SectionId) => "error" | "changed" | null;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6 @4xl/main:flex-row @4xl/main:items-start @4xl/main:gap-10">
      <aside className="shrink-0 @4xl/main:sticky @4xl/main:top-0 @4xl/main:w-52">
        <SettingsNav
          groups={nav.groups}
          active={nav.active}
          onSelect={nav.select}
          stateOf={stateOf}
        />
      </aside>
      <div className="@container/content max-w-4xl min-w-0 flex-1">
        {children}
      </div>
    </div>
  );
}

function LoadedSettings({
  data,
  nav,
  supportCompanyId,
  companyName,
}: {
  data: CompanySettings;
  nav: Navigation;
  supportCompanyId: string | null;
  companyName?: string;
}) {
  const editor = useConfigEditorState(data.config, data.currentVersions.config);
  const pendingFocus = useRef<keyof ConfigDraft | null>(null);
  const { active } = nav;

  // The section of a rejected field may still be hidden; focus it once it shows.
  useEffect(() => {
    const key = pendingFocus.current;
    if (!key) return;
    pendingFocus.current = null;
    document.getElementById(fieldId(key))?.focus();
  }, [active]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void editor.save().then((first) => {
      if (!first) return;
      const section = sectionOfField(first);
      if (section === active) {
        document.getElementById(fieldId(first))?.focus();
        return;
      }
      pendingFocus.current = first;
      nav.select(section);
    });
  };

  return (
    <ConfigEditorProvider value={editor}>
      <Shell
        nav={nav}
        stateOf={(id) => (isConfigSection(id) ? editor.sectionState(id) : null)}
      >
        <form onSubmit={onSubmit} hidden={!isConfigSection(active)}>
          {(Object.keys(CONFIG_SECTION_FIELDS) as ConfigSectionId[]).map(
            (id) => {
              const Section = CONFIG_SECTIONS[id];
              return (
                <div key={id} hidden={active !== id}>
                  <Section />
                </div>
              );
            },
          )}
          <ConfigSaveBar />
        </form>

        <div hidden={active !== "instructions"}>
          <InstructionsCard
            key={data.currentVersions.instructions ?? "instructions"}
            instructions={data.instructions}
            maxChars={data.limits.instructionsMaxChars}
          />
        </div>

        {active === "prompt" ? (
          <PromptSection rules={data.platformRules} />
        ) : null}
        {active === "integrations" ? (
          <IntegrationsSection companyName={companyName} />
        ) : null}
        {active === "versions" ? <VersionsCard /> : null}
        {active === "operators" && supportCompanyId ? (
          <Section
            title="Operadores"
            description={`Quienes entran al panel de ${companyName ?? "esta empresa"}. Solo lo ve quien administra la plataforma.`}
          >
            <OperatorsPanel
              companyId={supportCompanyId}
              companyName={companyName ?? "esta empresa"}
            />
          </Section>
        ) : null}
      </Shell>
    </ConfigEditorProvider>
  );
}

function SettingsView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { email } = useAuth();
  const me = useMe();
  const settings = useSettings();
  const rootRef = useRef<HTMLDivElement>(null);
  // Operators are managed by a platform admin, from Empresas or from here through support access.
  const supportCompanyId = me.data?.supportAccess
    ? supportCompanyIdFor(email)
    : null;
  const groups = SECTION_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => !item.supportOnly || supportCompanyId !== null,
    ),
  })).filter((group) => group.items.length > 0);
  const available = groups.flatMap((group) => group.items.map((i) => i.id));
  const raw = params.get("tab");
  const requested = raw ? (LEGACY_SECTIONS[raw] ?? raw) : null;
  const active: SectionId =
    requested && available.includes(requested as SectionId)
      ? (requested as SectionId)
      : DEFAULT_SECTION;

  const select = (id: SectionId) => {
    const next = new URLSearchParams(params);
    if (id === DEFAULT_SECTION) next.delete("tab");
    else next.set("tab", id);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
    const root = rootRef.current;
    if (root && root.getBoundingClientRect().top < 0)
      root.scrollIntoView({ block: "start" });
  };
  const nav: Navigation = { groups, active, select };
  const companyName = me.data?.company?.name;

  return (
    <div ref={rootRef} className="scroll-mt-6">
      {settings.data ? (
        <LoadedSettings
          data={settings.data}
          nav={nav}
          supportCompanyId={supportCompanyId}
          companyName={companyName}
        />
      ) : (
        <Shell nav={nav}>
          {settings.isError ? (
            <Alert variant="destructive">
              <AlertTitle>No se pudo cargar la configuración</AlertTitle>
              <AlertDescription>{settings.error.message}</AlertDescription>
            </Alert>
          ) : (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-80" />
              </div>
              <Skeleton className="h-96 w-full rounded-xl" />
            </div>
          )}
        </Shell>
      )}
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
