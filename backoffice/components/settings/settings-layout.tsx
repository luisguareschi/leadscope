"use client";

import type { ReactNode } from "react";
import { cn } from "cn";
import { Label } from "@/components/ui/label";

export function SettingsSection({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="flex max-w-2xl flex-col gap-1">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex items-center gap-2">{actions}</div>
        ) : null}
      </header>
      {children}
    </section>
  );
}

/** A bordered group of rows, with an optional heading of its own. */
export function SettingsPanel({
  title,
  description,
  actions,
  className,
  children,
}: {
  title?: string;
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
          <div className="flex flex-col gap-0.5">
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

/** Label and hint on the left, the control on the right once there is room. */
export function SettingsRow({
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
    <div className="grid gap-x-10 gap-y-2.5 px-5 py-4 @3xl/settings:grid-cols-[14rem_minmax(0,1fr)]">
      <div className="flex flex-col gap-1 @3xl/settings:pt-2">
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

export function StatusDot({
  tone,
  className,
}: {
  tone: "ok" | "warning" | "error" | "muted" | "pending";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        tone === "ok" && "bg-emerald-500",
        tone === "warning" && "bg-amber-500",
        tone === "error" && "bg-destructive",
        tone === "muted" && "bg-muted-foreground/40",
        tone === "pending" && "bg-primary",
        className,
      )}
    />
  );
}

export function InlineCode({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[12px] text-foreground">
      {children}
    </code>
  );
}
