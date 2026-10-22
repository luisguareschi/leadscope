import { describe, expect, it } from "vitest";
import { parseCompanyConfig } from "../../src/companies/company-config.js";
import { createFakeLlm } from "../../src/llm/fake-llm.js";
import type { CompleteInput } from "../../src/llm/types.js";
import { baseConfig } from "../support/harness.js";

function firstMessage(assistantName: string): CompleteInput {
  return {
    model: "fake",
    temperature: 0,
    timeoutMs: 1_000,
    system: "",
    turnContext: "",
    messages: [{ role: "user", content: "Hola" }],
    scenario: {
      thread: {
        state: "greeting",
        collected: {},
        summary: null,
        callTime: null,
        name: null,
        source: "whatsapp",
      },
      config: parseCompanyConfig({ ...baseConfig, assistantName }),
      companyName: "Altamira",
      documents: [],
    },
  };
}

describe("the local fake model's greeting", () => {
  it("introduces the assistant by its name, as the assistant of the company", async () => {
    const { output } = await createFakeLlm().complete(firstMessage("Almira"));
    expect(output.reply).toMatch(
      /^¡Hola! Soy Almira, asistente virtual de Altamira\./,
    );
  });

  it("with no assistant name, only as the company's assistant", async () => {
    const { output } = await createFakeLlm().complete(firstMessage(""));
    expect(output.reply).toMatch(
      /^¡Hola! Soy el asistente virtual de Altamira\./,
    );
  });
});
