import type { AppContext } from "../../context.js";
import { conflict, notFound } from "../../lib/http-error.js";
import { setAssistantPaused } from "../settings/set-assistant-paused.service.js";
import { companySelect, toCompanyDto } from "./company-dto.js";

/** Platform admin toggles a company's assistant pause directly from Empresas. */
export async function setCompanyAssistantPaused(
  ctx: AppContext,
  companyId: string,
  paused: boolean,
  actorEmail: string,
) {
  const existing = await ctx.db.company.findUnique({
    where: { id: companyId },
    select: { id: true, archivedAt: true },
  });
  if (!existing) throw notFound("Empresa no encontrada");
  if (existing.archivedAt) {
    throw conflict(
      "Esta empresa está archivada. Restáurala antes de cambiar el estado del asistente.",
      "company_archived",
    );
  }
  await setAssistantPaused(ctx, companyId, paused, actorEmail);
  return toCompanyDto(
    await ctx.db.company.findUniqueOrThrow({
      where: { id: companyId },
      select: companySelect,
    }),
  );
}
