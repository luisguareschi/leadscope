# Spec: Métricas page

Status: approved by Luis on 9 Nov 2026. Free of charge for clients (not quoted). Internal build spec.

## 1. Goal

Add a **Métricas** page to the backoffice. It shows how the assistant and the sales team are performing.

- **Company operators** see their own company's metrics. Every operator sees everything; there are no roles.
- **A platform admin** (`PLATFORM_ADMIN_EMAILS`) sees the same page with a company selector and a table that compares all companies. Through support access (Entrar) the admin sees exactly what the company's operators see.

This is read-only. It does not change any data, any existing endpoint, or the bot's behavior.

### Out of scope (do NOT build)

- Render / Supabase infrastructure costs, any `InfraCost` table, margin per client, hours per client.
- New tables, new columns, or Prisma migrations. Everything comes from existing tables.
- Export to CSV/PDF, email reports, alerts, or scheduled jobs.
- Live-updating charts. A normal React Query fetch is enough (refetch on window focus, no interval).
- Changes to any existing screen, except adding the sidebar item and the header title.

## 2. Repo conventions you must follow

Read `AGENTS.md` (product rules) before starting. Key points:

- Backend: `backend/`, Express 5, Prisma 7 (client generated in `backend/src/generated/prisma`), ESM with `.js` import suffixes, zod 4. **One controller file and one service file per endpoint**, in `backend/src/features/<feature>/`. Services call Prisma directly through `ctx.db`. See `backend/src/features/threads/get-threads-summary.*.ts` as the pattern to copy.
- Backoffice: `backoffice/`, Next.js 16 client components, shadcn (`backoffice/components/ui/*`), Tailwind 4, React Query hooks in `backoffice/lib/queries.ts`, API types in `backoffice/lib/types.ts`. Pages live in `backoffice/app/(panel)/<route>/page.tsx`. Use the existing `Panel`/`Section` components in `backoffice/components/panel.tsx` and copy the look of `app/(panel)/companies/page.tsx`.
- Panel copy is **neutral Spanish with tú forms** (tienes, elige), never voseo. All user-visible text is Spanish. Code, comments, and identifiers are English.
- Colors come from theme tokens in `backoffice/app/globals.css` (light and dark). Never hardcode hex colors in components; charts use `var(--chart-1)` … `var(--chart-5)` (add these tokens to `globals.css` for light and dark only if they do not exist yet).
- Keep the mobile layout working (below `lg`): KPI tiles stack 2 per row, charts full width, tables scroll horizontally inside their card.
- Do not add comments that narrate the change. Add short doc comments only where a rule is not obvious (like the existing code does).

## 3. Access rules

| Who | `GET /internal/metrics` | `GET /internal/metrics/companies` | Sidebar item |
|---|---|---|---|
| Company operator (not archived, company not archived) | Own company only. `companyId` query param is ignored. | 403 | Yes |
| Platform admin inside a company (support access, `X-Company-Id`) | That company | 200 | Yes |
| Platform admin outside any company (Empresas view) | Must pass `?companyId=`; else 400 | 200 | Yes (show "Métricas" next to Empresas) |
| Anyone else | 403 | 403 | No |

Implementation:

- `GET /internal/metrics`: mount **without** `requireCompanyAccess`. In the controller, call `resolveCompanyAccess(ctx, req)` (from `backend/src/http/company-access.ts`).
  - If it returns access → use `access.companyId` (ignore `?companyId`).
  - Else if `isPlatformAdmin(ctx.env, sessionOf(req).sessionEmail)` → require `?companyId=` (400 `bad_request` "Elige una empresa." if missing; 404 "Empresa no encontrada" if it does not exist). Archived companies are allowed for the admin here (read-only).
  - Else → 403 with the same body `requireCompanyAccess` sends (`noPanelAccess` from `require-session.ts`).
  - Reads are not writes, so no `AdminAuditEntry` is created (consistent with `auditSupportWrite`, which only records writes).
- `GET /internal/metrics/companies`: mount behind `requirePlatformAdmin(ctx)`.
- Mount both in `backend/src/app.ts` on the `backoffice` router: `backoffice.use("/metrics", metricsRoutes(ctx));` In `metricsRoutes`, register `/companies` with `requirePlatformAdmin(ctx)` as route-level middleware **before** `/`.

## 4. Query parameters (both endpoints)

| Param | Format | Default | Rules |
|---|---|---|---|
| `from` | `YYYY-MM-DD` | 30 days before `to` (so 30 days inclusive) | Calendar day in the company's timezone (`config.timezone`, default `America/Montevideo`). |
| `to` | `YYYY-MM-DD` | Today in the company's timezone | Inclusive. Must be ≥ `from`. Range ≤ 366 days, else 400. |
| `companyId` | string | — | Only `/internal/metrics`, only for a platform admin outside a company. |

The range is `[startOfDay(from), startOfDay(to + 1 day))` in the company timezone, converted to UTC instants for the queries. For `/companies`, use `America/Montevideo` for day boundaries and the default range (one timezone for the comparison table is acceptable; note it in a doc comment).

Validate with zod in the controller (see `backend/src/http/validate.ts`). Errors are Spanish, code `bad_request`.

Timezone math: do not add a date library. Write a small helper `backend/src/features/metrics/time-zone.ts` that uses `Intl.DateTimeFormat(..., { timeZone, hourCycle: "h23", year, month, day, hour, minute, weekday })` with `formatToParts` to:
- `zonedDayStart(dateStr, tz): Date` (UTC instant of 00:00 local on that day; compute the offset with formatToParts and correct once, which handles DST),
- `localParts(date, tz): { dateStr: "YYYY-MM-DD", weekday: 0-6 (0 = Sunday), hour: 0-23 }`.
Unit-test both, including a DST zone (`Europe/Madrid`, 29 Mar 2026 and 25 Oct 2026) and `America/Montevideo` (no DST).

## 5. Definitions (the important part)

"Leads in range" = `Thread` rows of the company with `createdAt` in the range. This is a **cohort**: each lead is counted by the day it first arrived, with its **current** stage.

Known data limits (show them as a small help tip on the page, see §8):
- The bot's own stage moves are not logged in `LeadStageChange` (only a person's picks are). So stage metrics use the thread's current fields, not a history.
- `needsHumanReason` is cleared when an operator marks the thread attended, so "Asistente detenido" counts only threads that currently need a human.

| Key | Spanish label | Definition |
|---|---|---|
| `leads` | Leads nuevos | Count of leads in range. |
| `leadsBySource` | Origen | `{ whatsapp, form }` counts of leads in range by `source`. |
| `leadsPerDay` | Leads por día | One row per local calendar day in the range (include days with 0): `{ date: "YYYY-MM-DD", qualifying, to_contact, contacted, not_interested }`, counts of leads created that day by **current** `stage`. Bucket by the company's timezone. |
| `qualified` | Calificados | Leads in range with `handedOffAt != null` OR `stage in (to_contact, contacted)`. |
| `qualificationRate` | Tasa de calificación | `qualified / leads`; `null` when `leads = 0`. |
| `notInterested` | Sin interés | Leads in range with `stage = not_interested`. |
| `notInterestedRate` | Tasa sin interés | `notInterested / leads`; `null` when `leads = 0`. |
| `callNow` | Pidieron hablar ya | Leads in range whose `callTime` equals the exact string the engine stores for call-now. Import `CALL_NOW_TIME` from `backend/src/engine/turn.ts`; do not duplicate the string. |
| `outOfHours` | Fuera de horario | Leads in range whose `createdAt`, in the company timezone, is on Saturday or Sunday, or before 09:00, or at/after 18:00. `config.businessHours` is free text, so this fixed rule is used for every company; export it as a constant `OFFICE_HOURS = { startHour: 9, endHour: 18, weekdays: [1,2,3,4,5] }` with a doc comment saying so. |
| `outOfHoursRate` | % fuera de horario | `outOfHours / leads`; `null` when `leads = 0`. |
| `timeToContact` | Tiempo hasta contactar | Over threads of the company (any creation date) with `contactedAt` **in the range** and `handedOffAt != null` and `contactedAt >= handedOffAt`: `{ count, medianMinutes, p90Minutes }` of `contactedAt − handedOffAt` in minutes (rounded to an integer). Nulls when `count = 0`. Use nearest-rank percentiles, computed in TypeScript. |
| `timeToContactPerWeek` | Tiempo hasta contactar por semana | Same population, grouped by the ISO week (Monday start, company timezone) of `contactedAt`: `[{ weekStart: "YYYY-MM-DD", count, medianMinutes }]`, every week that overlaps the range, including empty weeks with `count: 0, medianMinutes: null`. |
| `queue` | Cola actual | Snapshot, **not** filtered by range: `{ toContact, unassigned, unassignedOver24h, oldestWaitingMinutes }` where `toContact` = threads with `stage = to_contact`; `unassigned` = those with `assignedToId = null`; `unassignedOver24h` = unassigned with `handedOffAt < now − 24h`; `oldestWaitingMinutes` = minutes since the oldest `handedOffAt` among unassigned to_contact threads (`null` if none). |
| `needsHuman` | Asistente detenido | Snapshot, not filtered by range: threads with `needsHuman = true`, grouped by reason category: the part of `needsHumanReason` before the first `:` (`forbidden_topic`, `model_failure`, `send_failed`, `lead_needs_human`, `empty_reply`, `channel_unavailable`; anything else or null → `other`). Return `{ total, byReason: { [category]: count } }`. |
| `messages` | Mensajes | Messages of the company with `sentAt` in range: `{ inbound, assistant, advisor, templates, failed }`. `assistant` = outbound, `type != "template"`, `sentByEmail = null`. `advisor` = outbound with `sentByEmail != null`. `templates` = outbound with `type = "template"`. `failed` = outbound with `status = "failed"`. |
| `knowledge` | Conocimiento | Snapshot: `{ files, lastUploadAt, daysSinceLastUpload }` from `KnowledgeFile` (`lastUploadAt` = max `updatedAt`; days rounded down; nulls if no files). |
| `hubspot` | HubSpot | Snapshot. `{ enabled, pending, failing }` where `enabled` = `company.hubspotEnabled === true`; `pending` = threads with `crmPendingAction != null`; `failing` = threads with `crmPendingAction != null AND crmLastError != null`. When not enabled, return `{ enabled: false, pending: 0, failing: 0 }` and the UI hides the HubSpot tile (AGENTS.md: with HubSpot off, the panel shows no HubSpot). |
| `spend` | Gasto estimado del cliente | See §6. |

Implement counts with `ctx.db.thread.count` / `groupBy` / `message.groupBy` where possible. For `leadsPerDay`, `outOfHours`, and time-to-contact, fetch only the needed columns (`select: { createdAt, stage }` etc.) and aggregate in TypeScript; the volume is ~20 leads/day per company, so a year is ~7,000 rows, which is fine. Run independent queries with `Promise.all`.

## 6. Estimated client spend

Clients pay Anthropic, Meta (WhatsApp), and Kapso themselves. This is shown **for information**, labeled as an estimate.

### 6.1 Anthropic

From `LlmUsage` of the company with `createdAt` in range, grouped by `model`: sum `inputTokens`, `outputTokens`, `cacheReadTokens`, `cacheWriteTokens`, and count rows (= model calls).

Prices live in `backend/src/features/metrics/pricing.ts` as a constant, USD per million tokens, with a doc comment "Anthropic list prices, checked 9 Nov 2026. Update when Anthropic changes prices.":

| model | input | output | cacheRead | cacheWrite |
|---|---|---|---|---|
| `claude-haiku-4-5` | 1.00 | 5.00 | 0.10 | 1.25 |
| `claude-haiku-5-5` | 0.10 | 0.50 | 0.01 | 0.125 |
| `claude-sonnet-4-6` | 3.00 | 15.00 | 0.30 | 3.75 |
| `claude-sonnet-5` | 2.00 | 10.00 | 0.20 | 2.50 |
| `claude-sonnet-5-5` | 2.00 | 10.00 | 0.20 | 2.50 |
| `claude-opus-4-8` | 5.00 | 25.00 | 0.50 | 6.25 |
| `claude-opus-5` | 5.00 | 25.00 | 0.50 | 6.25 |
| `claude-opus-5-5` | 4.00 | 20.00 | 0.20 | 5.00 |
| `claude-fable-5` | 10.00 | 50.00 | 1.00 | 12.50 |
| `claude-fable-5-1` | 10.00 | 50.00 | 0.25 | 12.50 |

Cost = Σ tokens × price / 1,000,000. A model not in the table contributes `null` cost and its id is listed in `unpricedModels`. `inputTokens` is assumed to exclude cache tokens (that is how the Anthropic API reports `input_tokens`); verify in `backend/src/llm/anthropic.ts` how `LlmUsage` is written and adjust if not.

Output:
```ts
anthropic: {
  usd: number | null;            // null only if every model is unpriced or there is no usage → then 0
  calls: number;
  byModel: { model: string; calls: number; inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; usd: number | null }[];
  unpricedModels: string[];
}
```
With no usage, `usd: 0`, `calls: 0`, empty arrays.

### 6.2 WhatsApp (Meta)

Estimate only, from `messages` in §5. Constants in `pricing.ts` with a doc comment "Meta, Uruguay (Rest of Latin America), from 1 Oct 2026. Estimate only.":

- `WHATSAPP_TEMPLATE_USD = 0.085` per template sent (`templates`). Treat every template as marketing (the most expensive category), and say so in the help tip.
- `WHATSAPP_SERVICE_USD = 0.0113` per free-form outbound (`assistant + advisor`), after `WHATSAPP_FREE_SERVICE_PER_MONTH = 1000` free per number per calendar month. Apply the free tier per calendar month in the company timezone that overlaps the range: for each month, `max(0, serviceMessagesInMonth − 1000) × 0.0113`. Failed messages (`status = "failed"`) are not billed: exclude them from both counts.

Output: `whatsapp: { usd: number; templates: number; serviceMessages: number; freeServiceMessages: number }`.

### 6.3 Kapso

Not computed (flat plan, billed to the client). The UI shows a one-line note: "Kapso se cobra aparte con un plan fijo." No number.

`spend = { anthropic, whatsapp, totalUsd }` where `totalUsd = (anthropic.usd ?? 0) + whatsapp.usd`, rounded to 2 decimals at the end only. Also return `perLeadUsd = leads > 0 ? totalUsd / leads : null`.

## 7. API contract

### `GET /internal/metrics?from&to[&companyId]`

```ts
type CompanyMetrics = {
  company: { id: string; name: string; slug: string; timezone: string };
  range: { from: string; to: string };         // YYYY-MM-DD, resolved defaults
  generatedAt: string;                          // ISO
  leads: number;
  leadsBySource: { whatsapp: number; form: number };
  leadsPerDay: { date: string; qualifying: number; to_contact: number; contacted: number; not_interested: number }[];
  qualified: number;
  qualificationRate: number | null;             // 0..1
  notInterested: number;
  notInterestedRate: number | null;
  callNow: number;
  outOfHours: number;
  outOfHoursRate: number | null;
  timeToContact: { count: number; medianMinutes: number | null; p90Minutes: number | null };
  timeToContactPerWeek: { weekStart: string; count: number; medianMinutes: number | null }[];
  queue: { toContact: number; unassigned: number; unassignedOver24h: number; oldestWaitingMinutes: number | null };
  needsHuman: { total: number; byReason: Record<string, number> };
  messages: { inbound: number; assistant: number; advisor: number; templates: number; failed: number };
  knowledge: { files: number; lastUploadAt: string | null; daysSinceLastUpload: number | null };
  hubspot: { enabled: boolean; pending: number; failing: number };
  spend: {
    anthropic: { usd: number | null; calls: number; byModel: {...}[]; unpricedModels: string[] };
    whatsapp: { usd: number; templates: number; serviceMessages: number; freeServiceMessages: number };
    totalUsd: number;
    perLeadUsd: number | null;
  };
};
```

### `GET /internal/metrics/companies?from&to&status=active|all`

Platform admin only. `status` defaults to `active` (non-archived). One row per company, sorted by `leads` desc then name:

```ts
type CompaniesMetrics = {
  range: { from: string; to: string };
  rows: {
    company: { id: string; name: string; slug: string; archived: boolean };
    leads: number;
    qualificationRate: number | null;
    notInterestedRate: number | null;
    outOfHoursRate: number | null;
    medianMinutesToContact: number | null;
    unassignedToContact: number;
    needsHuman: number;
    daysSinceLastUpload: number | null;
    spendUsd: number;
  }[];
};
```

Build each row by reusing the same service functions as the single-company endpoint (do not write the metric logic twice). Split the service into small pure functions in `backend/src/features/metrics/` so both endpoints share them, e.g. `compute-company-metrics.ts` exporting `computeCompanyMetrics(ctx, company, range)`. Run companies sequentially or with a small concurrency (≤ 4); there are few companies.

### Files (backend)

```
backend/src/features/metrics/
  metrics.routes.ts
  get-metrics.controller.ts
  get-metrics.service.ts
  get-companies-metrics.controller.ts
  get-companies-metrics.service.ts
  compute-company-metrics.ts     // shared aggregation
  metrics-range.ts               // zod schema + range resolution
  time-zone.ts                   // §4 helpers
  pricing.ts                     // §6 constants + cost functions
backend/test/http/metrics.test.ts
backend/test/lib/metrics-time-zone.test.ts
```

## 8. UI

### Navigation

- `backoffice/components/app-sidebar.tsx`: add `{ title: "Métricas", url: "/metrics", icon: <ChartColumnIcon /> }` (lucide; use `ChartColumnIcon` or `BarChart3Icon`, whichever exists in the installed `lucide-react`).
  - Inside a company (`hasCompany`): after Conversaciones, before Conocimiento.
  - Platform admin outside a company: before Empresas.
- `backoffice/components/site-header.tsx` `titleFor`: `/metrics` → "Métricas".

### Page `backoffice/app/(panel)/metrics/page.tsx`

Top bar (one row on desktop, wraps on mobile):
- **Range picker**: a segmented control or select with "Últimos 7 días", "Últimos 30 días" (default), "Últimos 90 días", "Este mes", "Mes pasado". Compute `from`/`to` in the browser from the company timezone returned by the API; for the first request send nothing and let the backend default to 30 days. Keep the choice in the URL (`?range=30d`) so reloads keep it.
- **Company selector** (platform admin outside a company only): searchable select of active companies (reuse `useCompanies(true, "active")` and the combobox pattern of `components/settings/searchable-select.tsx`). Keep it in the URL (`?company=<id>`). Until one is chosen, show the comparison table only, with a hint "Elige una empresa para ver su detalle."

Sections, in this order:

1. **KPI tiles** (grid: 2 cols mobile, 3 at `md`, 6 at `xl`). Each tile: label, big number, small caption.
   - Leads nuevos — caption "X por WhatsApp · Y por formulario"
   - Calificados — the %, caption "N leads"
   - Sin interés — the %, caption "N leads"
   - Fuera de horario — the %, caption "Escribieron fuera de 9 a 18 h o en fin de semana"
   - Tiempo hasta contactar — median formatted (`45 min`, `3 h 20 min`, `2 d 4 h`), caption "p90: …"
   - Pidieron hablar ya — count
   Show `—` for null values.

2. **Leads por día**: stacked bar chart, one bar per day, stacks in stage order Calificando, Por contactar, Contactado, Sin interés. Use the same stage colors the stage picker uses (`components/threads/stage-picker.tsx` / `lib/thread-status.ts`); if those are classes rather than tokens, map them to chart tokens and keep both in sync. Tooltip with the four counts and the total. Legend under the chart.

3. **Tiempo hasta contactar por semana**: line chart of `medianMinutes` per week (skip nulls, no line through them), y-axis in hours. Tooltip shows count too. Empty state: "Todavía no hay leads contactados en este período."

4. **Ahora mismo** (snapshot cards, a small "No depende del período" caption):
   - Cola Por contactar: `toContact`, `unassigned` sin asesor, `unassignedOver24h` con más de 24 h, oldest wait. Link "Ver cola" → `/threads?stage=to_contact` (check how the threads page reads filters from the URL; if it does not, link to `/threads`).
   - Asistente detenido: total and a short list by reason with Spanish labels: `forbidden_topic` "Tema prohibido", `model_failure` "Falla del modelo", `send_failed` "Falla de WhatsApp", `lead_needs_human` "Pidió una persona", `empty_reply` "Respuesta vacía", `channel_unavailable` "WhatsApp no disponible", `other` "Otro".
   - Conocimiento: "Última subida hace N días" (warning style when > 30 days: "Revisa que los precios estén al día."), file count. Link to `/knowledge`.
   - HubSpot (only when `hubspot.enabled`): pending and failing writes; failing > 0 uses the destructive/warning style.

5. **Mensajes**: one compact row of numbers: recibidos, del asistente, de asesores, plantillas, fallidos.

6. **Gasto estimado del cliente**: total USD and per lead; a breakdown Anthropic (with the model table collapsed under "Ver detalle") and WhatsApp (templates and billable service messages); the Kapso note. Format money as `USD 12.34` (`Intl.NumberFormat("es", { style: "currency", currency: "USD" })` is fine). A help tip (`components/help-tip.tsx`) explaining: "Estimación con los precios de lista de Anthropic y Meta. Lo paga la empresa directamente; la factura real puede variar." If `unpricedModels` is non-empty, show "Sin precio para: …".

7. **Comparación entre empresas** (platform admin only, both outside and inside a company): table of `/internal/metrics/companies` rows with the columns in §7, a "Mostrar archivadas" switch like Empresas, and clicking a row selects that company (outside a company) — inside support access, rows are not clickable. On mobile, stack rows like the Conversaciones mobile list or let the table scroll horizontally.

A help tip next to the page title explains the data limits from §5 in one or two sentences: "Cada lead cuenta en el día en que escribió por primera vez, con su etapa actual. «Ahora mismo» no depende del período."

Loading: skeletons matching the layout (see Empresas page). Errors: an `Alert` with the API message. Empty company (0 leads): tiles show 0/—, charts show a centered "Sin leads en este período."

### Charts library

The backoffice has no chart library. Add shadcn's chart component (`npx shadcn@latest add chart`, which brings `recharts` and `components/ui/chart.tsx`). Pin the installed `recharts` version exactly in `package.json` (no `^`). If the shadcn CLI cannot run, install `recharts` with an exact version and write `components/ui/chart.tsx` by hand following shadcn's chart docs. Respect `prefers-reduced-motion` (`isAnimationActive={false}` when reduced motion is on).

### Frontend files

```
backoffice/app/(panel)/metrics/page.tsx
backoffice/components/metrics/kpi-tiles.tsx
backoffice/components/metrics/leads-per-day-chart.tsx
backoffice/components/metrics/time-to-contact-chart.tsx
backoffice/components/metrics/snapshot-cards.tsx
backoffice/components/metrics/messages-row.tsx
backoffice/components/metrics/spend-card.tsx
backoffice/components/metrics/companies-comparison.tsx
backoffice/components/metrics/range-picker.tsx
backoffice/lib/metrics-format.ts        // minutes → "3 h 20 min", %, USD
backoffice/components/ui/chart.tsx      // shadcn
```
Plus: types `CompanyMetrics`, `CompaniesMetrics` in `lib/types.ts`; hooks `useMetrics({ from, to, companyId })` and `useCompaniesMetrics({ from, to, status }, enabled)` in `lib/queries.ts` with query keys `["metrics", companyId ?? "own", from, to]` and `["metrics", "companies", status, from, to]`.

## 9. Tests (backend, vitest, real Postgres via the existing harness)

`backend/test/http/metrics.test.ts`, following `backend/test/http/thread-stage.test.ts` (dev tokens `Bearer dev:<email>`, `createCompany`, `resetDb`). Cover at least:

1. Operator gets own company metrics; `?companyId=<other>` is ignored.
2. Operator gets 403 on `/internal/metrics/companies`.
3. Platform admin without `X-Company-Id` and without `companyId` → 400; with `companyId` → 200; with `X-Company-Id` → that company.
4. Unknown login → 403. Archived operator → 403.
5. Cohort counts: create threads with fixed `createdAt` and stages; check `leads`, `qualified` (via `handedOffAt` and via stage), `notInterested`, rates, `leadsBySource`, and `leadsPerDay` length = days in range with zero days present.
6. Day bucketing in the company timezone: a thread at 02:00 UTC on 2 Nov is 1 Nov 23:00 in Montevideo.
7. Out of hours: Saturday noon, Tuesday 08:59, Tuesday 18:00 count; Tuesday 09:00 and 17:59 do not (all local time).
8. Time to contact: median and p90 with known values; `contactedAt` before `handedOffAt` is excluded; `contactedAt` outside range is excluded.
9. Queue snapshot ignores range; `unassignedOver24h` and `oldestWaitingMinutes`.
10. needsHuman grouping by reason prefix, unknown → `other`.
11. Messages counts by kind; failed excluded from WhatsApp spend; free tier of 1000 per month.
12. Anthropic cost for a priced model and an unpriced model (`unpricedModels`).
13. HubSpot off → `{ enabled: false, pending: 0, failing: 0 }` even with pending rows.
14. Companies endpoint: rows for active companies, `status=all` includes archived, sorted by leads.
15. Validation: bad date, `from > to`, range > 366 days → 400.

`backend/test/lib/metrics-time-zone.test.ts`: the helpers in §4, with DST.

## 10. Definition of done

Run and make pass, from the repo root of the worktree:

```
cd backend && npm run typecheck && npm run lint && npm test
cd backoffice && npm run typecheck && npm run lint && npm run build
```

Backend tests need Postgres (`docker compose up -d` at the repo root; the test DB is `leadscope_test`). If Postgres is not reachable, say so in the report instead of skipping tests silently.

Do not commit. Do not edit `AGENTS.md`, `docs/design.md`, `README.md`, or this spec (the coordinator updates docs). At the end, report: files changed, commands run with their results, anything in this spec you could not do or changed and why.
