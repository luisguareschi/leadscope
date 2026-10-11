import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { recordInboundMessage } from "../../src/conversation/inbound.js";
import { processThread } from "../../src/conversation/process-thread.js";
import { sweepOnce } from "../../src/conversation/sweeper.js";
import { withThreadLease } from "../../src/conversation/thread-lease.js";
import type { Crm } from "../../src/integrations/crm/crm.js";
import { ChannelError, FakeChannel } from "../../src/integrations/whatsapp/channel.js";
import { createCompany, createTestContext, inbound, resetDb, testDb, type TestContext } from "../support/harness.js";

let ctx: TestContext;
let pnid: string;

async function receive(body: string, overrides: Parameters<typeof inbound>[1] = {}) {
  const result = await recordInboundMessage(ctx, inbound(pnid, { body, ...overrides }));
  if (result.status !== "recorded") throw new Error(`not recorded: ${result.status}`);
  return result;
}

async function thread() {
  return testDb().thread.findFirstOrThrow({ include: { messages: { orderBy: { sentAt: "asc" } } } });
}

beforeEach(async () => {
  await resetDb();
  const company = await createCompany(testDb());
  pnid = company.whatsappPhoneNumberId!;
  ctx = createTestContext();
});

afterEach(() => ctx.replies.drain());

describe("inbound messages", () => {
  it("stores a new lead with an E.164 phone and their WhatsApp name", async () => {
    await receive("Hola");
    const saved = await thread();
    expect(saved).toMatchObject({ phone: "+59899111222", waId: "59899111222", name: "Ana", state: "greeting" });
    expect(saved.messages).toHaveLength(1);
    expect(saved.lastMessagePreview).toBe("Hola");
  });

  it("ignores a second delivery of the same Meta message", async () => {
    const message = inbound(pnid, { body: "Hola" });
    await recordInboundMessage(ctx, message);
    await expect(recordInboundMessage(ctx, message)).resolves.toEqual({ status: "duplicate" });
    expect(await testDb().message.count()).toBe(1);
  });

  it("does not create a thread for a phone number id with no company", async () => {
    await expect(recordInboundMessage(ctx, inbound("UNKNOWN"))).resolves.toEqual({ status: "unknown_company" });
    expect(await testDb().thread.count()).toBe(0);
  });

  it("handles two first messages from the same lead arriving at once", async () => {
    const results = await Promise.all([receive("Hola"), receive("¿Están?")]);
    expect(new Set(results.map((result) => result.threadId)).size).toBe(1);
    expect(await testDb().message.count()).toBe(2);
  });
});

describe("a bot turn", () => {
  it("answers a burst of messages with one reply and records model usage", async () => {
    const { threadId } = await receive("Hola");
    await receive("Busco 2 dormitorios para vivir");
    ctx.llm.push({ reply: "¡Hola Ana! ¿Con qué presupuesto contás?", interest: "2 dormitorios para vivir" });

    await expect(processThread(ctx, threadId)).resolves.toBe("replied");

    const saved = await thread();
    expect(saved.state).toBe("qualify");
    expect(saved.interest).toBe("2 dormitorios para vivir");
    expect(saved.messages.filter((m) => m.direction === "outbound").map((m) => m.body)).toEqual([
      "¡Hola Ana! ¿Con qué presupuesto contás?",
    ]);
    expect(saved.messages.every((m) => m.direction === "outbound" || m.handledAt !== null)).toBe(true);
    expect(ctx.llm.calls).toHaveLength(1);
    expect(ctx.llm.calls[0]?.messages.at(-1)).toEqual({ role: "user", content: "Hola\nBusco 2 dormitorios para vivir" });
    expect(ctx.integrations.fakes.channel.sent).toMatchObject([{ to: "59899111222", kind: "text" }]);
    expect(await testDb().llmUsage.count()).toBe(1);
  });

  it("does nothing when every message was already answered", async () => {
    const { threadId } = await receive("Hola");
    await processThread(ctx, threadId);
    await expect(processThread(ctx, threadId)).resolves.toBe("no_pending");
    expect(ctx.llm.calls).toHaveLength(1);
  });

  it("puts the uploaded knowledge text in the model's system prompt", async () => {
    const company = await testDb().company.findFirstOrThrow();
    await testDb().knowledgeFile.create({
      data: {
        companyId: company.id,
        name: "precios.csv",
        nameKey: "precios.csv",
        format: "csv",
        mimeType: "text/csv",
        sizeBytes: 10,
        sha256: "x",
        text: "Torre Sur;USD 150.000",
        charCount: 21,
      },
    });
    const { threadId } = await receive("¿Cuánto sale Torre Sur?");
    await processThread(ctx, threadId);
    expect(ctx.llm.calls[0]?.system).toContain('<document name="precios.csv"');
    expect(ctx.llm.calls[0]?.system).toContain("Torre Sur;USD 150.000");
  });

  it("stays quiet on a paused thread and treats its messages as handled", async () => {
    const { threadId } = await receive("Hola");
    await testDb().thread.update({ where: { id: threadId }, data: { paused: true } });
    const later = await receive("¿Hola?");
    expect(later.needsReply).toBe(false);
    await expect(processThread(ctx, threadId)).resolves.toBe("silenced");
    expect(ctx.llm.calls).toHaveLength(0);
    expect(await testDb().message.count({ where: { handledAt: null } })).toBe(0);
  });

  it("asks the lead to type when only a voice note arrived, without calling the model", async () => {
    const { threadId } = await receive("", { type: "audio" });
    await processThread(ctx, threadId);
    expect(ctx.llm.calls).toHaveLength(0);
    expect((await thread()).messages.at(-1)?.body).toBe("¿Me lo escribís?");
  });

  it("falls back, waits for a person, and writes the CRM when the model fails", async () => {
    const { threadId } = await receive("Hola");
    ctx.llm.push(new Error("overloaded"));
    await processThread(ctx, threadId);
    const saved = await thread();
    expect(saved.messages.at(-1)?.body).toBe("Te va a contactar un asesor.");
    expect(saved).toMatchObject({ needsHuman: true, needsHumanReason: "model_failure: overloaded", crmPendingAction: null });
    expect(saved.crmSyncedAt).not.toBeNull();
    expect(ctx.integrations.fakes.crm.contacts.get("+59899111222")?.lead.summary).toContain(
      "Estado: Requiere atención de un asesor",
    );
  });

  it("writes the CRM with the summary once the handoff completes", async () => {
    const { threadId } = await receive("Busco 2 dormitorios, tengo 150 mil y no conozco los proyectos");
    ctx.llm.push({
      reply: "¿Cuándo te puede llamar un asesor?",
      interest: "2 dormitorios",
      budget: "USD 150.000",
      knowsProjects: false,
    });
    await processThread(ctx, threadId);
    expect((await thread()).state).toBe("handoff");
    expect(ctx.integrations.fakes.crm.contacts.size).toBe(0);

    await receive("Mañana a las 10");
    ctx.llm.push({ reply: "Listo, te llaman mañana a las 10.", callTime: "Mañana a las 10", intent: "qualified" });
    await processThread(ctx, threadId);

    const saved = await thread();
    expect(saved).toMatchObject({ state: "handoff", callTime: "Mañana a las 10", crmContactId: "fake-contact-1" });
    const summary = ctx.integrations.fakes.crm.contacts.get("+59899111222")?.lead.summary ?? "";
    expect(summary).toContain("Estado: Derivado a asesor (calificado)");
    expect(summary).toContain("Presupuesto: USD 150.000");
    expect(summary).toContain("Conoce los proyectos: No");
    expect(summary).toContain("Horario para llamar: Mañana a las 10");
    expect(summary).toContain("Lead: Mañana a las 10");
  });

  it("keeps the handoff and flags the thread when WhatsApp refuses the reply", async () => {
    const failing = new FakeChannel();
    failing.sendText = async () => {
      throw new ChannelError("Re-engagement message", 131047);
    };
    ctx = createTestContext({ integrations: { channelFor: () => failing } });
    const { threadId } = await receive("Hola");
    await expect(processThread(ctx, threadId)).resolves.toBe("send_failed");
    const saved = await thread();
    expect(saved.needsHuman).toBe(true);
    expect(saved.needsHumanReason).toContain("send_failed: Re-engagement message");
    expect(saved.messages.at(-1)).toMatchObject({ direction: "outbound", status: "failed", waMessageId: null });
  });

  it("does not answer once WhatsApp's 24-hour window has closed", async () => {
    const { threadId } = await receive("Hola", { sentAt: new Date(Date.now() - 25 * 60 * 60 * 1000) });
    await expect(processThread(ctx, threadId)).resolves.toBe("window_closed");
    expect(ctx.integrations.fakes.channel.sent).toHaveLength(0);
  });

  it("skips a thread another process is answering", async () => {
    const { threadId } = await receive("Hola");
    const outcome = await withThreadLease(ctx, threadId, () => processThread(ctx, threadId));
    expect(outcome).toEqual({ claimed: true, result: "busy" });
  });
});

describe("recovery", () => {
  it("schedules messages nobody answered, e.g. after a restart", async () => {
    const { threadId } = await receive("Hola");
    await testDb().message.updateMany({ data: { createdAt: new Date(Date.now() - 60_000) } });
    const result = await sweepOnce(ctx);
    expect(result.scheduled).toBe(1);
    await ctx.replies.drain();
    expect((await testDb().thread.findUniqueOrThrow({ where: { id: threadId } })).lastMessagePreview).toBe(
      "Respuesta de prueba.",
    );
  });

  it("retries a failed CRM write with backoff until it succeeds", async () => {
    let failures = 1;
    const flaky: Crm = {
      kind: "fake",
      async upsertLead() {
        if (failures-- > 0) throw new Error("HubSpot returned 503");
        return { contactId: "hs-1" };
      },
    };
    let now = new Date();
    ctx = createTestContext({ integrations: { crmFor: () => flaky }, now: () => now });
    const { threadId } = await receive("No me interesa");
    ctx.llm.push({ reply: "Gracias por avisar.", intent: "not_interested" });
    await processThread(ctx, threadId);

    let saved = await testDb().thread.findUniqueOrThrow({ where: { id: threadId } });
    expect(saved).toMatchObject({ state: "closed", crmPendingAction: "close", crmAttempts: 1, crmLastError: "HubSpot returned 503" });
    expect(saved.crmNextAttemptAt!.getTime()).toBeGreaterThan(now.getTime());

    await sweepOnce(ctx);
    expect((await testDb().thread.findUniqueOrThrow({ where: { id: threadId } })).crmContactId).toBeNull();

    now = new Date(now.getTime() + 2 * 60_000);
    // A process that crashed mid-turn left its lease behind; once expired it must not block the retry.
    await testDb().thread.update({ where: { id: threadId }, data: { processingUntil: new Date(now.getTime() - 1000) } });
    await sweepOnce(ctx);
    saved = await testDb().thread.findUniqueOrThrow({ where: { id: threadId } });
    expect(saved).toMatchObject({ crmPendingAction: null, crmContactId: "hs-1", crmLastError: null, processingUntil: null });
  });
});
