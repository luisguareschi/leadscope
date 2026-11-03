"use client";

import type { ReactNode } from "react";
import { cn } from "cn";
import { Label } from "@/components/ui/label";

export type Tone = "ok" | "warning" | "error" | "info" | "pending" | "muted";

/** A titled block of a page: heading, one line of context, and its actions. */
export function Section({
  title,
  description,
  actions,
  className,
  children,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("flex flex-col gap-5", className)}>
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="flex max-w-2xl flex-col gap-1">
          <h2 className="font-heading text-lg font-semibold tracking-tight">
            {title}
          </h2>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </header>
      {children}
    </section>
  );
}

/** A bordered group of rows, with an optional heading of its own. */
export function Panel({
  title,
  description,
  actions,
  className,
  headerClassName,
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  headerClassName?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "divide-y divide-border/70 overflow-hidden rounded-xl bg-card ring-1 ring-border/60 dark:ring-0",
        className,
      )}
    >
      {title ? (
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-3 px-5 py-4",
            headerClassName,
          )}
        >
          <div className="flex min-w-0 flex-col gap-0.5">
            <h3 className="font-heading text-[15px] font-semibold tracking-tight">
              {title}
            </h3>
            {description ? (
              <p className="text-[13px] text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex items-center gap-2">{actions}</div>
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

/** Label and hint on the left, the control on the right once `@container/content` has room. */
export function FieldRow({
  label,
  hint,
  htmlFor,
  error,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  htmlFor?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-x-10 gap-y-2.5 px-5 py-4 @3xl/content:grid-cols-[14rem_minmax(0,1fr)]">
      <div className="flex flex-col gap-1 @3xl/content:pt-2">
        <Label
          htmlFor={htmlFor}
          className={cn("leading-snug", error && "text-destructive")}
        >
          {label}
        </Label>
        {hint ? (
          <p className="text-[13px] leading-relaxed text-pretty text-muted-foreground">
            {hint}
          </p>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        {children}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

const DOT: Record<Tone, string> = {
  ok: "bg-status-ok",
  warning: "bg-primary",
  error: "bg-destructive",
  info: "bg-status-info",
  pending: "bg-transparent ring-[1.5px] ring-inset ring-primary",
  muted: "bg-muted-foreground/40",
};

export function StatusDot({
  tone,
  className,
}: {
  tone: Tone;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        DOT[tone],
        className,
      )}
    />
  );
}

export function StatusPill({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        className,
      )}
    >
      <StatusDot tone={tone} className="size-1.5" />
      {children}
    </span>
  );
}

const TEXT: Record<Tone, string> = {
  ok: "text-status-ok",
  warning: "text-primary",
  error: "text-destructive",
  info: "text-foreground",
  pending: "text-foreground",
  muted: "text-muted-foreground",
};

/** A status as coloured words, like the Estado column of Revolut's transaction lists. */
export function StatusText({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center text-[13px] whitespace-nowrap",
        TEXT[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function InlineCode({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[12px] text-foreground">
      {children}
    </code>
  );
}

const NOTICE: Record<"warning" | "error" | "neutral", string> = {
  warning:
    "bg-card ring-border/60 dark:ring-0 [&_[data-slot=notice-icon]]:bg-primary/15 [&_[data-slot=notice-icon]]:text-primary",
  error:
    "bg-card ring-destructive/30 dark:ring-destructive/25 [&_[data-slot=notice-icon]]:bg-destructive/15 [&_[data-slot=notice-icon]]:text-destructive",
  neutral:
    "bg-card ring-border/60 dark:ring-0 [&_[data-slot=notice-icon]]:bg-muted [&_[data-slot=notice-icon]]:text-muted-foreground",
};

/** A state the operator should act on: what happened, and the one action that fixes it. */
export function Notice({
  tone,
  icon,
  title,
  children,
  action,
}: {
  tone: "warning" | "error" | "neutral";
  icon: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      role={tone === "neutral" ? undefined : "alert"}
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl p-4 ring-1",
        NOTICE[tone],
      )}
    >
      <div className="flex min-w-0 flex-1 basis-72 gap-3">
        <span
          data-slot="notice-icon"
          className="flex size-10 shrink-0 items-center justify-center rounded-full [&_svg]:size-5"
        >
          {icon}
        </span>
        <div className="flex min-w-0 flex-col justify-center gap-0.5 self-center">
          <p className="text-sm font-semibold">{title}</p>
          {children ? (
            <div className="text-[13px] leading-relaxed text-muted-foreground">
              {children}
            </div>
          ) : null}
        </div>
      </div>
      {action ? <div className="flex shrink-0 gap-2">{action}</div> : null}
    </div>
  );
}
