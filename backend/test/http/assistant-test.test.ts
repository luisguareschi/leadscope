import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { parseCompanyConfig } from "../../src/companies/company-config.js";
import { loadCompanyById } from "../../src/companies/load-company.js";
import { loadSystemPrompt } from "../../src/conversation/system-prompt.js";
import { CALL_NOW_TIME } from "../../src/engine/turn.js";
import { MissingIntegrationError } from "../../src/integrations/registry.js";
import {
  baseConfig,
  createCompany,
  createTestContext,
  resetDb,
  settle,
  testDb,
  type TestContext,
} from "../support/harness.js";

const db = testDb();
let ctx: TestContext;
let app: ReturnType<typeof createApp>;
let companyId: string;

const asAna = { Authorization: "Bearer dev:ana@altamira.uy" };
const asArchived = { Authorization: "Bearer dev:ex@altamira.uy" };
const admin = { Authorization: "Bearer dev:admin@example.com" };

type Message = { role: "lead" | "assistant"; body: string };

function turn(body: object, as: Record<string, string> = asAna) {
  return request(app).post("/internal/assistant-test/turn").set(as).send(body);
}

function setup(options: Parameters<typeof createTestContext>[0] = {}) {
  ctx = createTestContext({
    env: { PLATFORM_ADMIN_EMAILS: "admin@example.com" },
    ...options,
  });
  app = createApp(ctx);
}

beforeEach(async () => {
  await resetDb();
  const company = await createCompany(db, {
    slug: "altamira",
    name: "Altamira",
    instructions: "Mencioná siempre la piscina.",
  });
  companyId = company.id;
  await db.operator.create({ data: { email: "ana@altamira.uy", companyId } });
  await db.operator.create({
    data: { email: "ex@altamira.uy", companyId, archivedAt: new Date() },
  });
  await db.knowledgeFile.create({
    data: {
      companyId,
      name: "Precios.txt",
      nameKey: "precios.txt",
      format: "txt",
      mimeType: "text/plain",
      sizeBytes: 30,
      sha256: "x",
      text: "Tres Cruces desde USD 120.000",
      charCount: 29,
    },
  });
  setup();
});

describe("the panel's test chat (Probar asistente)", () => {
  it("answers with the company's saved prompt and knowledge", async () => {
    ctx.llm.push({ reply: "¡Hola! Soy Sofía, de Altamira." });
    const response = await turn({
      messages: [{ role: "lead", body: "Hola" }],
    }).expect(200);

    expect(response.body).toMatchObject({
      reply: "¡Hola! Soy Sofía, de Altamira.",
      modelReply: null,
      stoppedReason: null,
      lead: { state: "qualify", stage: "qualifying", collected: {} },
      model: { intent: "continue", callNow: false, forbiddenTopic: null },
      usage: { model: "scripted", inputTokens: 100, outputTokens: 20 },
    });
    const company = await loadCompanyById(db, companyId, ctx.encryptionKey);
    const { system } = await loadSystemPrompt(ctx, company);
    const call = ctx.llm.calls[0]!;
    expect(call.system).toBe(system);
    expect(call.system).toContain("Mencioná siempre la piscina.");
    expect(call.system).toContain("Tres Cruces desde USD 120.000");
    expect(call.messages).toEqual([{ role: "user", content: "Hola" }]);
    expect(call.turnContext).toContain("First message to this lead");
  });

  it("carries the lead's state from turn to turn and reaches Por contactar like WhatsApp", async () => {
    ctx.llm.push({
      reply: "¿Con qué presupuesto contás?",
      collected: { interest: "2 dormitorios", knowsProjects: "No" },
    });
    const first = await turn({
      messages: [{ role: "lead", body: "Busco 2 dormitorios, no los conozco" }],
      leadName: "Ana",
    }).expect(200);
    expect(first.body.lead).toMatchObject({
      stage: "qualifying",
      collected: { interest: "2 dormitorios", knowsProjects: "No" },
    });
    expect(ctx.llm.calls[0]!.turnContext).toContain("Name on WhatsApp: Ana");

    ctx.llm.push({
      reply: "¡Genial! ¿Cuándo te puede llamar un asesor?",
      collected: { budget: "USD 150.000" },
      summary: "- Busca 2 dormitorios",
    });
    const messages: Message[] = [
      { role: "lead", body: "Busco 2 dormitorios, no los conozco" },
      { role: "assistant", body: first.body.reply },
      { role: "lead", body: "Tengo 150 mil" },
    ];
    const second = await turn({ messages, lead: first.body.lead }).expect(200);
    expect(second.body.lead).toMatchObject({
      state: "handoff",
      stage: "to_contact",
      collected: {
        interest: "2 dormitorios",
        knowsProjects: "No",
        budget: "USD 150.000",
      },
      summary: "- Busca 2 dormitorios",
    });
    expect(ctx.llm.calls[1]!.messages).toEqual([
      { role: "user", content: "Busco 2 dormitorios, no los conozco" },
      { role: "assistant", content: first.body.reply },
      { role: "user", content: "Tengo 150 mil" },
    ]);
  });

  it("sends a lead who wants a person now straight to Por contactar", async () => {
    ctx.llm.push({ reply: "Un asesor te llama enseguida.", callNow: true });
    const response = await turn({
      messages: [{ role: "lead", body: "Llámenme" }],
    }).expect(200);
    expect(response.body.lead).toMatchObject({
      stage: "to_contact",
      callTime: CALL_NOW_TIME,
    });
    expect(response.body.model.callNow).toBe(true);
  });

  it("shows the fixed line and what the model wanted to say on a forbidden topic", async () => {
    ctx.llm.push({
      reply: "Renta un 8% anual.",
      forbiddenTopic: "Rentabilidad futura",
    });
    const response = await turn({
      messages: [{ role: "lead", body: "¿Cuánto renta?" }],
    }).expect(200);
    expect(response.body).toMatchObject({
      reply: "Un asesor te va a responder eso.",
      modelReply: "Renta un 8% anual.",
      model: { forbiddenTopic: "Rentabilidad futura" },
    });
    expect(response.body.stoppedReason).toMatch(/^forbidden_topic: /);
  });

  it("sends the fallback line when the model fails", async () => {
    ctx.llm.push(new Error("overloaded"));
    const response = await turn({
      messages: [{ role: "lead", body: "Hola" }],
    }).expect(200);
    expect(response.body).toMatchObject({
      reply: "Te va a contactar un asesor.",
      modelReply: null,
      model: null,
      usage: null,
    });
    expect(response.body.stoppedReason).toMatch(/^model_failure: overloaded/);
  });

  it("asks for the Anthropic key when the company has none", async () => {
    setup({
      integrations: {
        llmFor: () => {
          throw new MissingIntegrationError("altamira has no key");
        },
      },
    });
    const response = await turn({
      messages: [{ role: "lead", body: "Hola" }],
    }).expect(409);
    expect(response.body.error.code).toBe("anthropic_missing");
    expect(response.body.error.message).toContain("Integraciones → Anthropic");
  });

  it("stores nothing but the Anthropic usage, and writes nothing to WhatsApp or HubSpot", async () => {
    ctx.llm.push(
      { reply: "Hola", collected: { interest: "Casa" } },
      { reply: "Dale", callNow: true },
    );
    const first = await turn({
      messages: [{ role: "lead", body: "Hola" }],
    }).expect(200);
    await turn({
      messages: [
        { role: "lead", body: "Hola" },
        { role: "assistant", body: "Hola" },
        { role: "lead", body: "Llámenme" },
      ],
      lead: first.body.lead,
    }).expect(200);
    await settle(ctx);

    expect(await db.thread.count()).toBe(0);
    expect(await db.message.count()).toBe(0);
    expect(ctx.integrations.fakes.channel.sent).toEqual([]);
    expect(ctx.integrations.fakes.crm.contacts.size).toBe(0);
    const usage = await db.llmUsage.findMany();
    expect(usage).toHaveLength(2);
    expect(usage.every((row) => row.threadId === null)).toBe(true);
    expect(usage.every((row) => row.companyId === companyId)).toBe(true);
  });

  it("lets a platform admin test inside a company, audited, and refuses everyone else", async () => {
    await turn(
      { messages: [{ role: "lead", body: "Hola" }] },
      { ...admin, "X-Company-Id": companyId },
    ).expect(200);
    const entries = await db.adminAuditEntry.findMany();
    expect(entries).toMatchObject([
      {
        companyId,
        adminEmail: "admin@example.com",
        action: "POST /internal/assistant-test/turn",
      },
    ]);

    await turn({ messages: [{ role: "lead", body: "Hola" }] }, admin).expect(
      403,
    );
    await turn(
      { messages: [{ role: "lead", body: "Hola" }] },
      asArchived,
    ).expect(403);
  });

  it("rejects requests it cannot answer", async () => {
    const long = "a".repeat(4_000);
    const cases: object[] = [
      { messages: [] },
      { messages: [{ role: "assistant", body: "Hola" }] },
      { messages: [{ role: "lead", body: "   " }] },
      { messages: [{ role: "lead", body: "a".repeat(4_097) }] },
      {
        messages: Array.from({ length: 201 }, () => ({
          role: "lead",
          body: "Hola",
        })),
      },
      {
        messages: Array.from({ length: 16 }, () => ({
          role: "lead",
          body: long,
        })),
      },
    ];
    for (const body of cases) await turn(body).expect(400);
    expect(ctx.llm.calls).toHaveLength(0);
  });

  it("uses the settings as saved right now", async () => {
    await db.company.update({
      where: { id: companyId },
      data: {
        config: parseCompanyConfig({
          ...baseConfig,
          tone: "Muy formal, de usted.",
          collect: [
            {
              key: "zone",
              name: "Zona",
              description: "Dónde quiere vivir.",
              required: true,
            },
          ],
        }),
      },
    });
    await turn({ messages: [{ role: "lead", body: "Hola" }] }).expect(200);
    const call = ctx.llm.calls[0]!;
    expect(call.system).toContain("Muy formal, de usted.");
    expect(call.system).toContain("Zona [zone]");
    expect(call.system).not.toContain("Presupuesto [budget]");
  });

  it("drops collected items that are no longer in the config", async () => {
    ctx.llm.push({ reply: "¿Algo más?" });
    const response = await turn({
      messages: [{ role: "lead", body: "Hola" }],
      lead: {
        state: "qualify",
        stage: "qualifying",
        collected: { interest: "Casa", oldItem: "Viejo" },
        callTime: null,
        summary: null,
      },
    }).expect(200);
    expect(response.body.lead.collected).toEqual({ interest: "Casa" });
    expect(ctx.llm.calls[0]!.turnContext).not.toContain("Viejo");
  });

  it("accepts back any lead state it returned, however long the values", async () => {
    const long = "Cualquier día de la semana que viene, ".repeat(20);
    ctx.llm.push({ reply: "Anotado.", callTime: long }, { reply: "¡Dale!" });
    const first = await turn({
      messages: [{ role: "lead", body: long }],
    }).expect(200);
    expect(first.body.lead.callTime.length).toBeGreaterThan(500);
    await turn({
      messages: [
        { role: "lead", body: long },
        { role: "assistant", body: "Anotado." },
        { role: "lead", body: "Gracias" },
      ],
      lead: first.body.lead,
    }).expect(200);
  });

  it("does not show an empty model reply as what the model wanted to say", async () => {
    ctx.llm.push({ reply: "   " });
    const response = await turn({
      messages: [{ role: "lead", body: "Hola" }],
    }).expect(200);
    expect(response.body.stoppedReason).toBe("empty_reply");
    expect(response.body.modelReply).toBeNull();
  });

  it("never tells the model a WhatsApp lead came from a form when history starts with a reply", async () => {
    ctx.llm.push({ reply: "¡Dale!" });
    await turn({
      messages: [
        { role: "assistant", body: "¿Con qué presupuesto contás?" },
        { role: "lead", body: "Unos 150 mil" },
      ],
    }).expect(200);
    expect(ctx.llm.calls[0]!.messages).toEqual([
      {
        role: "user",
        content: "[Earlier messages of this conversation are not shown.]",
      },
      { role: "assistant", content: "¿Con qué presupuesto contás?" },
      { role: "user", content: "Unos 150 mil" },
    ]);
  });

  it("still returns the reply when the usage cannot be recorded", async () => {
    ctx.llm.push({ reply: "Hola, ¿qué buscás?" });
    const create = ctx.db.llmUsage.create.bind(ctx.db.llmUsage);
    ctx.db.llmUsage.create = (() =>
      Promise.reject(new Error("db down"))) as unknown as typeof create;
    try {
      const response = await turn({
        messages: [{ role: "lead", body: "Hola" }],
      }).expect(200);
      expect(response.body.reply).toBe("Hola, ¿qué buscás?");
    } finally {
      ctx.db.llmUsage.create = create;
    }
  });

  it("shows what the model wrote whenever the turn stops, even if it matches the fixed line", async () => {
    ctx.llm.push({
      reply: "Un asesor te va a responder eso.",
      needsHuman: true,
    });
    const response = await turn({
      messages: [{ role: "lead", body: "Quiero hacer un reclamo" }],
    }).expect(200);
    expect(response.body).toMatchObject({
      reply: "Un asesor te va a responder eso.",
      modelReply: "Un asesor te va a responder eso.",
      stoppedReason: "lead_needs_human",
    });
  });

  it("accepts back a call time longer than one WhatsApp message", async () => {
    const long = "a".repeat(5_000);
    ctx.llm.push({ reply: "Anotado.", callTime: long }, { reply: "¡Dale!" });
    const first = await turn({
      messages: [{ role: "lead", body: "Llamame cuando sea" }],
    }).expect(200);
    expect(first.body.lead.callTime).toHaveLength(5_000);
    await turn({
      messages: [
        { role: "lead", body: "Llamame cuando sea" },
        { role: "assistant", body: "Anotado." },
        { role: "lead", body: "Gracias" },
      ],
      lead: first.body.lead,
    }).expect(200);
  });

  it("answers a body over the limit or not JSON with a client error", async () => {
    const big = await request(app)
      .post("/internal/assistant-test/turn")
      .set(asAna)
      .set("Content-Type", "application/json")
      .send(
        JSON.stringify({
          messages: [{ role: "lead", body: "é".repeat(80_000) }],
        }),
      )
      .expect(413);
    expect(big.body.error.code).toBe("body_too_large");
    const broken = await request(app)
      .post("/internal/assistant-test/turn")
      .set(asAna)
      .set("Content-Type", "application/json")
      .send("{not json")
      .expect(400);
    expect(broken.body.error.code).toBe("invalid_json");
  });

  it("keeps the form note out when the history limit cuts a WhatsApp conversation at a reply", async () => {
    await db.company.update({
      where: { id: companyId },
      data: {
        config: parseCompanyConfig({ ...baseConfig, llm: { historyLimit: 4 } }),
      },
    });
    ctx.llm.push({ reply: "¡Genial!" });
    await turn({
      messages: [
        { role: "lead", body: "Hola" },
        { role: "assistant", body: "¿Qué buscás?" },
        { role: "lead", body: "Un 2 dormitorios" },
        { role: "assistant", body: "¿Con qué presupuesto?" },
        { role: "lead", body: "150 mil" },
      ],
    }).expect(200);
    // The question the lead is answering stays in the window.
    expect(ctx.llm.calls[0]!.messages).toEqual([
      {
        role: "user",
        content: "[Earlier messages of this conversation are not shown.]",
      },
      { role: "assistant", content: "¿Qué buscás?" },
      { role: "user", content: "Un 2 dormitorios" },
      { role: "assistant", content: "¿Con qué presupuesto?" },
      { role: "user", content: "150 mil" },
    ]);
  });
});
