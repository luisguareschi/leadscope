import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { INTENTS } from "../engine/types";
import { fakeComplete } from "./fake";
import { CompleteInput, CompleteFn, CompleteResult } from "./types";

const outputSchema = z.object({
  reply: z.string().default(""),
  interest: z.string().nullable().optional().default(null),
  budget: z.string().nullable().optional().default(null),
  knowsProjects: z.boolean().nullable().optional().default(null),
  callTime: z.string().nullable().optional().default(null),
  intent: z.enum(INTENTS),
});

export type { CompleteFn, CompleteInput, CompleteResult } from "./types";

const SUBMIT_TURN = {
  name: "submit_turn",
  description: "Return the WhatsApp reply and any lead fields stated in the conversation.",
  input_schema: {
    type: "object" as const,
    additionalProperties: false,
    properties: {
      reply: { type: "string" },
      interest: { type: ["string", "null"] },
      budget: { type: ["string", "null"] },
      knowsProjects: { type: ["boolean", "null"] },
      callTime: { type: ["string", "null"] },
      intent: { type: "string", enum: [...INTENTS] },
    },
    required: ["reply", "intent"],
  },
};

export async function complete(input: CompleteInput): Promise<CompleteResult> {
  if (!input.apiKey || input.apiKey === "fake") return fakeComplete(input);

  const client = new Anthropic({ apiKey: input.apiKey });
  const response = await client.messages.create({
    model: input.model,
    max_tokens: 1024,
    system: [
      { type: "text", text: input.system, cache_control: { type: "ephemeral" } },
      { type: "text", text: input.state },
    ],
    messages: input.messages,
    tools: [SUBMIT_TURN],
    tool_choice: { type: "tool", name: "submit_turn" },
  });

  const tool = response.content.find((block) => block.type === "tool_use");
  if (!tool || tool.type !== "tool_use") throw new Error("model did not return submit_turn");
  const output = outputSchema.parse(tool.input);
  return {
    output,
    model: response.model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}
