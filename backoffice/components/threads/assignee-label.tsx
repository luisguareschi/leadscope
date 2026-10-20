import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { operatorName } from "@/lib/thread-status";
import type { Thread } from "@/lib/types";

/** Who has the lead: "Vos" for the signed-in operator, "Sin asignar" for nobody. */
export function AssigneeLabel({
  assignee,
  myEmail,
}: {
  assignee: Thread["assignee"];
  myEmail: string | null;
}) {
  if (!assignee)
    return <span className="text-xs text-muted-foreground">Sin asignar</span>;
  const mine = assignee.email === myEmail;
  return (
    <span
      className="flex min-w-0 items-center gap-1.5 text-[13px]"
      title={assignee.email}
    >
      <Avatar className="size-5">
        <AvatarFallback className="text-[9px]">
          {initials(assignee.email)}
        </AvatarFallback>
      </Avatar>
      <span className="truncate">
        {mine ? "Vos" : operatorName(assignee.email)}
      </span>
      {assignee.archived ? (
        <span className="shrink-0 text-[11px] text-muted-foreground">
          (archivado)
        </span>
      ) : null}
    </span>
  );
}
