import { toast } from "sonner";
import type { InviteOutcome } from "./types";

/** One toast per invitation outcome. A failure stays until dismissed: it says what to fix. */
export function toastInvite(email: string, invite: InviteOutcome | null) {
  if (!invite) return;
  switch (invite.status) {
    case "sent":
      toast.success(`Invitación enviada a ${email}.`);
      return;
    case "linked":
      toast.success(`${email} quedó vinculado con su cuenta existente.`);
      return;
    case "reset_sent":
      toast.success(`Enlace para restablecer contraseña enviado a ${email}.`);
      return;
    case "failed":
      toast.error(`No se pudo invitar a ${email}`, {
        description: `${invite.message} Puedes reenviar la invitación desde la lista.`,
        duration: Infinity,
        closeButton: true,
      });
  }
}
