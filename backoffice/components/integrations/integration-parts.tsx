"use client";

import { useState, type ReactNode } from "react";
import {
  CheckCircle2Icon,
  ChevronRightIcon,
  CircleMinusIcon,
  CopyIcon,
  ExternalLinkIcon,
  PlugZapIcon,
  TriangleAlertIcon,
  XCircleIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { FieldRow, StatusDot, type Tone } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import type {
  ConnectionCheckStatus,
  IntegrationCheckResult,
} from "@/lib/types";

const STATUS_ICON: Record<ConnectionCheckStatus, ReactNode> = {
  ok: <CheckCircle2Icon className="size-4 text-status-ok" />,
  warning: <TriangleAlertIcon className="size-4 text-primary" />,
  error: <XCircleIcon className="size-4 text-destructive" />,
  skipped: <CircleMinusIcon className="size-4 text-muted-foreground" />,
};

export function copyText(text: string, done: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success(done),
    () => toast.error("No se pudo copiar."),
  );
}

/** The outcome of Probar conexión, one line per check, failures in red. */
export function CheckResults({
  result,
  readyText,
}: {
  result: IntegrationCheckResult;
  /** What "ready" means for this integration. */
  readyText: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col gap-3 px-5 py-4",
        result.ready ? "bg-status-ok/5" : "bg-destructive/5",
      )}
    >
      <p className="text-sm font-medium">
        {result.ready
          ? readyText
          : "Todavía no está listo. Corrige lo marcado en rojo y prueba de nuevo."}
      </p>
      <ul className="flex flex-col gap-2">
        {result.checks.map((check) => (
          <li key={check.id} className="flex gap-2 text-[13px]">
            <span className="mt-0.5 shrink-0">{STATUS_ICON[check.status]}</span>
            <span>
              <span className="font-medium">{check.label}.</span>{" "}
              <span className="text-muted-foreground">{check.detail}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A panel's status pill and its Probar conexión button. */
export function TestActions({
  status,
  pending,
  onTest,
}: {
  status: { tone: Tone; label: string };
  pending: boolean;
  onTest: () => void;
}) {
  return (
    <>
      <span className="flex items-center gap-2 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium">
        <StatusDot tone={status.tone} />
        {status.label}
      </span>
      <Button variant="outline" size="sm" onClick={onTest} disabled={pending}>
        {pending ? <Spinner /> : <PlugZapIcon />}
        Probar conexión
      </Button>
    </>
  );
}

/** The pill before and after a test: a fresh result wins over what is merely saved. */
export function testStatus(
  result: IntegrationCheckResult | undefined,
  missing: number | null,
): { tone: Tone; label: string } {
  if (result)
    return result.ready
      ? { tone: "ok", label: "Conectado" }
      : { tone: "error", label: "Con problemas" };
  if (missing === null) return { tone: "muted", label: "Cargando" };
  if (missing > 0)
    return {
      tone: "warning",
      label: missing === 1 ? "Falta 1 dato" : `Faltan ${missing} datos`,
    };
  return { tone: "muted", label: "Sin probar" };
}

export function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-3">
      <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 font-mono text-[11px] font-semibold text-primary">
        {n}
      </span>
      <div className="flex flex-col gap-1 pt-0.5 text-[13px] leading-relaxed">
        <span className="font-medium text-foreground">{title}</span>
        <div className="flex flex-col gap-1.5 text-muted-foreground">
          {children}
        </div>
      </div>
    </li>
  );
}

export function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
    >
      {children}
      <ExternalLinkIcon className="size-3" />
    </a>
  );
}

/** The collapsible step-by-step guide at the bottom of a provider's panel. */
export function Guide({
  title = "Guía de conexión paso a paso",
  defaultOpen,
  children,
}: {
  title?: string;
  /** Open until what the guide sets up is in place; then the operator decides. */
  defaultOpen: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState<boolean | null>(null);
  const shown = open ?? defaultOpen;
  return (
    <div>
      <button
        type="button"
        aria-expanded={shown}
        onClick={() => setOpen(!shown)}
        className="flex w-full items-center gap-2 px-5 py-3 text-left text-sm font-medium transition-colors hover:bg-muted/40"
      >
        <ChevronRightIcon
          className={cn(
            "size-4 text-muted-foreground transition-transform",
            shown && "rotate-90",
          )}
        />
        {title}
      </button>
      {shown ? (
        <div className="flex flex-col gap-6 border-t border-border/70 bg-muted/50 px-5 py-5">
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** A URL to paste in another system, with a copy button. */
export function CopyRow({
  label,
  hint,
  value,
  copyLabel,
  children,
}: {
  label: string;
  hint: ReactNode;
  value: string | null;
  copyLabel: string;
  children?: ReactNode;
}) {
  return (
    <FieldRow label={label} hint={hint}>
      {value ? (
        <div className="flex min-w-0 gap-2">
          <code className="flex h-9 min-w-0 flex-1 items-center truncate rounded-md border border-(--field-border) bg-(--field) px-3 font-mono text-xs">
            {value}
          </code>
          <Button
            variant="outline"
            size="icon"
            aria-label={copyLabel}
            onClick={() => copyText(value, "URL copiada.")}
          >
            <CopyIcon />
          </Button>
        </div>
      ) : (
        <Skeleton className="h-9 w-full" />
      )}
      {children}
    </FieldRow>
  );
}

export function RowSkeleton() {
  return (
    <div className="px-5 py-4">
      <Skeleton className="h-9 w-full" />
    </div>
  );
}
