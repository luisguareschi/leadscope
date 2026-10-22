import { describe, expect, it } from "vitest";
import {
  CALL_NOW_TIME,
  collectedOf,
  decideTurn,
  hasRequiredItems,
  MAX_SUMMARY_CHARS,
  mergeFields,
  stageForPrompt,
  stateForManualStage,
} from "../../src/engine/turn.js";
import type {
  ModelTurn,
  ThreadSnapshot,
  TurnRules,
} from "../../src/engine/types.js";

const rules: TurnRules = {
  maxReplyChars: 200,
  collect: [
    { key: "interest", required: true },
    { key: "budget", required: true },
    { key: "knowsProjects", required: true },
  ],
  messages: {
    fallback: "FALLBACK",
    needsHuman: "NEEDS_HUMAN",
    nonText: "NON_TEXT",
  },
};

const thread = (overrides: Partial<ThreadSnapshot> = {}): ThreadSnapshot => ({
  state: "qualify",
  collected: {},
  callTime: null,
  summary: null,
  ...overrides,
});
const model = (overrides: Partial<ModelTurn> = {}) =>
  ({
    kind: "model",
    output: {
      reply: "Ok.",
      intent: "continue",
      collected: {},
      callTime: null,
      needsHuman: false,
      callNow: false,
      forbiddenTopic: null,
      summary: null,
      ...overrides,
    },
  }) as const;
const qualified = {
  interest: "2 dormitorios",
  budget: "USD 150.000",
  knowsProjects: "No",
};

describe("decideTurn", () => {
  it("moves a new lead from greeting to qualify", () => {
    const decision = decideTurn(
      thread({ state: "greeting" }),
      model({ reply: "Hola, ¿qué buscás?" }),
      rules,
    );
    expect(decision).toMatchObject({
      state: "qualify",
      reply: "Hola, ¿qué buscás?",
      crm: null,
      needsHuman: null,
    });
  });

  it("stays in qualify until every required item is stored", () => {
    const decision = decideTurn(
      thread(),
      model({ collected: { interest: "Para vivir", budget: "100k" } }),
      rules,
    );
    expect(decision.state).toBe("qualify");
    expect(decision.fields.collected).toEqual({
      interest: "Para vivir",
      budget: "100k",
    });
  });

  it("does not let intent=qualified skip the required items", () => {
    const decision = decideTurn(
      thread(),
      model({ intent: "qualified", collected: { interest: "Para vivir" } }),
      rules,
    );
    expect(decision.state).toBe("qualify");
    expect(decision.crm).toBeNull();
  });

  it("moves to handoff to ask for a call time once the last required item arrives, in any order", () => {
    const decision = decideTurn(
      thread({ collected: { knowsProjects: "No", budget: "100k" } }),
      model({
        collected: { interest: "Para vivir" },
        reply: "¿Cuándo te llamamos?",
      }),
      rules,
    );
    expect(decision).toMatchObject({ state: "handoff", crm: null });
  });

  it("does not wait for optional items", () => {
    const withOptional: TurnRules = {
      ...rules,
      collect: [
        { key: "budget", required: true },
        { key: "zone", required: false },
      ],
    };
    const decision = decideTurn(
      thread(),
      model({ collected: { budget: "USD 200.000" } }),
      withOptional,
    );
    expect(decision.state).toBe("handoff");
    expect(
      hasRequiredItems(
        { collected: { zone: "Pocitos" }, callTime: null },
        withOptional.collect,
      ),
    ).toBe(false);
  });

  it("treats a value under a key the company does not ask for as nothing", () => {
    const decision = decideTurn(
      thread({ collected: { interest: "x", budget: "y" } }),
      model({ collected: { somethingElse: "z" } }),
      rules,
    );
    expect(decision.state).toBe("qualify");
    expect(decision.fields.collected).toEqual({ interest: "x", budget: "y" });
  });

  it("writes the CRM once, on the turn that completes the handoff", () => {
    const first = decideTurn(
      thread({ state: "handoff", collected: qualified }),
      model({ callTime: "Mañana a las 10" }),
      rules,
    );
    expect(first).toMatchObject({ state: "handoff", crm: "handoff" });

    const again = decideTurn(
      thread({
        state: "handoff",
        collected: qualified,
        callTime: "Mañana a las 10",
      }),
      model(),
      rules,
    );
    expect(again).toMatchObject({ state: "answer", crm: null });
  });

  it("completes the handoff in a single turn when the lead gives everything at once", () => {
    const decision = decideTurn(
      thread({ state: "greeting" }),
      model({ collected: qualified, callTime: "Hoy 18 h" }),
      rules,
    );
    expect(decision).toMatchObject({ state: "handoff", crm: "handoff" });
  });

  it("closes the thread and writes the CRM when the lead is not interested", () => {
    const decision = decideTurn(
      thread({ collected: { interest: "x" } }),
      model({ intent: "not_interested", reply: "Gracias." }),
      rules,
    );
    expect(decision).toMatchObject({
      state: "closed",
      crm: "close",
      reply: "Gracias.",
      needsHuman: null,
    });
  });

  it("reopens a closed thread in answer and keeps what it knew", () => {
    const decision = decideTurn(
      thread({ state: "closed", collected: { interest: "x" } }),
      model({ reply: "Claro." }),
      rules,
    );
    expect(decision).toMatchObject({
      state: "answer",
      fields: { collected: { interest: "x" } },
    });
  });

  it("asks for a call time again after a reopened closed thread completes the required items", () => {
    const decision = decideTurn(
      thread({ state: "closed" }),
      model({ collected: qualified }),
      rules,
    );
    expect(decision.state).toBe("handoff");
  });

  it("sends the fixed line, stops, and writes the CRM when the lead needs a person", () => {
    const decision = decideTurn(
      thread(),
      model({ needsHuman: true, reply: "Te paso con alguien" }),
      rules,
    );
    expect(decision).toMatchObject({
      reply: "NEEDS_HUMAN",
      needsHuman: { reason: "lead_needs_human" },
      crm: "needs_human",
      state: "qualify",
    });
  });

  it("never sends the model's words on a forbidden topic: the engine sends the fixed line and stops", () => {
    const decision = decideTurn(
      thread({ collected: { interest: "Para invertir" } }),
      model({
        reply: "La rentabilidad es del 8% anual",
        forbiddenTopic: "Rentabilidad futura",
        collected: { budget: "USD 120.000" },
        summary: "- Quiere invertir.\n- Preguntó por la rentabilidad.",
      }),
      rules,
    );
    expect(decision).toMatchObject({
      reply: "NEEDS_HUMAN",
      needsHuman: { reason: "forbidden_topic: Rentabilidad futura" },
      crm: "needs_human",
      state: "qualify",
      summary: "- Quiere invertir.\n- Preguntó por la rentabilidad.",
    });
    expect(decision.fields.collected).toEqual({
      interest: "Para invertir",
      budget: "USD 120.000",
    });
  });

  it("puts the forbidden-topic flag ahead of every other path", () => {
    for (const overrides of [
      { intent: "not_interested" as const },
      { needsHuman: true },
      { reply: "  " },
      { collected: qualified, callTime: "mañana" },
    ]) {
      const decision = decideTurn(
        thread(),
        model({ forbiddenTopic: "Rentabilidad futura", ...overrides }),
        rules,
      );
      expect(decision.reply).toBe("NEEDS_HUMAN");
      expect(decision.needsHuman?.reason).toMatch(/^forbidden_topic: /);
      expect(decision.crm).toBe("needs_human");
    }
  });

  it("sends the model's reply when no flag is set, whatever it says", () => {
    const decision = decideTurn(
      thread(),
      model({ reply: "La entrega es en 2027." }),
      rules,
    );
    expect(decision.reply).toBe("La entrega es en 2027.");
    expect(decision.needsHuman).toBeNull();
  });

  it("falls back and waits for a person when the model fails, keeping the summary", () => {
    const decision = decideTurn(
      thread({ collected: { interest: "x" }, summary: "- Busca x." }),
      { kind: "model_failure", reason: "timeout" },
      rules,
    );
    expect(decision).toMatchObject({
      reply: "FALLBACK",
      needsHuman: { reason: "model_failure: timeout" },
      crm: "needs_human",
      fields: { collected: { interest: "x" } },
      summary: "- Busca x.",
    });
  });

  it("asks the lead to type when only audio or images arrived", () => {
    const decision = decideTurn(
      thread({ state: "greeting" }),
      { kind: "non_text" },
      rules,
    );
    expect(decision).toMatchObject({
      reply: "NON_TEXT",
      state: "greeting",
      crm: null,
      needsHuman: null,
    });
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

  it("replaces the summary every turn, keeps it when the model sends none, and caps it", () => {
    const previous = thread({ summary: "- Antes." });
    expect(
      decideTurn(previous, model({ summary: "- Ahora." }), rules).summary,
    ).toBe("- Ahora.");
    expect(decideTurn(previous, model({ summary: " " }), rules).summary).toBe(
      "- Antes.",
    );
    const capped = decideTurn(
      previous,
      model({ summary: `- ${"x".repeat(2_000)}` }),
      rules,
    ).summary!;
    expect(capped.length).toBe(MAX_SUMMARY_CHARS);
    expect(capped.endsWith("…")).toBe(true);
  });
});

describe("lead stage", () => {
  it("moves Calificando to Por contactar once every required item is stored, before the call time", () => {
    expect(
      decideTurn(thread(), model({ collected: { interest: "x" } }), rules)
        .stage,
    ).toBe("qualifying");
    const decision = decideTurn(
      thread({ collected: { interest: "x", budget: "y" } }),
      model({ collected: { knowsProjects: "No" } }),
      rules,
    );
    expect(decision).toMatchObject({
      state: "handoff",
      stage: "to_contact",
      crm: null,
    });
  });

  it("never moves Por contactar back, whatever the lead writes next", () => {
    const handedOff = thread({
      state: "answer",
      stage: "to_contact",
      collected: qualified,
      callTime: "mañana",
    });
    for (const input of [
      model({ reply: "La entrega es en 2027." }),
      model({ intent: "not_interested" }),
      model({ needsHuman: true }),
      model({ forbiddenTopic: "Rentabilidad futura" }),
      { kind: "non_text" } as const,
      { kind: "model_failure", reason: "timeout" } as const,
    ]) {
      expect(decideTurn(handedOff, input, rules).stage).toBe("to_contact");
    }
  });

  it("keeps Por contactar even when the config gained a required item since", () => {
    const decision = decideTurn(
      thread({ state: "answer", stage: "to_contact", collected: qualified }),
      model(),
      {
        ...rules,
        collect: [...rules.collect, { key: "zone", required: true }],
      },
    );
    expect(decision.stage).toBe("to_contact");
  });

  it("keeps Contactado: only a person sets it, and nothing the bot decides changes it", () => {
    const contacted = thread({ state: "answer", stage: "contacted" });
    expect(
      decideTurn(contacted, model({ intent: "not_interested" }), rules).stage,
    ).toBe("contacted");
    expect(
      decideTurn(contacted, model({ collected: qualified }), rules).stage,
    ).toBe("contacted");
  });

  it("moves Calificando to Sin interés, and back to Por contactar only when the lead re-qualifies", () => {
    expect(
      decideTurn(thread(), model({ intent: "not_interested" }), rules).stage,
    ).toBe("not_interested");

    const notInterested = thread({ state: "closed", stage: "not_interested" });
    expect(decideTurn(notInterested, model(), rules).stage).toBe(
      "not_interested",
    );
    expect(
      decideTurn(notInterested, model({ collected: qualified }), rules).stage,
    ).toBe("to_contact");

    const alreadyKnown = thread({
      state: "closed",
      stage: "not_interested",
      collected: qualified,
    });
    expect(
      decideTurn(alreadyKnown, model({ reply: "Gracias" }), rules).stage,
    ).toBe("not_interested");
    expect(
      decideTurn(alreadyKnown, model({ intent: "qualified" }), rules).stage,
    ).toBe("to_contact");
  });

  it("does not hand off on a turn where the bot stops itself", () => {
    const decision = decideTurn(
      thread({ collected: { interest: "x", budget: "y" } }),
      model({ collected: { knowsProjects: "No" }, needsHuman: true }),
      rules,
    );
    expect(decision.stage).toBe("qualifying");
  });
});

describe("a lead who wants to talk to a person now (callNow)", () => {
  it("goes to Por contactar right away with required items missing, call time Lo antes posible", () => {
    const decision = decideTurn(
      thread({ state: "greeting", collected: { interest: "2 dormitorios" } }),
      model({
        callNow: true,
        reply:
          "Un asesor te contacta lo antes posible. Si preferís, llamá al 2600 0000.",
      }),
      rules,
    );
    expect(decision).toMatchObject({
      state: "answer",
      stage: "to_contact",
      fields: {
        collected: { interest: "2 dormitorios" },
        callTime: CALL_NOW_TIME,
      },
      reply:
        "Un asesor te contacta lo antes posible. Si preferís, llamá al 2600 0000.",
      needsHuman: null,
      crm: "handoff",
    });
    expect(CALL_NOW_TIME).toBe("Lo antes posible");
  });

  it("also brings back a Sin interés lead, and never moves Contactado", () => {
    expect(
      decideTurn(
        thread({ state: "closed", stage: "not_interested" }),
        model({ callNow: true }),
        rules,
      ).stage,
    ).toBe("to_contact");
    expect(
      decideTurn(
        thread({ state: "answer", stage: "contacted" }),
        model({ callNow: true }),
        rules,
      ).stage,
    ).toBe("contacted");
  });

  it("does not override a forbidden topic or a lead who needs a person", () => {
    expect(
      decideTurn(
        thread(),
        model({ callNow: true, forbiddenTopic: "Rentabilidad futura" }),
        rules,
      ),
    ).toMatchObject({ stage: "qualifying", reply: "NEEDS_HUMAN" });
    expect(
      decideTurn(thread(), model({ callNow: true, needsHuman: true }), rules),
    ).toMatchObject({ stage: "qualifying", reply: "NEEDS_HUMAN" });
  });

  it("leaves the normal path unchanged without the flag", () => {
    const decision = decideTurn(
      thread(),
      model({ collected: { interest: "Para vivir" } }),
      rules,
    );
    expect(decision).toMatchObject({
      state: "qualify",
      stage: "qualifying",
      fields: { callTime: null },
      crm: null,
    });
  });
});

describe("a company with no required items", () => {
  const allOptional: TurnRules = {
    ...rules,
    collect: [{ key: "zone", required: false }],
  };

  it("moves the lead to Por contactar once it gives a call time, not on its first message", () => {
    const first = decideTurn(
      thread({ state: "greeting" }),
      model({ reply: "Hola" }),
      allOptional,
    );
    expect(first).toMatchObject({ state: "handoff", stage: "qualifying" });

    const withTime = decideTurn(
      thread({ state: "handoff" }),
      model({ callTime: "Mañana a las 10" }),
      allOptional,
    );
    expect(withTime).toMatchObject({ stage: "to_contact", crm: "handoff" });
  });
});

describe("mergeFields", () => {
  it("lets a new answer replace the old one and ignores blanks", () => {
    expect(
      mergeFields(
        {
          collected: { interest: "Para vivir", budget: "100k" },
          callTime: null,
        },
        {
          collected: { interest: "  ", budget: "Mejor 150k", other: "x" },
          callTime: null,
        },
        rules.collect,
      ),
    ).toEqual({
      collected: { interest: "Para vivir", budget: "Mejor 150k" },
      callTime: null,
    });
  });
});

describe("collectedOf", () => {
  it("keeps only non-empty text values", () => {
    expect(
      collectedOf({ interest: " Para vivir ", budget: "", knows: true }),
    ).toEqual({ interest: "Para vivir" });
    expect(collectedOf(null)).toEqual({});
    expect(collectedOf(["x"])).toEqual({});
  });
});

describe("stageForPrompt", () => {
  it("shows a completed handoff and a closed thread as answer", () => {
    expect(
      stageForPrompt(
        thread({ state: "handoff", collected: qualified, callTime: "x" }),
        rules.collect,
      ),
    ).toBe("answer");
    expect(
      stageForPrompt(
        thread({ state: "handoff", collected: qualified }),
        rules.collect,
      ),
    ).toBe("handoff");
    expect(stageForPrompt(thread({ state: "closed" }), rules.collect)).toBe(
      "answer",
    );
  });
});

describe("after a person picks the stage", () => {
  it("puts the conversation step where that stage expects it", () => {
    const answered = thread({
      state: "answer",
      collected: qualified,
      callTime: "mañana",
    });
    expect(stateForManualStage(answered, "not_interested", rules.collect)).toBe(
      "closed",
    );
    expect(
      stateForManualStage(
        thread({ state: "answer", collected: { interest: "x" } }),
        "qualifying",
        rules.collect,
      ),
    ).toBe("qualify");
    expect(
      stateForManualStage(
        thread({ state: "closed", collected: qualified }),
        "qualifying",
        rules.collect,
      ),
    ).toBe("handoff");
    expect(stateForManualStage(answered, "qualifying", rules.collect)).toBe(
      "answer",
    );
    expect(
      stateForManualStage(
        thread({ state: "closed" }),
        "to_contact",
        rules.collect,
      ),
    ).toBe("answer");
    expect(
      stateForManualStage(
        thread({ state: "closed" }),
        "contacted",
        rules.collect,
      ),
    ).toBe("answer");
    expect(
      stateForManualStage(
        thread({ state: "handoff" }),
        "to_contact",
        rules.collect,
      ),
    ).toBe("handoff");
    expect(
      stateForManualStage(
        thread({ state: "greeting" }),
        "not_interested",
        rules.collect,
      ),
    ).toBe("greeting");
  });

  it("moves forward again from a stage a person set back: Calificando with every item goes to Por contactar", () => {
    const backToQualifying = thread({
      state: "handoff",
      stage: "qualifying",
      stageChangedByEmail: "vicky@altamira.uy",
      collected: qualified,
    });
    expect(decideTurn(backToQualifying, model(), rules).stage).toBe(
      "to_contact",
    );
  });

  it("keeps a Sin interés a person set until the lead re-qualifies or asks for a person", () => {
    const marked = thread({
      state: "closed",
      stage: "not_interested",
      stageChangedByEmail: "vicky@altamira.uy",
      collected: qualified,
    });
    expect(
      decideTurn(marked, model({ reply: "La entrega es en 2027." }), rules)
        .stage,
    ).toBe("not_interested");
    expect(decideTurn(marked, model({ callNow: true }), rules).stage).toBe(
      "to_contact",
    );
  });
});
