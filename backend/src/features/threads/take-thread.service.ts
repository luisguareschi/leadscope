import type { AppContext } from "../../context.js";
import { badRequest } from "../../lib/http-error.js";
import { assignThread } from "./assign-thread.service.js";

/** Tomar: the signed-in operator takes the lead, from nobody or from another operator. */
export async function takeThread(
  ctx: AppContext,
  companyId: string,
  threadId: string,
  operatorId: string | null,
) {
  if (!operatorId)
    throw badRequest(
      "Entraste como administrador y no sos operador de esta empresa: usá Asignar a… para elegir uno.",
      "no_operator",
    );
  return assignThread(ctx, companyId, threadId, operatorId);
}
