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
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { cn } from "cn";
import { AppLogo } from "@/components/app-logo";
import {
  FAQ_ITEMS,
  FORBIDDEN_TOPIC_EXAMPLES,
  HERO_SCENARIOS,
  PRODUCT_TABS,
  WHATSAPP_DEMO_URL,
  type HeroMessage,
  type HeroScenario,
  type ProductRowTone,
  type ProductTab,
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

const TONE_CLASS: Record<ProductRowTone, string> = {
  accent: "bg-primary/10 text-primary dark:bg-primary/15",
  ok: "bg-status-ok/12 text-[color:color-mix(in_oklch,var(--status-ok),black_32%)] dark:bg-status-ok/15 dark:text-status-ok",
  neutral: "bg-secondary text-muted-foreground",
  danger: "bg-destructive/10 text-destructive dark:bg-destructive/15",
};

const EXTERNAL_LINK = {
  href: WHATSAPP_DEMO_URL,
  target: "_blank",
  rel: "noopener noreferrer",
} as const;

const SECTION_SPACING = "scroll-mt-16 py-16 outline-none sm:py-24";
/** Bands alternate: the page surface (white, or the dark canvas), then this grey one. */
const GREY_BAND = "bg-background dark:bg-card/40";

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
        "mx-auto w-full max-w-5xl pr-[max(1rem,var(--safe-right))] pl-[max(1rem,var(--safe-left))] sm:pr-[max(1.5rem,var(--safe-right))] sm:pl-[max(1.5rem,var(--safe-left))]",
        className,
      )}
    >
      {children}
    </div>
  );
}

function SectionHeading({
  id,
  kicker,
  title,
  description,
}: {
  id: string;
  kicker: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-xs font-semibold tracking-[0.08em] text-primary uppercase">
        {kicker}
      </p>
      <h2
        id={id}
        className="mt-3 font-heading text-[1.75rem] leading-[1.15] font-semibold tracking-tight text-balance sm:text-4xl"
      >
        {title}
      </h2>
      {description ? (
        <p className="mt-3 text-base leading-relaxed text-pretty text-muted-foreground sm:text-[17px]">
          {description}
        </p>
      ) : null}
    </div>
  );
}

function Tag({
  tone,
  className,
  children,
}: {
  tone: ProductRowTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap",
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

/** A row the way the panel lists threads, files, and metrics. */
function UiRow({ row }: { row: ProductTab["rows"][number] }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border bg-card px-3.5 py-3">
      <div className="min-w-0">
        <p className="text-[13px] font-semibold break-words">{row.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{row.detail}</p>
      </div>
      <Tag tone={row.tone}>{row.tag}</Tag>
    </li>
  );
}

function UiPreview({
  rows,
  className,
  children,
}: {
  rows: ProductTab["rows"];
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-background/60 p-3 sm:p-4 dark:bg-background/50",
        className,
      )}
    >
      {children}
      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <UiRow key={row.title} row={row} />
        ))}
      </ul>
    </div>
  );
}

function LandingHeader() {
  const panel = usePanelLink();
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-card/80 pt-[var(--header-safe-top)] backdrop-blur-xl dark:bg-background/75">
      <Container className="flex h-14 items-center justify-between gap-3">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-lg font-heading text-[15px] font-semibold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
        >
          <AppLogo className="size-6" />
          LeadScope
        </Link>
        <nav
          aria-label="Secciones"
          className="hidden items-center gap-7 text-[13px] font-medium text-muted-foreground md:flex"
        >
          {SECTION_LINKS.map((link) => (
            <a
              key={link.id}
              href={`#${link.id}`}
              onClick={scrollToSection}
              className="rounded-md transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-1 sm:gap-2">
          <ThemeToggle />
          <Link
            href={panel.href}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "px-2.5 text-muted-foreground sm:px-3.5",
            )}
          >
            {panel.label}
          </Link>
          <a {...EXTERNAL_LINK} className={buttonVariants({ size: "sm" })}>
            Pedir demo
          </a>
        </div>
      </Container>
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary dark:bg-primary/15">
          <span aria-hidden className="size-1.5 rounded-full bg-primary" />
          {scenario.stage}
        </span>
        <Tag tone="ok" className="px-2.5 py-1">
          {scenario.status}
        </Tag>
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

function HeroDemo({ className }: { className?: string }) {
  return (
    <Tabs.Root
      defaultValue={HERO_SCENARIOS[0].id}
      className={cn(
        "overflow-hidden rounded-[1.25rem] border bg-card text-left shadow-[0_24px_60px_-24px_rgb(25_28_31/0.22)] dark:shadow-[0_24px_60px_-24px_rgb(0_0_0/0.7)]",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/60 px-4 py-3 sm:px-5">
        <p className="inline-flex items-center gap-2 text-[13px] font-semibold">
          <span aria-hidden className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-status-ok opacity-60 motion-reduce:hidden" />
            <span className="relative inline-flex size-2 rounded-full bg-status-ok" />
          </span>
          Así trabaja LeadScope en tiempo real
        </p>
        <Tabs.List
          aria-label="Elegir rubro"
          activateOnFocus
          className="flex w-full rounded-full bg-secondary p-1 sm:w-auto"
        >
          {HERO_SCENARIOS.map((scenario) => (
            <Tabs.Tab
              key={scenario.id}
              value={scenario.id}
              className="flex-1 cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40 data-active:bg-card data-active:text-foreground data-active:shadow-xs sm:flex-none dark:data-active:bg-white/12"
            >
              {scenario.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </div>
      {HERO_SCENARIOS.map((scenario) => (
        <Tabs.Panel
          key={scenario.id}
          value={scenario.id}
          keepMounted
          className="outline-none focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:ring-inset"
        >
          <div className="grid motion-safe:animate-in motion-safe:duration-300 motion-safe:fade-in md:min-h-[22rem] md:grid-cols-[1.3fr_1fr]">
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
  );
}

function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="pt-12 pb-16 sm:pt-20 sm:pb-24"
    >
      <Container>
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <span className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-[11px] font-semibold text-primary sm:text-xs dark:bg-card">
            <span
              aria-hidden
              className="size-1.5 shrink-0 rounded-full bg-status-ok"
            />
            Agente IA en WhatsApp oficial para equipos de ventas
          </span>
          <h1
            id="hero-title"
            className="mt-5 font-heading text-[2.125rem] leading-[1.06] font-semibold tracking-tight text-balance sm:text-5xl lg:text-[3.5rem]"
          >
            Convierte tus chats de WhatsApp en clientes listos para cerrar
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">
            LeadScope responde en segundos usando tus propios PDFs y listas de
            precios, califica cada lead 24/7 y le entrega a tus vendedores un
            resumen listo para llamar.
          </p>
          <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:justify-center">
            <a
              {...EXTERNAL_LINK}
              className={cn(
                buttonVariants({ variant: "accent", size: "lg" }),
                "shadow-lg shadow-primary/25",
              )}
            >
              <MessageCircleIcon data-icon="inline-start" />
              Pedir demo por WhatsApp
            </a>
            <a
              href="#producto"
              onClick={scrollToSection}
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              Ver cómo funciona
              <ArrowDownIcon data-icon="inline-end" />
            </a>
          </div>
          <ul className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-[13px] text-muted-foreground">
            {TRUST_CHECKS.map((check) => (
              <li key={check} className="inline-flex items-center gap-1.5">
                <CheckIcon aria-hidden className="size-4 text-status-ok" />
                {check}
              </li>
            ))}
          </ul>
        </div>
        <HeroDemo className="mt-12 sm:mt-16" />
      </Container>
    </section>
  );
}

function ProductSection() {
  return (
    <section
      id="producto"
      tabIndex={-1}
      aria-labelledby="producto-title"
      className={cn(SECTION_SPACING, GREY_BAND)}
    >
      <Container>
        <SectionHeading
          id="producto-title"
          kicker="Producto"
          title="Un solo panel para tu asistente y tu equipo comercial"
          description="Explora las cuatro piezas que reemplazan a los chatbots rígidos de opciones."
        />
        <Tabs.Root defaultValue={PRODUCT_TABS[0].id} className="mt-8">
          <Tabs.List
            aria-label="Piezas del producto"
            activateOnFocus
            className="flex flex-wrap gap-2"
          >
            {PRODUCT_TABS.map((tab) => (
              <Tabs.Tab
                key={tab.id}
                value={tab.id}
                className="cursor-pointer rounded-full border bg-card px-4 py-2 text-[13px] font-semibold text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40 data-active:border-foreground data-active:bg-foreground data-active:text-background"
              >
                {tab.label}
              </Tabs.Tab>
            ))}
          </Tabs.List>
          {PRODUCT_TABS.map((tab) => (
            <Tabs.Panel
              key={tab.id}
              value={tab.id}
              keepMounted
              className="mt-5 rounded-[1.25rem] border bg-card outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
            >
              <div className="grid items-center gap-8 p-5 motion-safe:animate-in motion-safe:duration-300 motion-safe:fade-in sm:p-8 md:grid-cols-[1fr_1.25fr] md:gap-10">
                <div>
                  <h3 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">
                    {tab.title}
                  </h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-pretty text-muted-foreground">
                    {tab.description}
                  </p>
                  <CheckList items={tab.points} className="mt-5" />
                </div>
                <UiPreview rows={tab.rows} />
              </div>
            </Tabs.Panel>
          ))}
        </Tabs.Root>
      </Container>
    </section>
  );
}

function BentoCard({
  title,
  body,
  className,
  children,
}: {
  title: string;
  body: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col justify-between gap-6 rounded-[1.25rem] border bg-background/60 p-5 sm:p-6 dark:bg-card",
        className,
      )}
    >
      <div>
        <h3 className="font-heading text-lg font-semibold tracking-tight">
          {title}
        </h3>
        <p className="mt-2 text-[15px] leading-relaxed text-pretty text-muted-foreground">
          {body}
        </p>
      </div>
      {children}
    </div>
  );
}

function ControlSection() {
  return (
    <section
      id="control"
      tabIndex={-1}
      aria-labelledby="control-title"
      className={SECTION_SPACING}
    >
      <Container>
        <SectionHeading
          id="control-title"
          kicker="Control y confianza"
          title="IA con límites claros. Nunca inventa precios ni interrumpe a tus asesores."
          description="Diseñado para equipos que cuidan su reputación en cada conversación."
        />
        <div className="mt-10 grid gap-4 md:grid-cols-[1.25fr_1fr]">
          <BentoCard
            title="Temas prohibidos y desvío automático"
            body="Escribes en español normal qué temas no debe responder (por ejemplo, garantías de rentabilidad o reclamos). Si el cliente pregunta por uno, el bot se detiene al instante y marca el hilo para tu equipo."
            className="md:col-span-2 md:grid md:grid-cols-[1.2fr_1fr] md:items-center md:gap-10"
          >
            <UiPreview
              rows={[
                {
                  title: "Tema prohibido detectado",
                  detail: "Asistente detenido · Requiere asesor",
                  tag: "Requiere asesor",
                  tone: "accent",
                },
              ]}
            >
              <ul
                aria-label="Ejemplos de temas prohibidos"
                className="mb-3 flex flex-wrap gap-1.5"
              >
                {FORBIDDEN_TOPIC_EXAMPLES.map((topic) => (
                  <li key={topic}>
                    <Tag tone="danger">{topic}</Tag>
                  </li>
                ))}
              </ul>
            </UiPreview>
          </BentoCard>
          <BentoCard
            title="Un asesor escribe, el bot se pausa solo"
            body="Tu equipo puede responder desde LeadScope con el número de la empresa. Al enviar un mensaje, el bot se pausa automáticamente en ese chat."
          >
            <UiPreview
              rows={[
                {
                  title: "Enviado por Sofía",
                  detail: "Asistente pausado en este hilo",
                  tag: "Pausado",
                  tone: "neutral",
                },
              ]}
            />
          </BentoCard>
          <BentoCard
            title="Prueba cambios antes de salir en vivo"
            body="En Probar asistente simulas un cliente contra tus borradores de instrucciones sin escribirle a nadie ni tocar tu WhatsApp real."
          >
            <UiPreview
              rows={[
                {
                  title: "Probar borrador",
                  detail: "Sin impacto en producción",
                  tag: "Activo",
                  tone: "ok",
                },
              ]}
            />
          </BentoCard>
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
      className={cn(SECTION_SPACING, GREY_BAND)}
    >
      <Container>
        <SectionHeading
          id="faq-title"
          kicker="Preguntas frecuentes"
          title="Lo que todo dueño pregunta antes de empezar"
        />
        <FaqList className="mt-8" />
        <ClosingBanner className="mt-14 sm:mt-16" />
      </Container>
    </section>
  );
}

function LandingFooter() {
  const panel = usePanelLink();
  return (
    <footer className="border-t">
      <Container className="flex flex-col gap-4 pt-8 pb-[max(2rem,var(--safe-bottom))] text-[13px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span className="flex items-center gap-2 font-heading text-sm font-semibold tracking-tight text-foreground">
          <AppLogo className="size-5" />
          LeadScope
        </span>
        <nav aria-label="Enlaces" className="flex items-center gap-6">
          <Link
            href={panel.href}
            className="rounded-md transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40"
          >
            {panel.label}
          </Link>
          <a
            {...EXTERNAL_LINK}
            className="rounded-md transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40"
          >
            WhatsApp
          </a>
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
    <div className="relative isolate min-h-dvh bg-card text-foreground [--landing-glow:color-mix(in_oklch,var(--primary)_13%,transparent)] dark:bg-background dark:[--landing-glow:color-mix(in_oklch,var(--primary)_22%,transparent)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[44rem]"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 64rem 28rem at 50% -6rem, var(--landing-glow), transparent 70%)",
        }}
      />
      <LandingHeader />
      <main>
        <Hero />
        <ProductSection />
        <ControlSection />
        <FaqSection />
      </main>
      <LandingFooter />
    </div>
  );
}
