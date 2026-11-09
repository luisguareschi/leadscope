"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { CompaniesComparison } from "@/components/metrics/companies-comparison";
import { KpiTiles } from "@/components/metrics/kpi-tiles";
import { LeadsPerDayChart } from "@/components/metrics/leads-per-day-chart";
import { MessagesRow } from "@/components/metrics/messages-row";
import { RangePicker } from "@/components/metrics/range-picker";
import { SnapshotCards } from "@/components/metrics/snapshot-cards";
import { SpendCard } from "@/components/metrics/spend-card";
import { TimeToContactChart } from "@/components/metrics/time-to-contact-chart";
import { Panel, Section } from "@/components/panel";
import { SearchableSelect } from "@/components/settings/searchable-select";
import type { SearchableOption } from "@/components/settings/searchable-select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  METRICS_FALLBACK_TIMEZONE,
  formatRangeLabel,
  isRangePreset,
  rangeForPreset,
  type RangePreset,
} from "@/lib/metrics-format";
import {
  useCompanies,
  useCompaniesMetrics,
  useMe,
  useMetrics,
} from "@/lib/queries";
import type { CompanyMetrics } from "@/lib/types";

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-xl" />
      <Skeleton className="h-80 rounded-xl" />
      <div className="grid gap-3 md:grid-cols-2">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    </div>
  );
}

function MetricsSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      <Skeleton className="h-9 w-full max-w-xl" />
      <DetailSkeleton />
    </div>
  );
}

function replaceParams(
  router: ReturnType<typeof useRouter>,
  pathname: string,
  current: URLSearchParams,
  updates: { range?: RangePreset; company?: string },
) {
  const next = new URLSearchParams(current);
  if (updates.range) {
    if (updates.range === "30d") next.delete("range");
    else next.set("range", updates.range);
  }
  if (updates.company !== undefined) {
    if (updates.company) next.set("company", updates.company);
    else next.delete("company");
  }
  const query = next.toString();
  router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
}

function CompanyDetail({ metrics }: { metrics: CompanyMetrics }) {
  return (
    <>
      <KpiTiles metrics={metrics} />
      <Panel
        title="Leads por día"
        description="Según la etapa actual de cada lead."
      >
        <div className="px-2 pt-2 pb-4">
          <LeadsPerDayChart
            data={metrics.leadsPerDay}
            empty={metrics.leads === 0}
          />
        </div>
      </Panel>
      <Panel
        title="Tiempo hasta contactar por semana"
        description="Mediana entre que quedó Por contactar y que un asesor lo marcó Contactado."
      >
        <div className="px-2 pt-2 pb-4">
          <TimeToContactChart
            data={metrics.timeToContactPerWeek}
            emptyLabel={
              metrics.leads === 0
                ? "Sin leads en este período."
                : "Todavía no hay leads contactados en este período."
            }
          />
        </div>
      </Panel>
      <Section title="Ahora mismo" description="No depende del período">
        <SnapshotCards
          queue={metrics.queue}
          needsHuman={metrics.needsHuman}
          knowledge={metrics.knowledge}
          hubspot={metrics.hubspot}
        />
      </Section>
      <MessagesRow messages={metrics.messages} />
      <SpendCard spend={metrics.spend} />
    </>
  );
}

function MetricsView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const me = useMe();
  const outside = me.data?.platformAdmin === true && me.data.company == null;
  const isAdmin = me.data?.platformAdmin === true;
  const rawRange = params.get("range");
  const range: RangePreset = isRangePreset(rawRange) ? rawRange : "30d";
  const companyId = outside ? (params.get("company") ?? "") : "";
  const [showArchived, setShowArchived] = useState(false);
  // Starts as Montevideo. Once a company response arrives, presets use its timezone.
  const [timeZone, setTimeZone] = useState(METRICS_FALLBACK_TIMEZONE);
  const bounds = rangeForPreset(range, timeZone);
  const detailEnabled = Boolean(me.data) && (!outside || companyId !== "");
  const detail = useMetrics(
    {
      from: bounds?.from,
      to: bounds?.to,
      companyId: outside && companyId ? companyId : undefined,
    },
    detailEnabled,
  );
  // Keep the timezone from the last response. Adjusting state here (not in an
  // effect) lets the next render compute presets in that zone without dropping
  // the value when the query key changes.
  const reportedZone = detail.data?.company.timezone;
  if (reportedZone && reportedZone !== timeZone) setTimeZone(reportedZone);

  const companies = useCompaniesMetrics(
    {
      from: bounds?.from,
      to: bounds?.to,
      status: showArchived ? "all" : "active",
    },
    isAdmin,
  );
  const companyList = useCompanies(outside, "active");

  const setRange = (next: RangePreset) =>
    replaceParams(router, pathname, params, { range: next });
  const setCompany = (id: string) =>
    replaceParams(router, pathname, params, { company: id });

  const shownRange = detail.data?.range ?? companies.data?.range;
  const selectedRow = companies.data?.rows.find(
    (row) => row.company.id === companyId,
  );
  const companyOptions: SearchableOption[] = (
    companyList.data?.companies ?? []
  ).map((company) => ({
    value: company.id,
    label: company.name,
    detail: company.slug,
  }));
  if (
    companyId &&
    !companyOptions.some((option) => option.value === companyId)
  ) {
    companyOptions.unshift({
      value: companyId,
      label: selectedRow?.company.name ?? "Empresa seleccionada",
      detail: selectedRow?.company.archived
        ? "archivada"
        : selectedRow?.company.slug,
    });
  }

  if (me.isPending || !me.data) return <MetricsSkeleton />;

  return (
    <div className="@container/content flex flex-col gap-6 px-4 lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-2">
          <RangePicker value={range} onChange={setRange} />
          {shownRange ? (
            <p className="text-sm text-muted-foreground">
              {formatRangeLabel(shownRange.from, shownRange.to)}
            </p>
          ) : null}
        </div>
        {outside ? (
          companyList.isPending ? (
            <Skeleton className="h-9 w-full max-w-xs rounded-md" />
          ) : (
            <div className="w-full max-w-xs">
              <SearchableSelect
                id="metrics-company"
                value={companyId}
                onValueChange={setCompany}
                options={companyOptions}
                placeholder="Elige una empresa"
              />
            </div>
          )
        ) : null}
      </div>

      {outside && !companyId ? (
        <p className="text-sm text-muted-foreground">
          Elige una empresa para ver su detalle.
        </p>
      ) : null}

      {detailEnabled ? (
        detail.data ? (
          <>
            {detail.isError ? (
              <Alert variant="destructive">
                <AlertTitle>No se pudieron cargar las métricas</AlertTitle>
                <AlertDescription>{detail.error.message}</AlertDescription>
              </Alert>
            ) : null}
            <CompanyDetail metrics={detail.data} />
          </>
        ) : detail.isError ? (
          <Alert variant="destructive">
            <AlertTitle>No se pudieron cargar las métricas</AlertTitle>
            <AlertDescription>{detail.error.message}</AlertDescription>
          </Alert>
        ) : (
          <DetailSkeleton />
        )
      ) : null}

      {isAdmin ? (
        <CompaniesComparison
          query={companies}
          showArchived={showArchived}
          onShowArchivedChange={setShowArchived}
          clickable={outside}
          onSelect={setCompany}
        />
      ) : null}
    </div>
  );
}

export default function MetricsPage() {
  return (
    <Suspense fallback={<MetricsSkeleton />}>
      <MetricsView />
    </Suspense>
  );
}
