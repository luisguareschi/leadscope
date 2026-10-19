import { CircleAlertIcon, CircleCheckIcon, ClockIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatDateTime } from "@/lib/format";
import type { Thread } from "@/lib/types";

export function crmLabel(crm: Thread["crm"]): string {
  switch (crm.status) {
    case "synced":
      return `Guardado en HubSpot (${formatDateTime(crm.syncedAt)})`;
    case "pending":
      return "Guardando en HubSpot…";
    case "failed":
      return `No se pudo guardar en HubSpot: ${crm.lastError ?? "error desconocido"}`;
    case "none":
      return "Todavía no se guardó en HubSpot";
  }
}

/** A dash until there is a HubSpot write to report; a failure is the only loud state. */
export function CrmIndicator({ crm }: { crm: Thread["crm"] }) {
  if (crm.status === "none")
    return (
      <span className="text-muted-foreground/60" aria-label={crmLabel(crm)}>
        —
      </span>
    );
  const icon =
    crm.status === "synced" ? (
      <CircleCheckIcon className="size-4 text-muted-foreground/70" />
    ) : crm.status === "failed" ? (
      <CircleAlertIcon className="size-4 text-destructive" />
    ) : (
      <ClockIcon className="size-4 text-muted-foreground" />
    );
  return (
    <Tooltip>
      <TooltipTrigger
        render={<span className="inline-flex" aria-label={crmLabel(crm)} />}
      >
        {icon}
      </TooltipTrigger>
      <TooltipContent>{crmLabel(crm)}</TooltipContent>
    </Tooltip>
  );
}
