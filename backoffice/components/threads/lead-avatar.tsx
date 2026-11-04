import { FileTextIcon, MessageCircleIcon } from "lucide-react";
import { cn } from "cn";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import type { Thread } from "@/lib/types";

/** Initials with a corner badge for where the lead came from, like Revolut's transaction icons. */
export function LeadAvatar({
  thread,
  className,
}: {
  thread: Pick<Thread, "name" | "phone" | "source">;
  className?: string;
}) {
  const form = thread.source === "form";
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <Avatar className="size-full">
        <AvatarFallback className="text-[13px]">
          {initials(thread.name ?? thread.phone.slice(-2))}
        </AvatarFallback>
      </Avatar>
      <span
        title={form ? "Llegó por un formulario" : "Llegó por WhatsApp"}
        aria-label={form ? "Llegó por un formulario" : "Llegó por WhatsApp"}
        className={cn(
          "absolute -right-1 -bottom-1 flex size-4.5 items-center justify-center rounded-full ring-2 ring-(--avatar-ring,var(--card)) [&_svg]:size-2.5",
          form
            ? "bg-primary text-primary-foreground"
            : "bg-foreground text-background",
        )}
      >
        {form ? (
          <FileTextIcon strokeWidth={2.5} />
        ) : (
          <MessageCircleIcon strokeWidth={2.5} />
        )}
      </span>
    </span>
  );
}
