"use client";

import { Tabs } from "@base-ui/react/tabs";
import {
  ArrowDownIcon,
  ArrowRightIcon,
  CheckIcon,
  FileTextIcon,
  MessageCircleIcon,
  MicIcon,
  MinusIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { cn } from "cn";
import { AppLogo } from "@/components/app-logo";
import {
  CONVERSATIONS_PREVIEW_ROWS,
  FAQ_ITEMS,
  FEATURE_BLOCKS,
  HERO_SCENARIOS,
  OPERATIONAL_HIGHLIGHTS,
  OWNER_CONTACT,
  WHATSAPP_DEMO_URL,
  type BotTone,
  type ConversationPreviewRow,
  type FeatureBlock,
  type FeaturePreviewRow,
  type HeroMessage,
  type HeroScenario,
  type HeroScenarioId,
  type PreviewRowTone,
  type StageTone,
} from "@/components/landing/landing-data";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { useIsStandalone } from "@/hooks/use-is-ios-pwa";
import { useAuth } from "@/lib/auth";

const SECTION_LINKS = [
  { id: "producto", label: "Producto" },
  { id: "control", label: "Control" },
  { id: "faq", label: "Preguntas" },
] as const;

const TRUST_CHECKS = [
  "Tu número oficial de WhatsApp",
  "Listo en días",
  "Demo con tus archivos",
];

type PreviewFilter = "all" | "to_contact" | "needs_human";
type HeroWindowTab = "conversations" | HeroScenarioId;

const TONE_CLASS: Record<PreviewRowTone, string> = {
  accent: "bg-primary/10 text-primary dark:bg-primary/15",
  ok: "bg-status-ok/12 text-[color:color-mix(in_oklch,var(--status-ok),black_32%)] dark:bg-status-ok/15 dark:text-status-ok",
  neutral: "bg-secondary text-muted-foreground",
  danger: "bg-destructive/10 text-destructive dark:bg-destructive/15",
};

const STAGE_DOT_CLASS: Record<StageTone, string> = {
  primary: "bg-primary",
  califying: "bg-[#8b96ff]",
  ok: "bg-status-ok",
};

const STAGE_PILL_CLASS: Record<StageTone, string> = {
  primary: "bg-primary/10 text-primary dark:bg-primary/15",
  califying:
    "bg-[#8b96ff]/15 text-[#3b42c4] dark:bg-[#8b96ff]/15 dark:text-[#c5cbff]",
  ok: "bg-status-ok/12 text-[color:color-mix(in_oklch,var(--status-ok),black_32%)] dark:bg-status-ok/15 dark:text-status-ok",
};

const BOT_DOT_CLASS: Record<BotTone, string> = {
  ok: "bg-status-ok",
  neutral: "bg-muted-foreground/60",
  danger: "bg-destructive",
};

const EXTERNAL_LINK = {
  href: WHATSAPP_DEMO_URL,
  target: "_blank",
  rel: "noopener noreferrer",
} as const;

/** Smooth in-page scroll that respects reduced motion and moves focus to the section. */
function scrollToSection(event: React.MouseEvent<HTMLAnchorElement>) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const target = document.getElementById(event.currentTarget.hash.slice(1));
  if (!target) return;
  event.preventDefault();
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  target.scrollIntoView({
    behavior: reduceMotion ? "auto" : "smooth",
    block: "start",
  });
  target.focus({ preventScroll: true });
}

/** Signed-in visitors go straight to Conversaciones; everyone else to the sign-in page. */
function usePanelLink() {
  const { status } = useAuth();
  return status === "signed_in"
    ? { href: "/threads", label: "Ir al panel" }
    : { href: "/login", label: "Entrar" };
}

function Container({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-6xl pr-[max(1rem,var(--safe-right))] pl-[max(1rem,var(--safe-left))] sm:pr-[max(1.5rem,var(--safe-right))] sm:pl-[max(1.5rem,var(--safe-left))]",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Tag({
  tone,
  className,
  children,
}: {
  tone: PreviewRowTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap",
        TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

function CheckList({
  items,
  className,
}: {
  items: string[];
  className?: string;
}) {
  return (
    <ul className={cn("flex flex-col gap-2.5 text-[15px]", className)}>
      {items.map((item) => (
        <li key={item} className="flex gap-2.5">
          <CheckIcon
            aria-hidden
            className="mt-0.5 size-4 shrink-0 text-status-ok"
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** Morphs from transparent full-width over the cobalt hero into a centered floating pill bar. */
function LandingHeader() {
  const panel = usePanelLink();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 pt-[var(--header-safe-top)]">
      <div className="pr-[max(0.75rem,var(--safe-right))] pl-[max(0.75rem,var(--safe-left))] sm:pr-[max(1.5rem,var(--safe-right))] sm:pl-[max(1.5rem,var(--safe-left))]">
        <div
          className={cn(
            "pointer-events-auto mx-auto flex items-center justify-between gap-2 transition-all duration-300 motion-reduce:transition-none md:grid md:grid-cols-[1fr_auto_1fr]",
            scrolled
              ? "mt-3 h-13 max-w-4xl rounded-full border border-border/80 bg-card/90 px-3.5 shadow-[0_14px_40px_-14px_rgb(15_23_42/0.22)] backdrop-blur-xl sm:px-5 dark:shadow-[0_16px_42px_-12px_rgb(0_0_0/0.7)]"
              : "h-16 max-w-6xl rounded-full border border-transparent bg-transparent px-1 sm:px-2",
          )}
        >
          <Link
            href="/"
            className={cn(
              "flex items-center gap-2 justify-self-start rounded-full px-1 py-1 font-heading text-[15px] font-semibold tracking-tight transition-colors outline-none focus-visible:ring-3",
              scrolled
                ? "text-foreground focus-visible:ring-ring/40"
                : "text-white focus-visible:ring-white/40",
            )}
          >
            <AppLogo
              className={cn(
                "size-6 transition-colors",
                scrolled
                  ? "text-foreground"
                  : "text-white [&_path:last-of-type]:fill-[#c5cbff]",
              )}
            />
            LeadScope
          </Link>

          <nav
            aria-label="Secciones"
            className={cn(
              "hidden items-center justify-self-center gap-7 text-[13px] font-medium md:flex",
              scrolled ? "text-muted-foreground" : "text-white/85",
            )}
          >
            {SECTION_LINKS.map((link) => (
              <a
                key={link.id}
                href={`#${link.id}`}
                onClick={scrollToSection}
                className={cn(
                  "rounded-md transition-colors outline-none focus-visible:ring-3",
                  scrolled
                    ? "hover:text-foreground focus-visible:ring-ring/40"
                    : "hover:text-white focus-visible:ring-white/40",
                )}
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center justify-self-end gap-1 sm:gap-2">
            <ThemeToggle
              className={
                scrolled
                  ? undefined
                  : "text-white/85 hover:bg-white/15 hover:text-white aria-expanded:bg-white/15 aria-expanded:text-white dark:hover:bg-white/15"
              }
            />
            <Link
              href={panel.href}
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "px-2.5 sm:px-3.5",
                scrolled
                  ? "text-muted-foreground hover:text-foreground"
                  : "text-white/90 hover:bg-white/15 hover:text-white focus-visible:ring-white/40 dark:hover:bg-white/15",
              )}
            >
              {panel.label}
            </Link>
            <a
              {...EXTERNAL_LINK}
              className={cn(
                buttonVariants({ size: "sm" }),
                scrolled
                  ? "bg-foreground text-background hover:bg-foreground/85"
                  : "bg-white text-[#0b0d17] shadow-sm hover:bg-white/92 focus-visible:ring-white/50",
              )}
            >
              Pedir demo
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}

function ChatBubble({ message }: { message: HeroMessage }) {
  if (message.from === "lead") {
    return (
      <div className="max-w-[88%] self-start rounded-2xl rounded-bl-md border bg-card px-3.5 py-2.5 text-[13px] leading-snug shadow-xs">
        {message.audio ? (
          <span className="mb-1.5 flex w-fit items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary dark:bg-primary/15">
            <MicIcon aria-hidden className="size-3" />
            {message.audio}
          </span>
        ) : null}
        {message.text}
      </div>
    );
  }
  return (
    <div className="max-w-[88%] self-end rounded-2xl rounded-br-md bg-bubble px-3.5 py-2.5 text-[13px] leading-snug text-bubble-foreground">
      {message.text}
      {message.file ? (
        <span className="mt-2 flex items-center gap-2 rounded-lg bg-white/15 px-2.5 py-1.5 text-xs font-medium">
          <FileTextIcon aria-hidden className="size-3.5 shrink-0" />
          <span className="min-w-0 truncate">PDF · {message.file}</span>
        </span>
      ) : null}
      <span className="mt-1 block text-right text-[11px] opacity-75">
        Asistente · {message.time}
      </span>
    </div>
  );
}

function LeadPanel({ scenario }: { scenario: HeroScenario }) {
  return (
    <div className="flex flex-col gap-5 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 border-b pb-3.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{scenario.leadName}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {scenario.leadMeta}
          </p>
        </div>
        <Tag tone="ok" className="px-2.5 py-1">
          {scenario.status}
        </Tag>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
          Etapa
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary dark:bg-primary/15">
          <span aria-hidden className="size-1.5 rounded-full bg-primary" />
          {scenario.stage}
        </span>
      </div>
      <div>
        <p className="mb-2 text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
          Resumen automático
        </p>
        <ul className="flex flex-col gap-1.5 text-[13px] leading-snug">
          {scenario.summary.map((bullet) => (
            <li key={bullet} className="flex gap-2">
              <span
                aria-hidden
                className="mt-[0.45rem] size-1 shrink-0 rounded-full bg-foreground/40"
              />
              {bullet}
            </li>
          ))}
        </ul>
      </div>
      <dl className="mt-auto grid grid-cols-2 gap-2">
        {scenario.fields.map((field) => (
          <div key={field.label} className="rounded-xl bg-muted px-3 py-2">
            <dt className="text-[11px] text-muted-foreground">{field.label}</dt>
            <dd className="mt-0.5 text-[13px] font-semibold">{field.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function ConversationsTablePreview({
  onSelectScenario,
}: {
  onSelectScenario: (id: HeroScenarioId) => void;
}) {
  const [filter, setFilter] = useState<PreviewFilter>("all");

  const rows = CONVERSATIONS_PREVIEW_ROWS.filter((row) => {
    if (filter === "to_contact") return row.stage === "Por contactar";
    if (filter === "needs_human") return row.assistant === "Requiere asesor";
    return true;
  });

  const filters: { id: PreviewFilter; label: string }[] = [
    { id: "all", label: "Todos" },
    { id: "to_contact", label: "Por contactar · 4" },
    { id: "needs_human", label: "Requiere asesor · 1" },
  ];

  return (
    <div className="relative bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b px-4 py-3 sm:px-5">
        <div
          role="group"
          aria-label="Filtros de ejemplo"
          className="flex flex-wrap items-center gap-1.5"
        >
          {filters.map((item) => {
            const active = filter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(item.id)}
                className={cn(
                  "cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                  active
                    ? "bg-foreground text-background"
                    : "bg-secondary text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        <div
          aria-hidden
          className="hidden items-center gap-2 rounded-full border bg-muted/70 px-3 py-1.5 text-xs text-muted-foreground sm:flex sm:w-56"
        >
          <SearchIcon className="size-3.5 shrink-0 opacity-70" />
          <span className="truncate">Buscar lead o teléfono...</span>
        </div>
      </div>

      {/* Desktop table matching LeadScope's real Conversaciones columns */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b text-[11px] font-medium text-muted-foreground">
              <th className="py-2.5 pr-3 pl-5 font-medium">Lead</th>
              <th className="px-3 py-2.5 font-medium">Etapa</th>
              <th className="px-3 py-2.5 font-medium">Asistente</th>
              <th className="px-3 py-2.5 font-medium">Asignado</th>
              <th className="px-3 py-2.5 font-medium">HubSpot</th>
              <th className="py-2.5 pr-5 pl-3 text-right font-medium">
                Último mensaje
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {rows.map((row) => (
              <ConversationTableRow
                key={row.id}
                row={row}
                onSelectScenario={onSelectScenario}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Compact stacked rows below md */}
      <ul className="divide-y divide-border/70 md:hidden">
        {rows.map((row) => (
          <li key={row.id} className="px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  aria-hidden
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary"
                >
                  {row.initials}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold">
                    {row.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {row.detail}
                  </p>
                </div>
              </div>
              <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                {row.time}
              </span>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pl-10">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                  STAGE_PILL_CLASS[row.stageTone],
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "size-1.5 rounded-full",
                    STAGE_DOT_CLASS[row.stageTone],
                  )}
                />
                {row.stage}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                <span
                  aria-hidden
                  className={cn(
                    "size-1.5 rounded-full",
                    BOT_DOT_CLASS[row.assistantTone],
                  )}
                />
                {row.assistant}
              </span>
              {row.scenarioId ? (
                <button
                  type="button"
                  onClick={() => onSelectScenario(row.scenarioId!)}
                  className="ml-auto cursor-pointer text-[11px] font-semibold text-primary hover:underline"
                >
                  Ver chat →
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {/* Gentle bottom fade echoing Firstlight when all 6 rows are visible */}
      {filter === "all" ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-card via-card/75 to-transparent"
        />
      ) : null}
    </div>
  );
}

function ConversationTableRow({
  row,
  onSelectScenario,
}: {
  row: ConversationPreviewRow;
  onSelectScenario: (id: HeroScenarioId) => void;
}) {
  return (
    <tr
      className={cn(
        "transition-colors",
        row.scenarioId ? "hover:bg-muted/50" : undefined,
      )}
    >
      <td className="py-3 pr-3 pl-5">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary"
          >
            {row.initials}
          </span>
          <div className="min-w-0">
            {row.scenarioId ? (
              <button
                type="button"
                onClick={() => onSelectScenario(row.scenarioId!)}
                className="cursor-pointer text-left font-semibold text-foreground transition-colors outline-none hover:text-primary focus-visible:underline"
              >
                {row.name}
              </button>
            ) : (
              <p className="font-semibold text-foreground">{row.name}</p>
            )}
            <p className="truncate text-xs text-muted-foreground">
              {row.detail}
            </p>
          </div>
        </div>
      </td>
      <td className="px-3 py-3 whitespace-nowrap">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
            STAGE_PILL_CLASS[row.stageTone],
          )}
        >
          <span
            aria-hidden
            className={cn(
              "size-1.5 rounded-full",
              STAGE_DOT_CLASS[row.stageTone],
            )}
          />
          {row.stage}
        </span>
      </td>
      <td className="px-3 py-3 whitespace-nowrap">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <span
            aria-hidden
            className={cn(
              "size-1.5 rounded-full",
              BOT_DOT_CLASS[row.assistantTone],
            )}
          />
          {row.assistant}
        </span>
      </td>
      <td className="px-3 py-3 whitespace-nowrap">
        <span
          className={cn(
            "text-xs",
            row.assignee === "Sin asignar"
              ? "text-muted-foreground"
              : "font-medium text-foreground",
          )}
        >
          {row.assignee}
        </span>
      </td>
      <td className="px-3 py-3 whitespace-nowrap">
        {row.hubspot === "Sincronizado" ? (
          <Tag tone="ok">{row.hubspot}</Tag>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="py-3 pr-5 pl-3 text-right text-xs whitespace-nowrap text-muted-foreground tabular-nums">
        {row.time}
      </td>
    </tr>
  );
}

function HeroPlatformWindow({ className }: { className?: string }) {
  const [activeTab, setActiveTab] = useState<HeroWindowTab>("conversations");

  return (
    <div
      className={cn(
        "relative mx-auto max-w-5xl rounded-[1.5rem] bg-white/25 p-2 ring-1 ring-white/40 backdrop-blur-md shadow-[0_30px_80px_-20px_rgba(12,18,56,0.45)] sm:p-3 dark:bg-white/10 dark:ring-white/20 dark:shadow-[0_30px_80px_-20px_rgba(0,0,0,0.85)]",
        className,
      )}
    >
      <Tabs.Root
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as HeroWindowTab)}
        className="overflow-hidden rounded-[1.1rem] border bg-card text-left text-foreground"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/60 px-4 py-2.5 sm:px-5">
          <div className="flex items-center gap-2 text-[13px] font-semibold">
            <AppLogo className="size-4.5" />
            <span className="font-heading tracking-tight">LeadScope</span>
            <span
              aria-hidden
              className="ml-1 inline-flex items-center gap-1.5 rounded-full bg-status-ok/12 px-2 py-0.5 text-[11px] font-medium text-[color:color-mix(in_oklch,var(--status-ok),black_32%)] dark:text-status-ok"
            >
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-status-ok opacity-60 motion-reduce:hidden" />
                <span className="relative inline-flex size-1.5 rounded-full bg-status-ok" />
              </span>
              En vivo
            </span>
          </div>
          <Tabs.List
            aria-label="Vistas del panel LeadScope"
            activateOnFocus
            className="grid w-full grid-cols-2 gap-1 rounded-2xl bg-secondary p-1 sm:flex sm:w-auto sm:gap-0 sm:rounded-full"
          >
            <Tabs.Tab
              value="conversations"
              className="cursor-pointer rounded-xl px-3 py-1.5 text-center text-xs font-semibold whitespace-nowrap text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40 data-active:bg-card data-active:text-foreground data-active:shadow-xs sm:rounded-full dark:data-active:bg-white/12"
            >
              Conversaciones
            </Tabs.Tab>
            {HERO_SCENARIOS.map((scenario) => (
              <Tabs.Tab
                key={scenario.id}
                value={scenario.id}
                className="cursor-pointer rounded-xl px-3 py-1.5 text-center text-xs font-semibold whitespace-nowrap text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40 data-active:bg-card data-active:text-foreground data-active:shadow-xs sm:rounded-full dark:data-active:bg-white/12"
              >
                {scenario.label}
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </div>

        <Tabs.Panel
          value="conversations"
          keepMounted
          className="outline-none focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:ring-inset"
        >
          <ConversationsTablePreview
            onSelectScenario={(id) => setActiveTab(id)}
          />
        </Tabs.Panel>

        {HERO_SCENARIOS.map((scenario) => (
          <Tabs.Panel
            key={scenario.id}
            value={scenario.id}
            keepMounted
            className="outline-none focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:ring-inset"
          >
            <div className="grid motion-safe:animate-in motion-safe:duration-300 motion-safe:fade-in md:min-h-[23rem] md:grid-cols-[1.3fr_1fr]">
              <div className="flex flex-col gap-2.5 border-b bg-background/60 p-4 sm:p-5 md:border-r md:border-b-0">
                {scenario.messages.map((message, index) => (
                  <ChatBubble key={index} message={message} />
                ))}
              </div>
              <LeadPanel scenario={scenario} />
            </div>
          </Tabs.Panel>
        ))}
      </Tabs.Root>
    </div>
  );
}

function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative isolate overflow-hidden pt-[calc(var(--header-safe-top)+5.5rem)] pb-14 sm:pt-[calc(var(--header-safe-top)+6.75rem)] sm:pb-20"
    >
      {/* Full-bleed cobalt atmospheric sky canvas */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-20 bg-gradient-to-b from-[#2d33b8] via-[#494fdf] via-[62%] to-[#5d6bf5] dark:from-[#10154d] dark:via-[#22298c] dark:via-[62%] dark:to-[#313bb5]"
      />
      {/* Subtle 80px translucent architectural grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-100"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgb(255 255 255 / 0.07) 1px, transparent 1px), linear-gradient(to bottom, rgb(255 255 255 / 0.07) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
          maskImage:
            "linear-gradient(to bottom, black 0%, black 68%, transparent 100%)",
        }}
      />
      {/* Soft atmospheric radial cloud glows (CSS only) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 52rem 28rem at 50% -4rem, rgb(175 186 255 / 0.34), transparent 72%), radial-gradient(ellipse 40rem 20rem at 12% 76%, rgb(255 255 255 / 0.28), transparent 70%), radial-gradient(ellipse 44rem 22rem at 88% 80%, rgb(255 255 255 / 0.25), transparent 72%)",
        }}
      />
      {/* Soft bottom transition into the page surface (#ffffff in light, #03040b in dark) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-44 bg-gradient-to-b from-transparent via-card/65 to-card sm:h-52 dark:via-background/65 dark:to-background"
      />

      <Container>
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center text-white">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 py-1 pr-3.5 pl-1.5 text-xs font-medium text-white ring-1 ring-white/25 backdrop-blur-md">
            <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-semibold tracking-tight text-white">
              WhatsApp Oficial
            </span>
            <span>Agente IA entrenado con tus archivos</span>
          </span>

          <h1
            id="hero-title"
            className="mt-6 font-heading text-4xl leading-[1.03] font-semibold tracking-tight text-balance text-white sm:text-6xl lg:text-[4.25rem]"
          >
            Convierte tus chats de WhatsApp en clientes listos para cerrar
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-relaxed text-pretty text-white/85 sm:text-lg">
            LeadScope responde en segundos con tus propios PDFs y listas de
            precios, califica cada lead 24/7 y le entrega a tu equipo un resumen
            listo para llamar.
          </p>

          <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:justify-center">
            <a
              {...EXTERNAL_LINK}
              className={cn(
                buttonVariants({ size: "lg" }),
                "bg-[#0b0d17] text-white shadow-xl shadow-black/25 hover:bg-[#191c1f] focus-visible:ring-white/50",
              )}
            >
              <MessageCircleIcon data-icon="inline-start" />
              Pedir demo por WhatsApp
            </a>
            <a
              href="#producto"
              onClick={scrollToSection}
              className={cn(
                buttonVariants({ size: "lg" }),
                "bg-white/15 text-white ring-1 ring-white/25 backdrop-blur-md hover:bg-white/25 focus-visible:ring-white/50",
              )}
            >
              Ver cómo funciona
              <ArrowDownIcon data-icon="inline-end" />
            </a>
          </div>

          <ul className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-[13px] text-white/80">
            {TRUST_CHECKS.map((check) => (
              <li key={check} className="inline-flex items-center gap-1.5">
                <CheckIcon aria-hidden className="size-4 text-white/95" />
                {check}
              </li>
            ))}
          </ul>
        </div>

        <HeroPlatformWindow className="mt-12 sm:mt-14" />
      </Container>
    </section>
  );
}

function FeatureRowItem({ row }: { row: FeaturePreviewRow }) {
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="text-[13px] font-semibold break-words text-foreground">
          {row.title}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{row.detail}</p>
      </div>
      <Tag tone={row.tone}>{row.tag}</Tag>
    </li>
  );
}

function CheckerboardVisual({ block }: { block: FeatureBlock }) {
  return (
    <div className="relative isolate flex h-full min-h-[22rem] items-center justify-center overflow-hidden bg-gradient-to-br from-[#3f46d6] via-[#535ef0] to-[#8f9aff] p-6 sm:min-h-[28rem] sm:p-10 lg:p-12 dark:from-[#151a57] dark:via-[#232b8d] dark:to-[#3b47bd]">
      {/* Subtle architectural grid + soft cloud glow inside the cobalt panel */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 26rem 18rem at 15% 15%, rgb(255 255 255 / 0.24), transparent 70%), radial-gradient(ellipse 24rem 16rem at 85% 88%, rgb(255 255 255 / 0.22), transparent 72%)",
        }}
      />
      <div className="w-full max-w-md rounded-[1.25rem] bg-white/25 p-2 ring-1 ring-white/40 backdrop-blur-md shadow-[0_24px_60px_-20px_rgba(12,18,56,0.45)] sm:p-2.5 dark:bg-white/10 dark:ring-white/20">
        <div className="overflow-hidden rounded-[0.95rem] border bg-card text-card-foreground">
          <div className="flex items-center justify-between gap-2 border-b bg-muted/60 px-4 py-2.5">
            <span className="text-xs font-semibold tracking-tight text-foreground">
              {block.cardTitle}
            </span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary dark:bg-primary/15">
              {block.cardBadge}
            </span>
          </div>
          {block.chips ? (
            <ul
              aria-label="Ejemplos de temas prohibidos"
              className="flex flex-wrap gap-1.5 border-b bg-background/60 px-4 py-3"
            >
              {block.chips.map((topic) => (
                <li key={topic}>
                  <Tag tone="danger">{topic}</Tag>
                </li>
              ))}
            </ul>
          ) : null}
          <ul className="divide-y divide-border/70">
            {block.rows.map((row) => (
              <FeatureRowItem key={row.title} row={row} />
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function CheckerboardCopy({ block }: { block: FeatureBlock }) {
  return (
    <div className="flex h-full flex-col justify-center bg-card px-6 py-10 sm:px-10 sm:py-14 lg:px-16 lg:py-16 dark:bg-background">
      <p className="text-xs font-semibold tracking-[0.08em] text-primary uppercase">
        {block.kicker}
      </p>
      <h3 className="mt-3 font-heading text-2xl leading-[1.15] font-semibold tracking-tight text-balance sm:text-[2rem]">
        {block.title}
      </h3>
      <p className="mt-4 text-[15px] leading-relaxed text-pretty text-muted-foreground sm:text-base">
        {block.description}
      </p>
      <CheckList items={block.points} className="mt-6" />
      <div className="mt-7">
        <a
          {...EXTERNAL_LINK}
          className="inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-foreground transition-colors outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/40"
        >
          Pedir demo
          <ArrowRightIcon aria-hidden className="size-4" />
        </a>
      </div>
    </div>
  );
}

function ProductCheckerboard() {
  return (
    <section
      id="producto"
      tabIndex={-1}
      aria-labelledby="producto-title"
      className="scroll-mt-20 pt-14 pb-16 outline-none sm:pt-20 sm:pb-24"
    >
      <Container>
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-[0.08em] text-primary uppercase">
            Producto
          </p>
          <h2
            id="producto-title"
            className="mt-3 font-heading text-[1.85rem] leading-[1.12] font-semibold tracking-tight text-balance sm:text-4xl lg:text-[2.65rem]"
          >
            Un solo panel para tu asistente y tu equipo comercial
          </h2>
          <p className="mt-4 text-base leading-relaxed text-pretty text-muted-foreground sm:text-[17px]">
            Conversaciones naturales en WhatsApp, archivos siempre vigentes y
            control humano total en un flujo pensado para vender.
          </p>
        </div>

        {/* Alternating 50/50 editorial + frosted-glass checkerboard */}
        <div className="mt-12 overflow-hidden rounded-[1.5rem] border border-border/80 sm:mt-16">
          {FEATURE_BLOCKS.map((block, index) => {
            const visualRight = block.visualSide === "right";
            return (
              <div
                key={block.id}
                id={block.anchorId}
                tabIndex={block.anchorId ? -1 : undefined}
                className={cn(
                  "grid outline-none md:grid-cols-2",
                  block.anchorId ? "scroll-mt-24" : undefined,
                  index > 0 ? "border-t border-border/80" : undefined,
                )}
              >
                <div className={visualRight ? "md:order-2" : undefined}>
                  <CheckerboardVisual block={block} />
                </div>
                <div className={visualRight ? "md:order-1" : undefined}>
                  <CheckerboardCopy block={block} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Compact operational capabilities strip (Métricas y HubSpot opcional) */}
        <div className="mt-12 rounded-[1.5rem] border bg-background/70 p-6 sm:mt-16 sm:p-8 dark:bg-card/50">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold tracking-[0.08em] text-primary uppercase">
                Métricas y HubSpot opcional
              </p>
              <h3 className="mt-2 font-heading text-xl font-semibold tracking-tight sm:text-2xl">
                Operación medible desde el primer día
              </h3>
            </div>
            <a
              {...EXTERNAL_LINK}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition-colors outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/40"
            >
              Ver una demo guiada
              <ArrowRightIcon aria-hidden className="size-4" />
            </a>
          </div>
          <div className="mt-6 grid gap-6 border-t pt-6 md:grid-cols-3 md:gap-8">
            {OPERATIONAL_HIGHLIGHTS.map((item) => (
              <div key={item.title} className="flex flex-col">
                <p className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                  {item.value}
                </p>
                <h4 className="mt-2.5 text-[15px] font-semibold text-foreground">
                  {item.title}
                </h4>
                <p className="mt-1.5 text-sm leading-relaxed text-pretty text-muted-foreground">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}

function FaqList({ className }: { className?: string }) {
  const baseId = useId();
  const [open, setOpen] = useState<ReadonlySet<number>>(() => new Set([0]));

  function toggle(index: number) {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  return (
    <div className={cn("divide-y rounded-[1.25rem] border bg-card", className)}>
      {FAQ_ITEMS.map((item, index) => {
        const isOpen = open.has(index);
        const buttonId = `${baseId}-question-${index}`;
        const panelId = `${baseId}-answer-${index}`;
        return (
          <div key={item.question}>
            <h3>
              <button
                id={buttonId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(index)}
                className="flex w-full cursor-pointer items-center justify-between gap-4 rounded-[1.25rem] px-5 py-4 text-left text-[15px] font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/40 sm:px-6 sm:py-5 sm:text-base"
              >
                {item.question}
                <span
                  aria-hidden
                  className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground"
                >
                  {isOpen ? (
                    <MinusIcon className="size-4" />
                  ) : (
                    <PlusIcon className="size-4" />
                  )}
                </span>
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              hidden={!isOpen}
              className="px-5 pb-5 text-[15px] leading-relaxed text-pretty text-muted-foreground sm:px-6 sm:pr-16"
            >
              {item.answer}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ClosingBanner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-[1.5rem] bg-[#0b0d17] px-6 py-10 text-white ring-1 ring-white/10 sm:px-10 sm:py-12",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 36rem 20rem at 90% 0%, rgb(107 127 255 / 0.38), transparent 72%)",
        }}
      />
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl">
          <h2 className="font-heading text-2xl leading-tight font-semibold tracking-tight text-balance sm:text-3xl">
            Ve cómo respondería LeadScope con tus archivos
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-white/65">
            Hablemos 15 minutos por WhatsApp. Te mostramos la app por dentro y
            cotizamos según tu volumen.
          </p>
        </div>
        <a
          {...EXTERNAL_LINK}
          className={cn(
            buttonVariants({ size: "lg" }),
            "self-start bg-white text-[#191c1f] hover:bg-white/90 focus-visible:ring-white/50 md:self-auto",
          )}
        >
          Hablar por WhatsApp
          <ArrowRightIcon data-icon="inline-end" />
        </a>
      </div>
    </div>
  );
}

function FaqSection() {
  return (
    <section
      id="faq"
      tabIndex={-1}
      aria-labelledby="faq-title"
      className="scroll-mt-20 bg-background py-16 outline-none sm:py-24 dark:bg-card/40"
    >
      <Container>
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-[0.08em] text-primary uppercase">
            Preguntas frecuentes
          </p>
          <h2
            id="faq-title"
            className="mt-3 font-heading text-[1.75rem] leading-[1.15] font-semibold tracking-tight text-balance sm:text-4xl"
          >
            Lo que todo dueño pregunta antes de empezar
          </h2>
        </div>
        <FaqList className="mt-8" />
        <ClosingBanner className="mt-14 sm:mt-16" />
      </Container>
    </section>
  );
}

function LandingFooter() {
  const panel = usePanelLink();
  const linkClass =
    "rounded-md transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40";
  return (
    <footer className="border-t bg-card dark:bg-background">
      <Container className="flex flex-col gap-4 pt-8 pb-[max(2rem,var(--safe-bottom))] text-[13px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-2 font-heading text-sm font-semibold tracking-tight text-foreground">
            <AppLogo className="size-5" />
            LeadScope
          </span>
          <span>Contacto · {OWNER_CONTACT.name}</span>
        </div>
        <nav
          aria-label="Contacto y enlaces"
          className="flex flex-wrap items-center gap-x-5 gap-y-2"
        >
          <a href={OWNER_CONTACT.phoneHref} className={linkClass}>
            {OWNER_CONTACT.phoneDisplay}
          </a>
          <a {...EXTERNAL_LINK} className={linkClass}>
            WhatsApp
          </a>
          <a
            href={OWNER_CONTACT.linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            LinkedIn
          </a>
          <Link href={panel.href} className={linkClass}>
            {panel.label}
          </Link>
        </nav>
      </Container>
    </footer>
  );
}

/** The public page at `/`. Spanish, tú forms, no prices: every CTA is a WhatsApp chat. */
export function LandingPage() {
  const router = useRouter();
  const standalone = useIsStandalone();

  // Installed apps from before `start_url` moved to /threads still open `/` (iOS never refreshes it).
  useEffect(() => {
    if (standalone) router.replace("/threads");
  }, [standalone, router]);

  return (
    <div className="relative isolate min-h-dvh bg-card text-foreground dark:bg-background">
      <LandingHeader />
      <main>
        <Hero />
        <ProductCheckerboard />
        <FaqSection />
      </main>
      <LandingFooter />
    </div>
  );
}
