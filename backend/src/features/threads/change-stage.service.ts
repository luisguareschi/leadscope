import { parseCompanyConfig } from "../../companies/company-config.js";
import type { AppContext } from "../../context.js";
import { crmRequest } from "../../conversation/crm-sync.js";
import { findStage, isClosedStage } from "../../engine/stages.js";
import { stateForManualStage } from "../../engine/turn.js";
import type { LeadStage } from "../../engine/types.js";
import type { Prisma } from "../../generated/prisma/client.js";
import type { CompanyAccess } from "../../http/company-access.js";
import { badRequest, conflict, notFound } from "../../lib/http-error.js";
import { findThreadDto } from "./thread-dto.js";

/**
 * A person sets the lead stage, in any direction (the bot itself only moves forward). Any stage
 * configured on the company (the 6 system stages plus custom stages) is accepted. Contactado
 * records who and when and gives the thread to that operator if nobody had it; leaving Contactado
 * clears that. Leaving Por contactar for Calificando or a closed stage clears the handoff time.
 */
export async function changeThreadStage(
  ctx: AppContext,
  access: CompanyAccess,
  threadId: string,
  stage: LeadStage,
) {
  const { companyId, operatorId, actorEmail, support } = access;
  const thread = await ctx.db.thread.findFirst({
    where: { id: threadId, companyId },
    include: {
      company: { select: { name: true, config: true, hubspotEnabled: true } },
    },
  });
  if (!thread) throw notFound("Conversación no encontrada");

  const config = parseCompanyConfig(thread.company.config, thread.company.name);
  if (!findStage(config.stages, stage)) {
    throw badRequest(
      "La etapa elegida no existe en esta empresa.",
      "invalid_stage",
    );
  }
  if (thread.stage === stage) return findThreadDto(ctx.db, threadId);

  const { collect } = config;
  const hubspot = thread.company.hubspotEnabled === true;
  const now = ctx.now();
  const data: Prisma.ThreadUncheckedUpdateManyInput = {
    stage,
    state: stateForManualStage(thread, stage, collect),
    stageChangedAt: now,
    stageChangedById: operatorId,
    stageChangedByEmail: actorEmail,
    ...(hubspot ? crmRequest(thread.crmPendingAction ?? "update") : {}),
  };
  if (stage === "to_contact") data.handedOffAt = thread.handedOffAt ?? now;
  if (stage === "qualifying" || isClosedStage(stage)) data.handedOffAt = null;
  if (stage === "contacted") {
    data.contactedAt = now;
    data.contactedById = operatorId;
    data.contactedByEmail = actorEmail;
  } else if (thread.stage === "contacted") {
    data.contactedAt = null;
    data.contactedById = null;
    data.contactedByEmail = null;
  }
  const assignToMe =
    stage === "contacted" && thread.assignedToId === null && operatorId;

  const changed = await ctx.db.$transaction(async (tx) => {
    // Conditional on what we read, so a bot turn or another person who changed it first wins.
    const updated = await tx.thread.updateMany({
      where: {
        id: threadId,
        stage: thread.stage,
        stageChangedAt: thread.stageChangedAt,
      },
      data: assignToMe
        ? { ...data, assignedToId: operatorId, assignedAt: now }
        : data,
    });
    if (updated.count === 0) return false;
    await tx.leadStageChange.create({
      data: {
        companyId,
        threadId,
        fromStage: thread.stage,
        toStage: stage,
        changedById: operatorId,
        changedByEmail: actorEmail,
        support,
        createdAt: now,
      },
    });
    return true;
  });
  if (!changed)
    throw conflict(
      "La etapa de esta conversación acaba de cambiar. Revísala y vuelve a elegir.",
      "stage_changed",
    );
  if (hubspot) ctx.crm.schedule(threadId);
  return findThreadDto(ctx.db, threadId);
}
