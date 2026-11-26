"use client";

import { usePathname } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import {
  pausedByDetail,
  useToggleAssistantPaused,
} from "@/components/assistant-pause-dialog";
import { HelpTip } from "@/components/help-tip";
import { NavUser } from "@/components/nav-user";
import { StatusDot } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useMe } from "@/lib/queries";
import { leaveCompany } from "@/lib/support";
import { cn } from "cn";

function titleFor(pathname: string, platformAdmin: boolean): string {
  if (pathname.startsWith("/metrics")) return "Métricas";
  if (pathname.startsWith("/knowledge")) return "Conocimiento";
  if (pathname.startsWith("/probar")) return "Probar asistente";
  if (pathname.startsWith("/settings")) return "Configuración";
  if (pathname.startsWith("/companies"))
    return platformAdmin ? "Empresas" : "Sin acceso";
  return "Conversaciones";
}

function AssistantPausedButton({
  pausedAt,
  pausedByEmail,
}: {
  pausedAt: string | null;
  pausedByEmail: string | null;
}) {
  const { toggle, isPending } = useToggleAssistantPaused();
  const detail = pausedByDetail(pausedAt, pausedByEmail);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            size="sm"
            variant="destructive"
            disabled={isPending}
            onClick={() => toggle(false)}
            aria-label="Asistente pausado. Reanudar asistente"
          />
        }
      >
        {isPending ? <Spinner /> : <StatusDot tone="error" />}
        <span className="hidden sm:inline">Asistente pausado</span>
        <span className="sm:hidden">Pausado</span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-72">
        {`Asistente pausado para toda la empresa.${detail ? ` ${detail}` : ""} Haz clic para reanudar.`}
      </TooltipContent>
    </Tooltip>
  );
}

export function SiteHeader({ className }: { className?: string }) {
  const pathname = usePathname();
  const me = useMe();
  const company = me.data?.company;
  const hasCompany = Boolean(company);
  const supportAccess = me.data?.supportAccess === true;
  const title = titleFor(pathname, me.data?.platformAdmin === true);

  return (
    <header
      className={cn(
        "flex shrink-0 flex-col justify-center pt-[var(--safe-top)] transition-[width,height] ease-linear",
        className,
      )}
    >
      <div className="mx-auto grid min-h-14 w-full max-w-350 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 md:h-(--header-height) lg:px-6">
        <div className="flex min-w-0 items-center gap-0.5">
          <h1 className="truncate font-heading text-[22px] font-medium tracking-tight lg:text-2xl">
            {title}
          </h1>
          {pathname.startsWith("/metrics") ? (
            <HelpTip label="Cómo se cuentan las métricas">
              Cada lead se cuenta el día de su primer mensaje, con su etapa
              actual. &quot;Ahora mismo&quot; muestra el estado actual sin
              filtro de fechas.
            </HelpTip>
          ) : null}
        </div>
        <div className="flex items-center justify-end gap-2">
          {company?.assistantPaused ? (
            <AssistantPausedButton
              pausedAt={company.assistantPausedAt}
              pausedByEmail={company.assistantPausedByEmail}
            />
          ) : null}
          {/* From md the sidebar's support bar is the way back. */}
          {supportAccess ? (
            <Button
              size="sm"
              variant="secondary"
              className="h-9 rounded-full bg-primary/12 px-3 text-primary hover:bg-primary/18 md:hidden"
              aria-label={`Viendo como administrador: ${company?.name ?? ""}. Volver a Empresas`}
              onClick={leaveCompany}
            >
              <ArrowLeftIcon />
              Empresas
            </Button>
          ) : null}
          {/* A 44px touch target on phones around the 36px avatar. */}
          <div className="flex max-md:*:data-[slot=dropdown-menu-trigger]:-m-1 max-md:*:data-[slot=dropdown-menu-trigger]:p-1">
            <NavUser
              email={me.data?.operator?.email ?? ""}
              label={
                hasCompany && !supportAccess ? "Operador" : "Administración"
              }
            />
          </div>
        </div>
      </div>
    </header>
  );
}
