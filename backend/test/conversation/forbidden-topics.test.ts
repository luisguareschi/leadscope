import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ALTAMIRA_NAME,
  altamiraConfig,
} from "../../prisma/seed-data/altamira.js";
import { parseCompanyConfig } from "../../src/companies/company-config.js";
import { recordInboundMessage } from "../../src/conversation/inbound.js";
import { processThread } from "../../src/conversation/process-thread.js";
import { buildChatTurns } from "../../src/engine/history.js";
import {
  buildPlatformRules,
  buildSystemPrompt,
  buildTurnContext,
} from "../../src/engine/prompt.js";
import { createAnthropicClient } from "../../src/llm/anthropic.js";
import { createFakeLlm } from "../../src/llm/fake-llm.js";
import type { CompleteInput } from "../../src/llm/types.js";
import {
  ALLOWED_QUESTIONS,
  YIELD_ATTEMPTS,
} from "../fixtures/forbidden-topic-messages.js";
import {
  createCompany,
  createTestContext,
  inbound,
  resetDb,
  testDb,
  type TestContext,
  settle,
} from "../support/harness.js";

const altamira = parseCompanyConfig(altamiraConfig);
const YIELD_TOPIC = altamira.forbiddenTopics.describe[0]!;

function turnFor(lead: string): CompleteInput {
  const thread = {
    state: "qualify" as const,
    collected: { interest: "Para invertir" },
    summary: null,
    callTime: null,
    name: "Ana",
    source: "whatsapp" as const,
  };
  return {
    model: altamira.llm.model,
    temperature: 0,
    timeoutMs: 25_000,
    system: buildSystemPrompt({
      config: altamira,
      companyName: ALTAMIRA_NAME,
      instructions: "",
      documents: [],
    }),
    turnContext: buildTurnContext(thread, altamira, ALTAMIRA_NAME, new Date()),
    messages: buildChatTurns(
      [{ direction: "inbound", type: "text", body: lead }],
      40,
    ),
    scenario: {
      thread,
      config: altamira,
      companyName: ALTAMIRA_NAME,
      documents: [],
    },
  };
}

describe("a lead asking for rental yield or guaranteed returns", () => {
  let ctx: TestContext;
  let pnid: string;

  beforeEach(async () => {
    await resetDb();
    pnid = (await createCompany(testDb(), { config: altamiraConfig }))
      .whatsappPhoneNumberId!;
    ctx = createTestContext();
  });
  afterEach(() => settle(ctx));

  it.each(YIELD_ATTEMPTS)(
    "gets the fixed line, never the model's words: $lead",
    async ({ lead, unsafeReply }) => {
      const recorded = await recordInboundMessage(
        ctx,
        inbound(pnid, { body: lead }),
      );
      if (recorded.status !== "recorded") throw new Error(recorded.status);
      ctx.llm.push({
        reply: unsafeReply,
        forbiddenTopic: YIELD_TOPIC,
        collected: { interest: "Para invertir" },
        summary: "- Quiere invertir.\n- Preguntó por la rentabilidad.",
      });

      await processThread(ctx, recorded.threadId);
      await ctx.crm.drain();

      const saved = await testDb().thread.findUniqueOrThrow({
        where: { id: recorded.threadId },
        include: { messages: { where: { direction: "outbound" } } },
      });
      expect(saved.messages.map((message) => message.body)).toEqual([
        altamira.messages.needsHuman,
      ]);
      expect(ctx.integrations.fakes.channel.sent).toMatchObject([
        { kind: "text", body: altamira.messages.needsHuman },
      ]);
      expect(saved).toMatchObject({
        needsHuman: true,
        needsHumanReason: `forbidden_topic: ${YIELD_TOPIC}`,
        summary: "- Quiere invertir.\n- Preguntó por la rentabilidad.",
        collected: { interest: "Para invertir" },
        crmPendingAction: null,
      });
      const crm =
        ctx.integrations.fakes.crm.contacts.get("+59899111222")?.lead.summary ??
        "";
      expect(crm).toContain("Estado: Requiere atención de un asesor");
      expect(crm).toContain(`Motivo: forbidden_topic: ${YIELD_TOPIC}`);
      expect(crm).toContain(`Lead: ${lead}`);
      expect(crm).not.toContain(unsafeReply);
    },
  );

  it("stays quiet afterwards until an operator marks the thread attended", async () => {
    const first = await recordInboundMessage(
      ctx,
      inbound(pnid, { body: YIELD_ATTEMPTS[0]!.lead }),
    );
    if (first.status !== "recorded") throw new Error(first.status);
    ctx.llm.push({ reply: "x", forbiddenTopic: YIELD_TOPIC });
    await processThread(ctx, first.threadId);
    const later = await recordInboundMessage(
      ctx,
      inbound(pnid, { body: "¿Y entonces?" }),
    );
    expect(later).toMatchObject({ status: "recorded", needsReply: false });
    await processThread(ctx, first.threadId);
    expect(ctx.llm.calls).toHaveLength(1);
    expect(ctx.integrations.fakes.channel.sent).toHaveLength(1);
  });
});

describe("the prompt and tool for forbidden topics", () => {
  it("lists the topics in plain language and asks for the flag, with no patterns", () => {
    const rules = buildPlatformRules(altamira, ALTAMIRA_NAME);
    for (const topic of altamira.forbiddenTopics.describe)
      expect(rules).toContain(`- ${topic}`);
    expect(rules).toContain("set forbiddenTopic to that topic");
    expect(rules).toContain(
      `the lead receives "${altamira.messages.needsHuman}"`,
    );
    expect(JSON.stringify(altamira)).not.toContain("patterns");
  });
});

describe("the local fake model", () => {
  const fake = createFakeLlm();

  it.each(YIELD_ATTEMPTS)("flags: $lead", async ({ lead }) => {
    const { output } = await fake.complete(turnFor(lead));
    expect(output.forbiddenTopic).not.toBeNull();
    expect(altamira.forbiddenTopics.describe).toContain(output.forbiddenTopic);
  });

  it.each(ALLOWED_QUESTIONS)("does not flag: %s", async (lead) => {
    const { output } = await fake.complete(turnFor(lead));
    expect(output.forbiddenTopic).toBeNull();
  });
});

const apiKey = process.env.ANTHROPIC_API_KEY;

/** Live check for prompt tuning: `ANTHROPIC_API_KEY=… npx vitest run forbidden-topics`. */
describe.skipIf(!apiKey)("the real model (ANTHROPIC_API_KEY)", () => {
  const client = apiKey ? createAnthropicClient(apiKey) : null;

  it.each(YIELD_ATTEMPTS)(
    "flags: $lead",
    async ({ lead }) => {
      const { output } = await client!.complete(turnFor(lead));
      expect(output.forbiddenTopic).not.toBeNull();
    },
    30_000,
  );

  it.each(ALLOWED_QUESTIONS)(
    "does not flag: %s",
    async (lead) => {
      const { output } = await client!.complete(turnFor(lead));
      expect(output.forbiddenTopic).toBeNull();
    },
    30_000,
  );
});
