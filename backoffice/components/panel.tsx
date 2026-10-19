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
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
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
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "divide-y overflow-hidden rounded-xl border bg-card shadow-xs",
        className,
      )}
    >
      {title ? (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/40 px-5 py-3.5">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h3 className="text-sm font-medium">{title}</h3>
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
  ok: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-destructive",
  info: "bg-sky-500",
  pending: "bg-primary",
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
        "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border bg-background px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        className,
      )}
    >
      <StatusDot tone={tone} className="size-1.5" />
      {children}
    </span>
  );
}

export function InlineCode({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[12px] text-foreground">
      {children}
    </code>
  );
}

const NOTICE: Record<"warning" | "error" | "neutral", string> = {
  warning:
    "border-amber-500/30 bg-amber-500/5 [&_[data-slot=notice-icon]]:text-amber-600",
  error:
    "border-destructive/30 bg-destructive/5 [&_[data-slot=notice-icon]]:text-destructive",
  neutral: "bg-card [&_[data-slot=notice-icon]]:text-muted-foreground",
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
        "flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border px-4 py-3 shadow-xs",
        NOTICE[tone],
      )}
    >
      <div className="flex min-w-0 flex-1 basis-72 gap-3">
        <span
          data-slot="notice-icon"
          className="mt-0.5 shrink-0 [&_svg]:size-4"
        >
          {icon}
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-sm font-medium">{title}</p>
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
