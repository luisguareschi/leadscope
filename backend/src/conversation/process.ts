import { CompanyConfig } from "../companies/config";
import { safeEqual } from "../crypto/secrets";
import { toE164 } from "../phone";
import { withinSessionWindow } from "../session-window";
import { applyTurn } from "../engine/transition";
import { ThreadSnapshot, TurnOptions } from "../engine/types";
import { buildStateBlock, buildSystemPrompt, toAnthropicMessages } from "../engine/prompt";
import { CompleteFn } from "../llm/types";
import { Channel } from "../integrations/channel";
import { Crm } from "../integrations/crm/types";
import { ParsedInbound } from "../integrations/whatsapp/parse";
import { Store, ThreadRecord } from "../store/types";
import { log } from "../logger";
import { buildCrmSummary } from "./transcript";

export type ProcessorDeps = {
  store: Store;
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

function snapshot(thread: ThreadRecord): ThreadSnapshot {
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
  deps: ProcessorDeps,
  inbound: ParsedInbound,
): Promise<{ duplicate: boolean; threadId: string | null }> {
  const company = await deps.store.companyByPhoneNumberId(inbound.phoneNumberId);
  if (!company) {
    log.warn({ phoneNumberId: inbound.phoneNumberId }, "webhook for unknown phone number id");
    return { duplicate: false, threadId: null };
  }
  const phone = toE164(inbound.from);
  if (!phone) {
    log.warn({ companyId: company.id }, "inbound phone could not be normalized");
    return { duplicate: false, threadId: null };
  }
  let thread = await deps.store.threadByPhone(company.id, phone);
  if (!thread) {
    thread = await deps.store.createThread({ companyId: company.id, phone, state: "Greeting" });
  }
  const contentType = inbound.contentType === "text" ? "text" : inbound.contentType;
  const inserted = await deps.store.addMessage({
    companyId: company.id,
    threadId: thread.id,
    direction: "in",
    body: inbound.contentType === "text" ? (inbound.text ?? "") : "",
    contentType,
    whatsappMessageId: inbound.messageId,
  });
  if (inserted.duplicate) return { duplicate: true, threadId: thread.id };
  await deps.store.saveThread(company.id, thread.id, { lastInboundAt: new Date().toISOString() });
  return { duplicate: false, threadId: thread.id };
}

export async function processThread(deps: ProcessorDeps, threadId: string): Promise<void> {
  const located = await findThread(deps.store, threadId);
  if (!located) return;
  const { company, thread } = located;
  if (thread.paused || thread.needsHuman) return;

  const pending = await deps.store.messagesAfterLastOutbound(company.id, thread.id);
  const inbound = pending.filter((message) => message.direction === "in");
  if (inbound.length === 0) return;
  const texts = inbound.filter((message) => message.contentType === "text");
  const turnOptions = optionsFor(company.config);

  let decision;
  if (texts.length === 0) {
    decision = applyTurn(snapshot(thread), { kind: "non_text" }, turnOptions);
  } else {
    try {
      const projects = await deps.store.listProjects(company.id);
      const history = await deps.store.listMessages(company.id, thread.id);
      const result = await deps.complete({
        apiKey: company.secrets.anthropicApiKey,
        model: deps.model,
        system: buildSystemPrompt(company.config, projects),
        state: buildStateBlock(snapshot(thread)),
        messages: toAnthropicMessages(history),
      });
      await deps.store.recordUsage({
        companyId: company.id,
        threadId: thread.id,
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      });
      decision = applyTurn(snapshot(thread), { kind: "inbound_text", model: result.output }, turnOptions);
    } catch (err) {
      log.error({ err, threadId: thread.id, companyId: company.id }, "model call failed");
      decision = applyTurn(snapshot(thread), { kind: "model_failure" }, turnOptions);
    }
  }

  if (decision.outbound) {
    const lastInbound = thread.lastInboundAt ? new Date(thread.lastInboundAt) : null;
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
      await deps.store.addMessage({
        companyId: company.id,
        threadId: thread.id,
        direction: "out",
        body: decision.outbound,
        contentType: "text",
        whatsappMessageId: sent.messageId,
      });
    } catch (err) {
      log.error({ err, threadId: thread.id, companyId: company.id }, "whatsapp send failed");
      await deps.store.saveThread(company.id, thread.id, { needsHuman: true });
      return;
    }
  }

  await deps.store.saveThread(company.id, thread.id, {
    state: decision.state,
    needsHuman: decision.needsHuman,
    interest: decision.interest,
    budget: decision.budget,
    knowsProjects: decision.knowsProjects,
    callTime: decision.callTime,
  });

  if (decision.crm === "none") return;
  try {
    const messages = await deps.store.listMessages(company.id, thread.id);
    const saved = await deps.store.getThread(company.id, thread.id);
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
    await deps.store.saveThread(company.id, thread.id, { crmContactId: result.contactId });
  } catch (err) {
    log.error({ err, threadId: thread.id, companyId: company.id }, "crm upsert failed");
  }
}

async function findThread(store: Store, threadId: string) {
  const companies = await store.listCompanies();
  for (const company of companies) {
    const thread = await store.getThread(company.id, threadId);
    if (thread) return { company, thread };
  }
  return null;
}

export async function acceptFormLead(
  deps: ProcessorDeps,
  input: { secret: string; phone: string; email?: string; hubspotContactId?: string },
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const companies = await deps.store.listCompanies();
  const company = companies.find(
    (candidate) => candidate.secrets.formLeadSecret && safeEqual(candidate.secrets.formLeadSecret, input.secret),
  );
  if (!company) return { ok: false, status: 401, error: "unauthorized" };
  const phone = toE164(input.phone);
  if (!phone) return { ok: false, status: 400, error: "phone must include a country code" };

  const existing = await deps.store.threadByPhone(company.id, phone);
  if (existing) {
    await deps.store.saveThread(company.id, existing.id, {
      email: input.email ?? existing.email,
      crmContactId: input.hubspotContactId ?? existing.crmContactId,
    });
    return { ok: true };
  }

  const thread = await deps.store.createThread({
    companyId: company.id,
    phone,
    state: "Qualify",
    email: input.email ?? null,
    crmContactId: input.hubspotContactId ?? null,
  });
  const template = company.config.whatsapp.welcomeTemplateName;
  if (!template) {
    log.warn({ companyId: company.id, threadId: thread.id }, "welcome template name is not configured");
    return { ok: true };
  }
  const sent = await deps.channel.sendTemplate({
    to: phone,
    templateName: template,
    language: company.config.whatsapp.templateLanguage,
    phoneNumberId: company.whatsappPhoneNumberId ?? company.config.whatsapp.phoneNumberId,
    accessToken: company.secrets.metaAccessToken,
  });
  await deps.store.addMessage({
    companyId: company.id,
    threadId: thread.id,
    direction: "out",
    body: `template:${template}`,
    contentType: "template",
    whatsappMessageId: sent.messageId,
  });
  return { ok: true };
}
