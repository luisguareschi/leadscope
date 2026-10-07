import { PrismaClient } from "@prisma/client";
import { CompanyConfig } from "../companies/config";
import { readCompany } from "../companies/load";
import { addMessage, listMessages, messagesAfterLastOutbound } from "../conversation/messages";
import { buildCrmSummary } from "../conversation/transcript";
import { buildStateBlock, buildSystemPrompt, toAnthropicMessages } from "../engine/prompt";
import { applyTurn } from "../engine/transition";
import { ThreadSnapshot, TurnOptions } from "../engine/types";
import { Channel } from "../integrations/channel";
import { Crm } from "../integrations/crm/types";
import { ParsedInbound } from "../integrations/whatsapp/parse";
import { CompleteFn } from "../llm/types";
import { log } from "../logger";
import { toE164 } from "../phone";
import { withinSessionWindow } from "../session-window";
import { listProjectFacts } from "./knowledge.service";

export type WhatsAppDeps = {
  db: PrismaClient;
  key: Buffer | null;
  channel: Channel;
  crm: Crm;
  complete: CompleteFn;
  model: string;
};

function optionsFor(config: CompanyConfig): TurnOptions {
  return {
    fallbackMessage: config.messages.fallback,
    nonTextMessage: config.messages.nonText,
    maxReplyChars: config.messages.maxReplyChars,
    forbiddenTopics: config.forbiddenTopics,
  };
}

function snapshot(thread: {
  state: ThreadSnapshot["state"];
  paused: boolean;
  needsHuman: boolean;
  interest: string | null;
  budget: string | null;
  knowsProjects: boolean | null;
  callTime: string | null;
}): ThreadSnapshot {
  return {
    state: thread.state,
    paused: thread.paused,
    needsHuman: thread.needsHuman,
    interest: thread.interest,
    budget: thread.budget,
    knowsProjects: thread.knowsProjects,
    callTime: thread.callTime,
  };
}

export async function recordInbound(
  deps: Pick<WhatsAppDeps, "db" | "key">,
  inbound: ParsedInbound,
): Promise<{ duplicate: boolean; threadId: string | null }> {
  const row = await deps.db.company.findUnique({ where: { whatsappPhoneNumberId: inbound.phoneNumberId } });
  if (!row) {
    log.warn({ phoneNumberId: inbound.phoneNumberId }, "webhook for unknown phone number id");
    return { duplicate: false, threadId: null };
  }
  const company = readCompany(row, deps.key);
  const phone = toE164(inbound.from);
  if (!phone) {
    log.warn({ companyId: company.id }, "inbound phone could not be normalized");
    return { duplicate: false, threadId: null };
  }
  let thread = await deps.db.thread.findUnique({ where: { companyId_phone: { companyId: company.id, phone } } });
  if (!thread) {
    thread = await deps.db.thread.create({
      data: { companyId: company.id, phone, state: "Greeting" },
    });
  }
  const inserted = await addMessage(deps.db, {
    companyId: company.id,
    threadId: thread.id,
    direction: "in",
    body: inbound.contentType === "text" ? (inbound.text ?? "") : "",
    contentType: inbound.contentType,
    whatsappMessageId: inbound.messageId,
  });
  if (inserted.duplicate) return { duplicate: true, threadId: thread.id };
  await deps.db.thread.update({
    where: { id: thread.id },
    data: { lastInboundAt: new Date() },
  });
  return { duplicate: false, threadId: thread.id };
}

export async function processThread(deps: WhatsAppDeps, threadId: string): Promise<void> {
  const thread = await deps.db.thread.findUnique({ where: { id: threadId } });
  if (!thread) return;
  const companyRow = await deps.db.company.findUnique({ where: { id: thread.companyId } });
  if (!companyRow) return;
  const company = readCompany(companyRow, deps.key);
  if (thread.paused || thread.needsHuman) return;

  const pending = await messagesAfterLastOutbound(deps.db, company.id, thread.id);
  const inbound = pending.filter((message) => message.direction === "in");
  if (inbound.length === 0) return;
  const texts = inbound.filter((message) => message.contentType === "text");
  const turnOptions = optionsFor(company.config);

  let decision;
  if (texts.length === 0) {
    decision = applyTurn(snapshot(thread), { kind: "non_text" }, turnOptions);
  } else {
    try {
      const projects = await listProjectFacts(deps.db, company.id);
      const history = await listMessages(deps.db, company.id, thread.id);
      const result = await deps.complete({
        apiKey: company.secrets.anthropicApiKey,
        model: deps.model,
        system: buildSystemPrompt(company.config, projects),
        state: buildStateBlock(snapshot(thread)),
        messages: toAnthropicMessages(history),
      });
      await deps.db.llmUsage.create({
        data: {
          companyId: company.id,
          threadId: thread.id,
          model: result.model,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
        },
      });
      decision = applyTurn(snapshot(thread), { kind: "inbound_text", model: result.output }, turnOptions);
    } catch (err) {
      log.error({ err, threadId: thread.id, companyId: company.id }, "model call failed");
      decision = applyTurn(snapshot(thread), { kind: "model_failure" }, turnOptions);
    }
  }

  if (decision.outbound) {
    const lastInbound = thread.lastInboundAt;
    if (!withinSessionWindow(lastInbound, new Date())) {
      log.warn({ threadId: thread.id, companyId: company.id }, "skip outbound outside 24h session window");
      return;
    }
    try {
      const sent = await deps.channel.sendText({
        to: thread.phone,
        body: decision.outbound,
        phoneNumberId: company.whatsappPhoneNumberId ?? company.config.whatsapp.phoneNumberId,
        accessToken: company.secrets.metaAccessToken,
      });
      await addMessage(deps.db, {
        companyId: company.id,
        threadId: thread.id,
        direction: "out",
        body: decision.outbound,
        contentType: "text",
        whatsappMessageId: sent.messageId,
      });
    } catch (err) {
      log.error({ err, threadId: thread.id, companyId: company.id }, "whatsapp send failed");
      await deps.db.thread.update({ where: { id: thread.id }, data: { needsHuman: true } });
      return;
    }
  }

  await deps.db.thread.update({
    where: { id: thread.id },
    data: {
      state: decision.state,
      needsHuman: decision.needsHuman,
      interest: decision.interest,
      budget: decision.budget,
      knowsProjects: decision.knowsProjects,
      callTime: decision.callTime,
    },
  });

  if (decision.crm === "none") return;
  try {
    const messages = await listMessages(deps.db, company.id, thread.id);
    const saved = await deps.db.thread.findUnique({ where: { id: thread.id } });
    const summary = buildCrmSummary({
      interest: decision.interest,
      budget: decision.budget,
      knowsProjects: decision.knowsProjects,
      callTime: decision.callTime,
      email: saved?.email ?? thread.email,
      messages,
    });
    const result = await deps.crm.upsertContact({
      companyId: company.id,
      phone: thread.phone,
      email: saved?.email ?? thread.email,
      existingContactId: thread.crmContactId,
      summary,
      transcriptProperty: company.config.crm.transcriptProperty,
    });
    await deps.db.thread.update({ where: { id: thread.id }, data: { crmContactId: result.contactId } });
  } catch (err) {
    log.error({ err, threadId: thread.id, companyId: company.id }, "crm upsert failed");
  }
}
