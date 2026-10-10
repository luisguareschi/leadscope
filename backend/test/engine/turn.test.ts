import { describe, expect, it } from "vitest";
import { decideTurn, mergeFields, stageForPrompt } from "../../src/engine/turn.js";
import type { ModelTurn, ThreadSnapshot, TurnRules } from "../../src/engine/types.js";

const rules: TurnRules = {
  maxReplyChars: 200,
  forbiddenPatterns: ["rentabilidad", "renta garantizada"],
  messages: { fallback: "FALLBACK", needsHuman: "NEEDS_HUMAN", nonText: "NON_TEXT" },
};

const empty = { interest: null, budget: null, knowsProjects: null, callTime: null };
const thread = (overrides: Partial<ThreadSnapshot> = {}): ThreadSnapshot => ({ state: "qualify", ...empty, ...overrides });
const model = (overrides: Partial<ModelTurn> = {}) =>
  ({ kind: "model", output: { reply: "Ok.", intent: "continue", ...empty, ...overrides } }) as const;
const qualified = { interest: "2 dormitorios", budget: "USD 150.000", knowsProjects: false };

describe("decideTurn", () => {
  it("moves a new lead from greeting to qualify", () => {
    const decision = decideTurn(thread({ state: "greeting" }), model({ reply: "Hola, ¿qué buscás?" }), rules);
    expect(decision).toMatchObject({ state: "qualify", reply: "Hola, ¿qué buscás?", crm: null, needsHuman: null });
  });

  it("stays in qualify until interest, budget, and knowsProjects are all stored", () => {
    const decision = decideTurn(thread(), model({ interest: "Para vivir", budget: "100k" }), rules);
    expect(decision.state).toBe("qualify");
    expect(decision.fields).toMatchObject({ interest: "Para vivir", budget: "100k", knowsProjects: null });
  });

  it("does not let intent=qualified skip the qualify gate", () => {
    const decision = decideTurn(thread(), model({ intent: "qualified", interest: "Para vivir" }), rules);
    expect(decision.state).toBe("qualify");
    expect(decision.crm).toBeNull();
  });

  it("counts knowsProjects=false as an answer and moves to handoff to ask for a call time", () => {
    const decision = decideTurn(
      thread({ interest: "Para vivir", budget: "100k" }),
      model({ knowsProjects: false, reply: "¿Cuándo te llamamos?" }),
      rules,
    );
    expect(decision).toMatchObject({ state: "handoff", crm: null });
  });

  it("writes the CRM once, on the turn that completes the handoff", () => {
    const first = decideTurn(thread({ state: "handoff", ...qualified }), model({ callTime: "Mañana a las 10" }), rules);
    expect(first).toMatchObject({ state: "handoff", crm: "handoff" });

    const again = decideTurn(thread({ state: "handoff", ...qualified, callTime: "Mañana a las 10" }), model(), rules);
    expect(again).toMatchObject({ state: "answer", crm: null });
  });

  it("completes the handoff in a single turn when the lead gives everything at once", () => {
    const decision = decideTurn(thread({ state: "greeting" }), model({ ...qualified, callTime: "Hoy 18 h" }), rules);
    expect(decision).toMatchObject({ state: "handoff", crm: "handoff" });
  });

  it("closes the thread and writes the CRM when the lead is not interested", () => {
    const decision = decideTurn(thread({ interest: "x" }), model({ intent: "not_interested", reply: "Gracias." }), rules);
    expect(decision).toMatchObject({ state: "closed", crm: "close", reply: "Gracias." });
  });

  it("reopens a closed thread in answer and keeps what it knew", () => {
    const decision = decideTurn(thread({ state: "closed", interest: "x" }), model({ reply: "Claro." }), rules);
    expect(decision).toMatchObject({ state: "answer", fields: { interest: "x" } });
  });

  it("asks for a call time again after a reopened closed thread completes the three answers", () => {
    const decision = decideTurn(thread({ state: "closed" }), model(qualified), rules);
    expect(decision.state).toBe("handoff");
  });

  it("sends the fixed line, stops, and writes the CRM when the lead needs a person", () => {
    const decision = decideTurn(thread(), model({ intent: "needs_human", reply: "La rentabilidad la ve un asesor" }), rules);
    expect(decision).toMatchObject({
      reply: "NEEDS_HUMAN",
      needsHuman: { reason: "lead_needs_human" },
      crm: "needs_human",
      state: "qualify",
    });
  });

  it("blocks a reply that mentions a forbidden topic", () => {
    const decision = decideTurn(thread(), model({ reply: "La Rentabilidad es del 8% anual" }), rules);
    expect(decision.reply).toBe("FALLBACK");
    expect(decision.needsHuman?.reason).toBe("blocked_reply: rentabilidad");
    expect(decision.crm).toBe("needs_human");
  });

  it("keeps fields the lead gave even when the reply is blocked", () => {
    const decision = decideTurn(thread(), model({ reply: "renta garantizada", budget: "200k" }), rules);
    expect(decision.fields.budget).toBe("200k");
  });

  it("falls back and waits for a person when the model fails", () => {
    const decision = decideTurn(thread({ interest: "x" }), { kind: "model_failure", reason: "timeout" }, rules);
    expect(decision).toMatchObject({
      reply: "FALLBACK",
      needsHuman: { reason: "model_failure: timeout" },
      crm: "needs_human",
      fields: { interest: "x" },
    });
  });

  it("asks the lead to type when only audio or images arrived", () => {
    const decision = decideTurn(thread({ state: "greeting" }), { kind: "non_text" }, rules);
    expect(decision).toMatchObject({ reply: "NON_TEXT", state: "greeting", crm: null, needsHuman: null });
  });

  it("treats an empty model reply as a failure", () => {
    const decision = decideTurn(thread(), model({ reply: "   " }), rules);
    expect(decision.needsHuman?.reason).toBe("empty_reply");
  });

  it("caps long replies", () => {
    const long = `${"Primera frase corta. ".repeat(20)}Final`;
    const decision = decideTurn(thread(), model({ reply: long }), rules);
    expect(decision.reply.length).toBeLessThanOrEqual(200);
    expect(decision.reply.endsWith(".")).toBe(true);
  });
});

describe("mergeFields", () => {
  it("lets a new answer replace the old one and ignores blanks", () => {
    expect(
      mergeFields(
        { interest: "Para vivir", budget: "100k", knowsProjects: true, callTime: null },
        { interest: "  ", budget: "Mejor 150k", knowsProjects: null, callTime: null },
      ),
    ).toEqual({ interest: "Para vivir", budget: "Mejor 150k", knowsProjects: true, callTime: null });
  });
});

describe("stageForPrompt", () => {
  it("shows a completed handoff and a closed thread as answer", () => {
    expect(stageForPrompt(thread({ state: "handoff", ...qualified, callTime: "x" }))).toBe("answer");
    expect(stageForPrompt(thread({ state: "handoff", ...qualified }))).toBe("handoff");
    expect(stageForPrompt(thread({ state: "closed" }))).toBe("answer");
  });
});
