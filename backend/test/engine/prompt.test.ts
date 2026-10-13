import { describe, expect, it } from "vitest";
import { parseCompanyConfig } from "../../src/companies/company-config.js";
import { buildChatTurns } from "../../src/engine/history.js";
import {
  buildPlatformRules,
  buildSystemPrompt,
  buildTurnContext,
  formatKnowledge,
  nextStepFor,
} from "../../src/engine/prompt.js";
import { baseConfig } from "../support/harness.js";

const config = parseCompanyConfig({
  ...baseConfig,
  businessHours: "lunes a viernes de 9 a 18",
});
const empty = {
  interest: null,
  budget: null,
  knowsProjects: null,
  callTime: null,
};

describe("buildSystemPrompt", () => {
  it("puts the company's questions, forbidden topics, and every document in the prompt", () => {
    const prompt = buildSystemPrompt({
      config,
      instructions: "",
      documents: [
        {
          name: "precios.xlsx",
          updatedAt: new Date("2026-10-01"),
          text: "Torre Sur desde USD 150.000",
        },
        {
          name: 'faq "v2".md',
          updatedAt: new Date("2026-10-05"),
          text: "Entrega: 2027",
        },
      ],
    });
    expect(prompt).toContain("¿Con qué presupuesto contás?");
    expect(prompt).toContain("- Rentabilidad futura");
    expect(prompt).toContain(
      '<document name="precios.xlsx" updated="2026-10-01">\nTorre Sur desde USD 150.000\n</document>',
    );
    expect(prompt).toContain('name="faq &quot;v2&quot;.md"');
    expect(prompt).not.toContain("<company_instructions>");
  });

  it("puts the platform rules first, then the company instructions, then knowledge", () => {
    const prompt = buildSystemPrompt({
      config,
      instructions: "  Mencioná siempre la Torre Sur.  ",
      documents: [],
    });
    const rules = buildPlatformRules(config);
    expect(prompt.startsWith(rules)).toBe(true);
    expect(prompt).toContain(
      "<company_instructions>\nMencioná siempre la Torre Sur.\n</company_instructions>",
    );
    expect(prompt).toContain("the rules above always win");
    expect(prompt.indexOf("<company_instructions>")).toBeLessThan(
      prompt.indexOf("<knowledge>\n"),
    );
  });

  it("states the rules the engine depends on, with the company's own fixed lines", () => {
    const rules = buildPlatformRules(config);
    expect(rules).toContain("Always call the submit_turn tool exactly once.");
    expect(rules).toContain(
      "The lead goes to an advisor only after all three answers are known.",
    );
    expect(rules).toContain(
      'The lead receives "Un asesor te va a responder eso."',
    );
    expect(rules).toContain("within 24 hours of the lead's last message");
    expect(rules).toContain('receives "Te va a contactar un asesor." instead');
  });

  it("says so when there are no documents", () => {
    expect(formatKnowledge([])).toContain("No documents uploaded yet");
  });
});

describe("turn context", () => {
  const now = new Date("2026-10-10T19:00:00Z");

  it("tells the model what is known and the next question", () => {
    const context = buildTurnContext(
      {
        state: "qualify",
        ...empty,
        interest: "2 dormitorios",
        name: "Ana",
        source: "whatsapp",
      },
      config,
      now,
    );
    expect(context).toContain("- Interest: 2 dormitorios");
    expect(context).toContain("- Budget: (unknown)");
    expect(context).toContain(
      'next missing question: "¿Con qué presupuesto contás?"',
    );
    expect(context).toContain("lunes a viernes de 9 a 18");
    expect(context).toContain("America/Montevideo");
  });

  it("mentions the form welcome for form leads", () => {
    const context = buildTurnContext(
      { state: "qualify", ...empty, name: null, source: "form" },
      config,
      now,
    );
    expect(context).toContain("already received a welcome message");
  });

  it("asks for a call time once the three answers are known", () => {
    const step = nextStepFor(
      {
        state: "handoff",
        interest: "a",
        budget: "b",
        knowsProjects: true,
        callTime: null,
      },
      config,
    );
    expect(step).toContain("ask when an advisor can call");
  });

  it("does not re-qualify a lead already handed off", () => {
    const step = nextStepFor(
      {
        state: "handoff",
        interest: "a",
        budget: "b",
        knowsProjects: true,
        callTime: "mañana",
      },
      config,
    );
    expect(step).toContain("already with an advisor, who will call mañana");
  });
});

describe("buildChatTurns", () => {
  it("joins consecutive messages from the same side and keeps the lead first", () => {
    const turns = buildChatTurns(
      [
        {
          direction: "outbound",
          type: "template",
          body: "¡Hola! Gracias por escribirnos.",
        },
        { direction: "inbound", type: "text", body: "Hola" },
        { direction: "inbound", type: "text", body: "Busco 2 dormitorios" },
        { direction: "inbound", type: "audio", body: "" },
        { direction: "inbound", type: "image", body: "¿cuánto sale este?" },
      ],
      40,
    );
    expect(turns).toEqual([
      { role: "user", content: "[The lead filled in a contact form.]" },
      { role: "assistant", content: "¡Hola! Gracias por escribirnos." },
      {
        role: "user",
        content:
          'Hola\nBusco 2 dormitorios\n[The lead sent a voice note. You cannot see or hear attachments.]\n[The lead sent an image with the caption "¿cuánto sale este?". You cannot see or hear attachments.]',
      },
    ]);
  });

  it("keeps only the most recent messages", () => {
    const messages = Array.from({ length: 10 }, (_, index) => ({
      direction: index % 2 === 0 ? ("inbound" as const) : ("outbound" as const),
      type: "text",
      body: `m${index}`,
    }));
    const turns = buildChatTurns(messages, 4);
    expect(turns.map((turn) => turn.content)).toEqual(["m6", "m7", "m8", "m9"]);
  });
});
