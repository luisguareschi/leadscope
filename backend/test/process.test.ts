import assert from "node:assert/strict";
import test from "node:test";
import { seedAltamira } from "../src/companies/seed";
import { processThread, recordInbound, WhatsAppDeps } from "../src/services/whatsapp.service";
import { FakeChannel } from "../src/integrations/channel";
import { FakeCrm } from "../src/integrations/crm/types";
import { CompleteFn } from "../src/llm/types";
import { ModelOutput } from "../src/engine/types";
import { db, exclusive, resetDb, testKey } from "./db";

async function harness(complete: CompleteFn) {
  await resetDb();
  const key = testKey();
  await seedAltamira(db, key, { email: "operador@example.com", supabaseUserId: "fake-user" });
  const channel = new FakeChannel();
  const crm = new FakeCrm();
  const deps: WhatsAppDeps = { db, key, channel, crm, complete, model: "claude-haiku-4-5" };
  const company = await db.company.findFirstOrThrow();
  return { channel, crm, deps, company };
}

function scripted(outputs: ModelOutput[]): CompleteFn {
  return async () => {
    const output = outputs.shift();
    if (!output) throw new Error("no scripted model output");
    return { output, model: "test", inputTokens: 3, outputTokens: 2 };
  };
}

const quiet: ModelOutput = {
  reply: "Hola, ¿qué estás buscando?",
  interest: null,
  budget: null,
  knowsProjects: null,
  callTime: null,
  intent: "continue",
};

test("duplicate whatsapp ids are stored once", async () => {
  await exclusive(async () => {
    const { deps, company } = await harness(scripted([quiet]));
    const inbound = {
      phoneNumberId: company.whatsappPhoneNumberId!,
      from: "59899111222",
      messageId: "wamid.1",
      contentType: "text",
      text: "hola",
    };
    const first = await recordInbound(deps, inbound);
    const second = await recordInbound(deps, inbound);
    assert.equal(first.duplicate, false);
    assert.equal(second.duplicate, true);
    assert.equal(await db.message.count({ where: { threadId: first.threadId! } }), 1);
  });
});

test("pause keeps the message and sends nothing; resume does not answer until a later turn", async () => {
  await exclusive(async () => {
    const { deps, company, channel } = await harness(scripted([quiet]));
    const recorded = await recordInbound(deps, {
      phoneNumberId: company.whatsappPhoneNumberId!,
      from: "59899111000",
      messageId: "wamid.pause",
      contentType: "text",
      text: "hola",
    });
    await db.thread.update({ where: { id: recorded.threadId! }, data: { paused: true, state: "Answer" } });
    await processThread(deps, recorded.threadId!);
    assert.equal(channel.sent.length, 0);
    const paused = await db.thread.findUnique({ where: { id: recorded.threadId! } });
    assert.equal(paused?.state, "Answer");
    assert.equal(paused?.paused, true);

    await db.thread.update({ where: { id: recorded.threadId! }, data: { paused: false } });
    await processThread(deps, recorded.threadId!);
    assert.equal(channel.sent.length, 1);
    const resumed = await db.thread.findUnique({ where: { id: recorded.threadId! } });
    assert.equal(resumed?.state, "Answer");
    assert.equal(resumed?.paused, false);
  });
});

test("needsHuman stays silent until the flag is cleared", async () => {
  await exclusive(async () => {
    let calls = 0;
    const { deps, channel } = await harness(async () => {
      calls += 1;
      if (calls === 1) throw new Error("anthropic down");
      return {
        output: {
          reply: "¿Qué estás buscando?",
          interest: null,
          budget: null,
          knowsProjects: null,
          callTime: null,
          intent: "continue" as const,
        },
        model: "test",
        inputTokens: 1,
        outputTokens: 1,
      };
    });
    const company = await db.company.findFirstOrThrow();
    const recorded = await recordInbound(deps, {
      phoneNumberId: company.whatsappPhoneNumberId!,
      from: "59899222000",
      messageId: "wamid.fail",
      contentType: "text",
      text: "hola",
    });
    await processThread(deps, recorded.threadId!);
    assert.equal(channel.sent.length, 1);
    assert.deepEqual(channel.sent[0], { kind: "text", body: "Te va a contactar un asesor." });
    const flagged = await db.thread.findUnique({ where: { id: recorded.threadId! } });
    assert.equal(flagged?.needsHuman, true);

    await recordInbound(deps, {
      phoneNumberId: company.whatsappPhoneNumberId!,
      from: "59899222000",
      messageId: "wamid.fail.2",
      contentType: "text",
      text: "sigo",
    });
    await processThread(deps, recorded.threadId!);
    assert.equal(channel.sent.length, 1);
    assert.equal(calls, 1);

    await db.thread.update({ where: { id: recorded.threadId! }, data: { needsHuman: false } });
    await processThread(deps, recorded.threadId!);
    assert.equal(channel.sent.length, 2);
    assert.deepEqual(channel.sent[1], { kind: "text", body: "¿Qué estás buscando?" });
    const cleared = await db.thread.findUnique({ where: { id: recorded.threadId! } });
    assert.equal(cleared?.needsHuman, false);
  });
});

test("a qualified intent without a budget does not hand off", async () => {
  await exclusive(async () => {
    const { deps, company, crm } = await harness(
      scripted([
        {
          reply: "Te derivo.",
          interest: "2 dormitorios",
          budget: null,
          knowsProjects: true,
          callTime: null,
          intent: "qualified",
        },
      ]),
    );
    const recorded = await recordInbound(deps, {
      phoneNumberId: company.whatsappPhoneNumberId!,
      from: "59899333000",
      messageId: "wamid.gate",
      contentType: "text",
      text: "quiero dos dormitorios y ya conozco",
    });
    await processThread(deps, recorded.threadId!);
    const thread = await db.thread.findUnique({ where: { id: recorded.threadId! } });
    assert.equal(thread?.state, "Qualify");
    assert.equal(crm.contacts.size, 0);
  });
});

test("refusal writes the contact and assigns no handoff", async () => {
  await exclusive(async () => {
    const { deps, company, crm } = await harness(
      scripted([
        {
          reply: "Gracias por avisar.",
          interest: null,
          budget: null,
          knowsProjects: null,
          callTime: null,
          intent: "not_interested",
        },
      ]),
    );
    const recorded = await recordInbound(deps, {
      phoneNumberId: company.whatsappPhoneNumberId!,
      from: "59899444000",
      messageId: "wamid.close",
      contentType: "text",
      text: "no me interesa",
    });
    await processThread(deps, recorded.threadId!);
    const thread = await db.thread.findUnique({ where: { id: recorded.threadId! } });
    assert.equal(thread?.state, "Closed");
    assert.equal(crm.contacts.size, 1);
    const contact = [...crm.contacts.values()][0];
    assert.match(contact.summary, /Conoce los proyectos:/);
    assert.equal(contact.transcriptProperty, "");
  });
});

test("voice asks for text once", async () => {
  await exclusive(async () => {
    const { deps, company, channel } = await harness(scripted([]));
    const recorded = await recordInbound(deps, {
      phoneNumberId: company.whatsappPhoneNumberId!,
      from: "59899555000",
      messageId: "wamid.audio",
      contentType: "audio",
      text: null,
    });
    await processThread(deps, recorded.threadId!);
    assert.equal(channel.sent.length, 1);
    assert.match(channel.sent[0].kind === "text" ? channel.sent[0].body : "", /escrib/);
    const thread = await db.thread.findUnique({ where: { id: recorded.threadId! } });
    assert.equal(thread?.state, "Greeting");
  });
});

test("a message after Closed reopens the same thread in Answer", async () => {
  await exclusive(async () => {
    const { deps, company } = await harness(
      scripted([
        {
          reply: "Te respondo con la ficha.",
          interest: null,
          budget: null,
          knowsProjects: null,
          callTime: null,
          intent: "continue",
        },
      ]),
    );
    const recorded = await recordInbound(deps, {
      phoneNumberId: company.whatsappPhoneNumberId!,
      from: "59899666000",
      messageId: "wamid.reopen",
      contentType: "text",
      text: "hola de nuevo",
    });
    await db.thread.update({
      where: { id: recorded.threadId! },
      data: { state: "Closed", interest: "vivir", budget: "100 mil", knowsProjects: true },
    });
    await processThread(deps, recorded.threadId!);
    const thread = await db.thread.findUnique({ where: { id: recorded.threadId! } });
    assert.equal(thread?.state, "Answer");
    assert.equal(thread?.interest, "vivir");
  });
});
