import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { applyTurn } from "../src/engine/transition";
import { ModelOutput, ThreadSnapshot, TurnOptions } from "../src/engine/types";

const options: TurnOptions = {
  fallbackMessage: "Te va a contactar un asesor.",
  nonTextMessage: "¿Me lo podés escribir? Así te ayudo.",
  maxReplyChars: 80,
  forbiddenTopics: ["renta garantizada", "retorno garantizado"],
};

function thread(patch: Partial<ThreadSnapshot> = {}): ThreadSnapshot {
  return {
    state: "Qualify",
    paused: false,
    needsHuman: false,
    interest: null,
    budget: null,
    knowsProjects: null,
    callTime: null,
    ...patch,
  };
}

function model(patch: Partial<ModelOutput> = {}): ModelOutput {
  return {
    reply: "Dale.",
    interest: null,
    budget: null,
    knowsProjects: null,
    callTime: null,
    intent: "continue",
    ...patch,
  };
}

test("qualified intent does not leave Qualify until the three answers are stored", () => {
  const decision = applyTurn(
    thread({ interest: "2 dormitorios" }),
    { kind: "inbound_text", model: model({ intent: "qualified", reply: "Te derivo." }) },
    options,
  );
  assert.equal(decision.state, "Qualify");
  assert.equal(decision.crm, "none");
  assert.equal(decision.outbound, "Te derivo.");
});

test("a budget phrase is enough and a blank budget is not", () => {
  const missing = applyTurn(
    thread({ interest: "2 dormitorios", knowsProjects: true }),
    { kind: "inbound_text", model: model({ budget: "   ", intent: "qualified" }) },
    options,
  );
  assert.equal(missing.state, "Qualify");

  const stored = applyTurn(
    thread({ interest: "2 dormitorios", knowsProjects: false }),
    { kind: "inbound_text", model: model({ budget: "no sé", intent: "qualified" }) },
    options,
  );
  assert.equal(stored.state, "Handoff");
  assert.equal(stored.budget, "no sé");
  assert.equal(stored.knowsProjects, false);
  assert.equal(stored.crm, "none");
});

test("not knowing the projects still qualifies", () => {
  const decision = applyTurn(
    thread(),
    {
      kind: "inbound_text",
      model: model({
        interest: "inversión",
        budget: "hasta 150",
        knowsProjects: false,
        intent: "qualified",
        reply: "¿Cuándo te puede llamar un asesor?",
      }),
    },
    options,
  );
  assert.equal(decision.state, "Handoff");
  assert.equal(decision.knowsProjects, false);
  assert.equal(decision.crm, "none");
});

test("three answers and continue moves to Answer, not Handoff", () => {
  const decision = applyTurn(
    thread(),
    {
      kind: "inbound_text",
      model: model({
        interest: "vivir",
        budget: "100 mil",
        knowsProjects: true,
        intent: "continue",
      }),
    },
    options,
  );
  assert.equal(decision.state, "Answer");
  assert.equal(decision.crm, "none");
});

test("refusal closes and writes the CRM without an advisor handoff", () => {
  const decision = applyTurn(
    thread({ state: "Greeting" }),
    { kind: "inbound_text", model: model({ intent: "not_interested", reply: "Gracias por avisar." }) },
    options,
  );
  assert.equal(decision.state, "Closed");
  assert.equal(decision.crm, "close");
  assert.equal(decision.outbound, "Gracias por avisar.");
});

test("greeting advances to Qualify when the lead has not answered yet", () => {
  const decision = applyTurn(
    thread({ state: "Greeting" }),
    { kind: "inbound_text", model: model({ reply: "Hola, ¿qué estás buscando?" }) },
    options,
  );
  assert.equal(decision.state, "Qualify");
  assert.equal(decision.crm, "none");
});

test("call time plus the three answers finishes handoff", () => {
  const decision = applyTurn(
    thread({
      state: "Handoff",
      interest: "vivir",
      budget: "100 mil",
      knowsProjects: true,
    }),
    { kind: "inbound_text", model: model({ callTime: "mañana a las 10", reply: "Quedó anotado." }) },
    options,
  );
  assert.equal(decision.state, "Handoff");
  assert.equal(decision.callTime, "mañana a las 10");
  assert.equal(decision.crm, "handoff");
});

test("a later message after a finished handoff reopens in Answer and does not write the CRM again", () => {
  const decision = applyTurn(
    thread({
      state: "Handoff",
      interest: "vivir",
      budget: "100 mil",
      knowsProjects: true,
      callTime: "mañana a las 10",
    }),
    { kind: "inbound_text", model: model({ intent: "continue", reply: "El precio arranca en la ficha." }) },
    options,
  );
  assert.equal(decision.state, "Answer");
  assert.equal(decision.crm, "none");
  assert.equal(decision.callTime, "mañana a las 10");
});

test("a later message after Closed reopens in Answer", () => {
  const decision = applyTurn(
    thread({ state: "Closed", interest: "vivir" }),
    { kind: "inbound_text", model: model({ reply: "Hola de nuevo." }) },
    options,
  );
  assert.equal(decision.state, "Answer");
  assert.equal(decision.crm, "none");
  assert.equal(decision.interest, "vivir");
});

test("needs_human intent sends the fixed line and stops the bot", () => {
  const decision = applyTurn(
    thread({ interest: "vivir", budget: "100 mil", knowsProjects: true }),
    {
      kind: "inbound_text",
      model: model({ intent: "needs_human", reply: "No te puedo decir eso." }),
    },
    options,
  );
  assert.equal(decision.needsHuman, true);
  assert.equal(decision.outbound, options.fallbackMessage);
  assert.equal(decision.state, "Qualify");
  assert.equal(decision.crm, "none");
});

test("a reply that mentions a forbidden topic is replaced and does not hand off", () => {
  const decision = applyTurn(
    thread({ interest: "vivir", budget: "100 mil", knowsProjects: true }),
    {
      kind: "inbound_text",
      model: model({
        intent: "qualified",
        callTime: "viernes",
        reply: "La renta garantizada es del 8%.",
      }),
    },
    options,
  );
  assert.equal(decision.needsHuman, true);
  assert.equal(decision.outbound, options.fallbackMessage);
  assert.equal(decision.crm, "none");
  assert.notEqual(decision.state, "Closed");
});

test("model failure sets needsHuman, including when reopening a closed thread", () => {
  const greeting = applyTurn(thread({ state: "Greeting" }), { kind: "model_failure" }, options);
  assert.equal(greeting.state, "Greeting");
  assert.equal(greeting.needsHuman, true);
  assert.equal(greeting.outbound, options.fallbackMessage);

  const reopened = applyTurn(thread({ state: "Closed" }), { kind: "model_failure" }, options);
  assert.equal(reopened.state, "Answer");
  assert.equal(reopened.needsHuman, true);
});

test("while needsHuman is set the bot stays silent", () => {
  const decision = applyTurn(
    thread({ needsHuman: true, state: "Answer", interest: "vivir" }),
    { kind: "inbound_text", model: model({ reply: "Sigo.", interest: "otro" }) },
    options,
  );
  assert.equal(decision.outbound, null);
  assert.equal(decision.needsHuman, true);
  assert.equal(decision.state, "Answer");
  assert.equal(decision.interest, "vivir");
});

test("pause stores the turn without answering or changing state", () => {
  const decision = applyTurn(
    thread({ paused: true, state: "Answer", budget: "100 mil" }),
    { kind: "inbound_text", model: model({ reply: "Hola", budget: "otro", intent: "qualified" }) },
    options,
  );
  assert.equal(decision.outbound, null);
  assert.equal(decision.state, "Answer");
  assert.equal(decision.paused, true);
  assert.equal(decision.budget, "100 mil");
  assert.equal(decision.crm, "none");
});

test("a non-text message asks them to type and does not reopen", () => {
  const decision = applyTurn(thread({ state: "Closed" }), { kind: "non_text" }, options);
  assert.equal(decision.outbound, options.nonTextMessage);
  assert.equal(decision.state, "Closed");
  assert.equal(decision.needsHuman, false);
});

test("long replies are capped", () => {
  const decision = applyTurn(
    thread({ state: "Greeting" }),
    { kind: "inbound_text", model: model({ reply: "a".repeat(200) }) },
    options,
  );
  assert.ok(decision.outbound);
  assert.ok(decision.outbound!.length <= 80);
  assert.ok(decision.outbound!.endsWith("…"));
});

test("engine source does not branch on the company name", () => {
  const root = path.join(__dirname, "../src/engine");
  const files = readdirSync(root).filter((file) => file.endsWith(".ts"));
  for (const file of files) {
    const source = readFileSync(path.join(root, file), "utf8").toLowerCase();
    assert.equal(source.includes("altamira"), false, file);
  }
});
