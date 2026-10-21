import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { recordInboundMessage } from "../../src/conversation/inbound.js";
import { processThread } from "../../src/conversation/process-thread.js";
import { sweepOnce } from "../../src/conversation/sweeper.js";
import { withThreadLease } from "../../src/conversation/thread-lease.js";
import type { Crm, CrmLead } from "../../src/integrations/crm/crm.js";
import { createIntegrations } from "../../src/integrations/registry.js";
import {
  ChannelError,
  FakeChannel,
} from "../../src/integrations/whatsapp/channel.js";
import {
  createCompany,
  createTestContext,
  inbound,
  resetDb,
  testDb,
  type TestContext,
  settle,
} from "../support/harness.js";
import { testEnv } from "../support/test-env.js";

let ctx: TestContext;
let pnid: string;

async function receive(
  body: string,
  overrides: Parameters<typeof inbound>[1] = {},
) {
  const result = await recordInboundMessage(
    ctx,
    inbound(pnid, { body, ...overrides }),
  );
  if (result.status !== "recorded")
    throw new Error(`not recorded: ${result.status}`);
  return result;
}

async function thread() {
  return testDb().thread.findFirstOrThrow({
    include: { messages: { orderBy: { sentAt: "asc" } } },
  });
}

beforeEach(async () => {
  await resetDb();
  const company = await createCompany(testDb());
  pnid = company.whatsappPhoneNumberId!;
  ctx = createTestContext();
});

afterEach(() => settle(ctx));

describe("inbound messages", () => {
  it("stores a new lead with an E.164 phone and their WhatsApp name", async () => {
    await receive("Hola");
    const saved = await thread();
    expect(saved).toMatchObject({
      phone: "+59899111222",
      waId: "59899111222",
      name: "Ana",
      state: "greeting",
    });
    expect(saved.messages).toHaveLength(1);
    expect(saved.lastMessagePreview).toBe("Hola");
  });

  it("ignores a second delivery of the same Meta message", async () => {
    const message = inbound(pnid, { body: "Hola" });
    await recordInboundMessage(ctx, message);
    await expect(recordInboundMessage(ctx, message)).resolves.toEqual({
      status: "duplicate",
    });
    expect(await testDb().message.count()).toBe(1);
  });

  it("does not create a thread for a phone number id with no company", async () => {
    await expect(
      recordInboundMessage(ctx, inbound("UNKNOWN")),
    ).resolves.toEqual({ status: "unknown_company" });
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
    ctx.llm.push({
      reply: "¡Hola Ana! ¿Con qué presupuesto contás?",
      collected: { interest: "2 dormitorios para vivir" },
      summary: "- Busca 2 dormitorios para vivir.",
    });

    await expect(processThread(ctx, threadId)).resolves.toBe("replied");

    const saved = await thread();
    expect(saved.state).toBe("qualify");
    expect(saved.collected).toEqual({ interest: "2 dormitorios para vivir" });
    expect(saved.summary).toBe("- Busca 2 dormitorios para vivir.");
    expect(
      saved.messages
        .filter((m) => m.direction === "outbound")
        .map((m) => m.body),
    ).toEqual(["¡Hola Ana! ¿Con qué presupuesto contás?"]);
    expect(
      saved.messages.every(
        (m) => m.direction === "outbound" || m.handledAt !== null,
      ),
    ).toBe(true);
    expect(ctx.llm.calls).toHaveLength(1);
    expect(ctx.llm.calls[0]?.messages.at(-1)).toEqual({
      role: "user",
      content: "Hola\nBusco 2 dormitorios para vivir",
    });
    expect(ctx.integrations.fakes.channel.sent).toMatchObject([
      { to: "59899111222", kind: "text" },
    ]);
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
    await testDb().thread.update({
      where: { id: threadId },
      data: { paused: true },
    });
    const later = await receive("¿Hola?");
    expect(later.needsReply).toBe(false);
    await expect(processThread(ctx, threadId)).resolves.toBe("silenced");
    expect(ctx.llm.calls).toHaveLength(0);
    expect(await testDb().message.count({ where: { handledAt: null } })).toBe(
      0,
    );
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
    await ctx.crm.drain();
    const saved = await thread();
    expect(saved.messages.at(-1)?.body).toBe("Te va a contactar un asesor.");
    expect(saved).toMatchObject({
      needsHuman: true,
      needsHumanReason: "model_failure: overloaded",
      crmPendingAction: null,
    });
    expect(saved.crmSyncedAt).not.toBeNull();
    expect(
      ctx.integrations.fakes.crm.contacts.get("+59899111222")?.lead.summary,
    ).toContain("Estado: Requiere atención de un asesor");
  });

  it("keeps the summary and fields on top of the transcript in HubSpot through the handoff", async () => {
    const { threadId } = await receive(
      "Busco 2 dormitorios, tengo 150 mil y no conozco los proyectos",
    );
    ctx.llm.push({
      reply: "¿Cuándo te puede llamar un asesor?",
      collected: {
        interest: "2 dormitorios",
        budget: "USD 150.000",
        knowsProjects: "No",
      },
      summary:
        "- Busca 2 dormitorios con USD 150.000.\n- No conoce los proyectos.",
    });
    await processThread(ctx, threadId);
    await ctx.crm.drain();
    expect((await thread()).state).toBe("handoff");
    expect(ctx.integrations.fakes.crm.contacts.size).toBe(1);

    await receive("Mañana a las 10");
    ctx.llm.push({
      reply: "Listo, te llaman mañana a las 10.",
      callTime: "Mañana a las 10",
      intent: "qualified",
      summary:
        "- Busca 2 dormitorios con USD 150.000.\n- No conoce los proyectos.\n- Pidió que lo llamen mañana a las 10.",
    });
    await processThread(ctx, threadId);
    await ctx.crm.drain();

    const saved = await thread();
    expect(saved).toMatchObject({
      state: "handoff",
      callTime: "Mañana a las 10",
      crmContactId: "fake-contact-1",
    });
    const summary =
      ctx.integrations.fakes.crm.contacts.get("+59899111222")?.lead.summary ??
      "";
    expect(summary).toContain("Estado: Derivado a asesor");
    expect(summary).toContain("Etapa: Por contactar");
    expect(summary).toContain("Horario para llamar: Mañana a las 10");
    // One property: the summary and the collected fields on top, then the transcript.
    const lines = summary.split("\n");
    const at = (line: string) => lines.indexOf(line);
    expect(at("Resumen:")).toBeGreaterThan(0);
    expect(lines[at("Resumen:") + 1]).toBe(
      "- Busca 2 dormitorios con USD 150.000.",
    );
    expect(
      lines.slice(at("Datos del lead:") + 1, at("Datos del lead:") + 4),
    ).toEqual([
      "Interés: 2 dormitorios",
      "Presupuesto: USD 150.000",
      "Conoce los proyectos: No",
    ]);
    expect(at("Resumen:")).toBeLessThan(at("Datos del lead:"));
    expect(at("Datos del lead:")).toBeLessThan(at("Conversación:"));
    expect(summary).toContain("Lead: Mañana a las 10");
  });

  it("keeps a handed-off lead in Por contactar when they write again, and the bot keeps answering", async () => {
    const qualifyAt = new Date(Date.now() - 10 * 60_000);
    const { threadId } = await receive(
      "Busco 2 dormitorios, tengo 150 mil y no conozco los proyectos",
      { sentAt: qualifyAt },
    );
    ctx.llm.push({
      reply: "¿Cuándo te puede llamar un asesor?",
      collected: {
        interest: "2 dormitorios",
        budget: "USD 150.000",
        knowsProjects: "No",
      },
    });
    await processThread(ctx, threadId);
    let saved = await thread();
    expect(saved).toMatchObject({ state: "handoff", stage: "to_contact" });
    expect(saved.handedOffAt).toEqual(qualifyAt);

    await receive("Mañana a las 10", {
      sentAt: new Date(Date.now() - 5 * 60_000),
    });
    ctx.llm.push({
      reply: "Listo, te llaman mañana a las 10.",
      callTime: "Mañana a las 10",
    });
    await processThread(ctx, threadId);

    await receive("¿Y la entrega para cuándo es?");
    ctx.llm.push({ reply: "La entrega es en diciembre de 2027." });
    await processThread(ctx, threadId);
    await receive("No me interesa más, gracias");
    ctx.llm.push({ reply: "Gracias por avisar.", intent: "not_interested" });
    await processThread(ctx, threadId);
    await ctx.crm.drain();

    saved = await thread();
    expect(saved.stage).toBe("to_contact");
    expect(saved.handedOffAt).toEqual(qualifyAt);
    expect(ctx.llm.calls.at(2)?.turnContext).toContain(
      "already with an advisor, who will call Mañana a las 10",
    );
    expect(saved.messages.at(-3)?.body).toBe(
      "La entrega es en diciembre de 2027.",
    );
    // HubSpot shows the close, while the advisor still has the lead in the queue.
    expect(
      ctx.integrations.fakes.crm.contacts.get("+59899111222")?.lead.summary,
    ).toContain("Estado: Cerrado: sin interés\nEtapa: Por contactar");
  });

  it("does not let a turn overwrite Contactado set by a person while the model was answering", async () => {
    const { threadId } = await receive(
      "Busco 2 dormitorios, tengo 150 mil y no conozco los proyectos",
    );
    ctx.llm.push(async () => {
      await testDb().thread.update({
        where: { id: threadId },
        data: { stage: "contacted", contactedAt: new Date() },
      });
      return {
        reply: "¿Cuándo te puede llamar un asesor?",
        collected: {
          interest: "2 dormitorios",
          budget: "USD 150.000",
          knowsProjects: "No",
        },
      };
    });
    await processThread(ctx, threadId);
    expect((await thread()).stage).toBe("contacted");
  });

  it("hands off on the company's own items: required ones gate, optional ones do not", async () => {
    await resetDb();
    pnid = (
      await createCompany(testDb(), {
        config: {
          collect: [
            {
              key: "zone",
              name: "Zona",
              description: "Barrio preferido.",
              required: false,
            },
            {
              key: "moveIn",
              name: "Mudanza",
              description: "Cuándo se quiere mudar.",
              required: true,
            },
          ],
        },
      })
    ).whatsappPhoneNumberId!;
    const { threadId } = await receive("Hola, me gusta Pocitos");
    ctx.llm.push({ reply: "¿Para cuándo?", collected: { zone: "Pocitos" } });
    await processThread(ctx, threadId);
    expect((await thread()).state).toBe("qualify");
    expect(ctx.llm.calls[0]?.turnContext).toContain("- Zona [zone]: (unknown)");
    expect(ctx.llm.calls[0]?.scenario.config.collect).toHaveLength(2);

    await receive("En marzo");
    ctx.llm.push({
      reply: "¿Cuándo te llamamos?",
      collected: { moveIn: "Marzo" },
    });
    await processThread(ctx, threadId);
    const saved = await thread();
    expect(saved.state).toBe("handoff");
    expect(saved.collected).toEqual({ zone: "Pocitos", moveIn: "Marzo" });
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
    expect(saved.needsHumanReason).toContain(
      "send_failed: Re-engagement message",
    );
    expect(saved.messages.at(-1)).toMatchObject({
      direction: "outbound",
      status: "failed",
      waMessageId: null,
    });
  });

  it("does not answer once WhatsApp's 24-hour window has closed", async () => {
    const { threadId } = await receive("Hola", {
      sentAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
    });
    await expect(processThread(ctx, threadId)).resolves.toBe("window_closed");
    expect(ctx.integrations.fakes.channel.sent).toHaveLength(0);
  });

  it("skips a thread another process is answering", async () => {
    const { threadId } = await receive("Hola");
    const outcome = await withThreadLease(ctx, threadId, () =>
      processThread(ctx, threadId),
    );
    expect(outcome).toEqual({ claimed: true, result: "busy" });
  });
});

describe("recovery", () => {
  it("schedules messages nobody answered, e.g. after a restart", async () => {
    const { threadId } = await receive("Hola");
    await testDb().message.updateMany({
      data: { createdAt: new Date(Date.now() - 60_000) },
    });
    const result = await sweepOnce(ctx);
    expect(result.scheduled).toBe(1);
    await settle(ctx);
    expect(
      (await testDb().thread.findUniqueOrThrow({ where: { id: threadId } }))
        .lastMessagePreview,
    ).toBe("Respuesta de prueba.");
  });

  it("retries a failed CRM write with backoff until it succeeds", async () => {
    let down = true;
    const flaky: Crm = {
      kind: "fake",
      async upsertLead() {
        if (down) throw new Error("HubSpot returned 503");
        return { contactId: "hs-1" };
      },
    };
    let now = new Date();
    ctx = createTestContext({
      integrations: { crmFor: () => flaky },
      now: () => now,
    });
    const { threadId } = await receive("No me interesa");
    await ctx.crm.drain();
    ctx.llm.push({ reply: "Gracias por avisar.", intent: "not_interested" });
    await processThread(ctx, threadId);
    await ctx.crm.drain();

    let saved = await testDb().thread.findUniqueOrThrow({
      where: { id: threadId },
    });
    expect(saved).toMatchObject({
      state: "closed",
      crmPendingAction: "close",
      crmAttempts: 1,
      crmLastError: "HubSpot returned 503",
    });
    expect(saved.crmNextAttemptAt!.getTime()).toBeGreaterThan(now.getTime());

    await sweepOnce(ctx);
    expect(
      (await testDb().thread.findUniqueOrThrow({ where: { id: threadId } }))
        .crmContactId,
    ).toBeNull();

    down = false;
    now = new Date(now.getTime() + 2 * 60_000);
    // A process that crashed mid-write left its lease behind; once expired it must not block the retry.
    await testDb().thread.update({
      where: { id: threadId },
      data: { crmLeaseUntil: new Date(now.getTime() - 1000) },
    });
    await sweepOnce(ctx);
    saved = await testDb().thread.findUniqueOrThrow({
      where: { id: threadId },
    });
    expect(saved).toMatchObject({
      crmPendingAction: null,
      crmContactId: "hs-1",
      crmLastError: null,
      crmLeaseUntil: null,
    });
  });
});

/** A CRM that records every write and can be held, to prove nobody waits for it. */
function recordingCrm() {
  const calls: CrmLead[] = [];
  let release: () => void = () => {};
  let held: Promise<void> | null = null;
  const crm: Crm & {
    calls: CrmLead[];
    hold(): void;
    release(): void;
    failWith: string | null;
  } = {
    kind: "fake",
    calls,
    failWith: null,
    hold() {
      held = new Promise((resolve) => (release = resolve));
    },
    release() {
      release();
      held = null;
    },
    async upsertLead(lead) {
      calls.push(lead);
      if (held) await held;
      if (crm.failWith) throw new Error(crm.failWith);
      return { contactId: lead.existingContactId ?? "hs-1" };
    },
  };
  return crm;
}

describe("HubSpot from the first message", () => {
  it("creates the contact on the lead's first message, with the WhatsApp name and phone, before the bot answers", async () => {
    const { threadId } = await receive("Hola");
    await ctx.crm.drain();

    const contact = ctx.integrations.fakes.crm.contacts.get("+59899111222");
    expect(contact?.lead).toMatchObject({
      phone: "+59899111222",
      name: "Ana",
      email: null,
      existingContactId: null,
    });
    expect(contact?.lead.summary).toContain(
      "Estado: En conversación con el asistente",
    );
    expect(contact?.lead.summary).toContain("Lead: Hola");
    const saved = await thread();
    expect(saved).toMatchObject({
      id: threadId,
      crmContactId: "fake-contact-1",
      crmPendingAction: null,
    });
    expect(saved.messages.filter((m) => m.direction === "outbound")).toEqual(
      [],
    );
  });

  it("finds the lead's existing contact by phone instead of creating a second one", async () => {
    await ctx.integrations.fakes.crm.upsertLead({
      phone: "+59899111222",
      name: "Ana",
      email: "ana@example.com",
      existingContactId: "hs-existing",
      summary: "",
    });
    const { threadId } = await receive("Hola");
    await ctx.crm.drain();
    await processThread(ctx, threadId);
    await ctx.crm.drain();

    expect(ctx.integrations.fakes.crm.contacts.size).toBe(1);
    expect((await thread()).crmContactId).toBe("hs-existing");
  });

  it("creates one contact when two first messages arrive at once, then writes to it by id", async () => {
    const crm = recordingCrm();
    ctx = createTestContext({ integrations: { crmFor: () => crm } });
    const [{ threadId }] = await Promise.all([
      receive("Hola"),
      receive("¿Están?"),
    ]);
    await ctx.crm.drain();
    expect(crm.calls).toHaveLength(1);
    expect(crm.calls[0]?.existingContactId).toBeNull();

    ctx.llm.push({ reply: "¿Qué buscás?", summary: "- Saludó." });
    await processThread(ctx, threadId);
    await ctx.crm.drain();
    expect(crm.calls.map((call) => call.existingContactId)).toEqual([
      null,
      "hs-1",
    ]);
  });

  it("updates the same contact after a turn that changed something, and only then", async () => {
    const crm = recordingCrm();
    ctx = createTestContext({ integrations: { crmFor: () => crm } });
    const { threadId } = await receive("Hola, busco 2 dormitorios");
    await ctx.crm.drain();
    expect(crm.calls).toHaveLength(1);

    ctx.llm.push({
      reply: "¿Con qué presupuesto contás?",
      collected: { interest: "2 dormitorios" },
      summary: "- Busca 2 dormitorios.",
    });
    await processThread(ctx, threadId);
    await ctx.crm.drain();
    expect(crm.calls).toHaveLength(2);
    expect(crm.calls[1]?.summary).toContain("Interés: 2 dormitorios");
    expect(crm.calls[1]?.summary).toContain("- Busca 2 dormitorios.");

    // Nothing new: same fields, summary kept, same stage.
    await receive("¿Tienen cochera?");
    ctx.llm.push({ reply: "Eso te lo confirma un asesor." });
    await processThread(ctx, threadId);
    await ctx.crm.drain();
    expect(crm.calls).toHaveLength(2);

    await receive("Hasta 150 mil");
    ctx.llm.push({
      reply: "¿Ya conocés los proyectos?",
      collected: { budget: "Hasta USD 150.000" },
      summary: "- Busca 2 dormitorios.\n- Hasta USD 150.000.",
    });
    await processThread(ctx, threadId);
    await ctx.crm.drain();
    expect(crm.calls).toHaveLength(3);
    expect(crm.calls[2]).toMatchObject({ existingContactId: "hs-1" });
    expect(crm.calls[2]?.summary).toContain("Presupuesto: Hasta USD 150.000");
  });

  it("never holds a reply for HubSpot, slow or failing", async () => {
    const crm = recordingCrm();
    crm.hold();
    ctx = createTestContext({ integrations: { crmFor: () => crm } });
    const { threadId } = await receive("Hola");
    ctx.llm.push({ reply: "¡Hola! ¿Qué buscás?", summary: "- Saludó." });
    await expect(processThread(ctx, threadId)).resolves.toBe("replied");
    await receive("Un 2 dormitorios");
    ctx.llm.push({
      reply: "¿Con qué presupuesto?",
      collected: { interest: "2 dormitorios" },
    });
    await expect(processThread(ctx, threadId)).resolves.toBe("replied");
    expect(ctx.integrations.fakes.channel.sent).toHaveLength(2);
    expect((await thread()).crmSyncedAt).toBeNull();

    crm.failWith = "HubSpot returned 503";
    crm.release();
    await ctx.crm.drain();
    const saved = await thread();
    expect(saved.crmPendingAction).not.toBeNull();
    expect(saved).toMatchObject({
      crmAttempts: 1,
      crmLastError: "HubSpot returned 503",
    });
    expect(saved.crmNextAttemptAt).not.toBeNull();

    await receive("Hasta 150 mil");
    ctx.llm.push({
      reply: "¿Ya conocés los proyectos?",
      collected: { budget: "USD 150.000" },
    });
    await expect(processThread(ctx, threadId)).resolves.toBe("replied");
    expect(ctx.integrations.fakes.channel.sent).toHaveLength(3);
  });
});

describe("a lead who wants to talk to a person now", () => {
  it("goes straight to Por contactar with items missing, call time Lo antes posible, and HubSpot gets it", async () => {
    const askedAt = new Date(Date.now() - 60_000);
    const { threadId } = await receive("Hola, llámenme ya por favor", {
      sentAt: askedAt,
    });
    ctx.llm.push({
      reply:
        "¡Claro! Un asesor te va a contactar lo antes posible. Si preferís, llamá ya al 2600 1234.",
      callNow: true,
      summary: "- Pidió hablar con una persona ya.",
    });
    await processThread(ctx, threadId);
    await ctx.crm.drain();

    const saved = await thread();
    expect(saved).toMatchObject({
      stage: "to_contact",
      callTime: "Lo antes posible",
      collected: {},
      needsHuman: false,
      crmPendingAction: null,
    });
    expect(saved.handedOffAt).toEqual(askedAt);
    expect(saved.messages.at(-1)?.body).toBe(
      "¡Claro! Un asesor te va a contactar lo antes posible. Si preferís, llamá ya al 2600 1234.",
    );
    const summary =
      ctx.integrations.fakes.crm.contacts.get("+59899111222")?.lead.summary ??
      "";
    expect(summary).toContain("Estado: Derivado a asesor");
    expect(summary).toContain("Horario para llamar: Lo antes posible");

    await receive("¿Y dónde queda?");
    await processThread(ctx, threadId);
    const context = ctx.llm.calls.at(-1)?.turnContext ?? "";
    expect(context).toContain("asked to talk to a person right away");
    expect(context).toContain("Do not ask for anything");
    expect((await thread()).stage).toBe("to_contact");
  });

  it("reaches the advisor with the company's number when the instructions give one (local fake model)", async () => {
    await resetDb();
    pnid = (
      await createCompany(testDb(), {
        instructions:
          "Si alguien quiere llamar ya, el número directo de ventas es +598 2600 1234.",
      })
    ).whatsappPhoneNumberId!;
    const fake = createIntegrations(testEnv()).fakes.llm;
    ctx = createTestContext({ integrations: { llmFor: () => fake } });
    const { threadId } = await receive("Quiero hablar con alguien, llámenme");
    await processThread(ctx, threadId);
    const saved = await thread();
    expect(saved).toMatchObject({
      stage: "to_contact",
      callTime: "Lo antes posible",
    });
    expect(saved.messages.at(-1)?.body).toContain("+598 2600 1234");
  });
});
