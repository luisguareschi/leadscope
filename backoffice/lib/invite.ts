import { toast } from "sonner";
import type { InviteOutcome } from "./types";

/** One toast per invitation outcome. A failure stays until dismissed: it says what to fix. */
export function toastInvite(email: string, invite: InviteOutcome | null) {
  if (!invite) return;
  switch (invite.status) {
    case "sent":
      toast.success(
        `Invitación enviada a ${email}. El enlace lo lleva a elegir su contraseña.`,
      );
      return;
    case "linked":
      toast.success(
        `${email} ya tenía usuario: quedó vinculado y entra con su contraseña de siempre.`,
      );
      return;
    case "reset_sent":
      toast.success(
        `${email} ya tenía contraseña. Le enviamos un enlace para elegir una nueva.`,
      );
      return;
    case "failed":
      toast.error(`No se pudo invitar a ${email}`, {
        description: `${invite.message} Podés reenviar la invitación desde la lista de operadores.`,
        duration: Infinity,
        closeButton: true,
      });
  }
}
