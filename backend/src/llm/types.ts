import { ModelOutput } from "../engine/types";

export type CompleteInput = {
  apiKey: string;
  model: string;
  system: string;
  state: string;
  messages: { role: "user" | "assistant"; content: string }[];
};

export type CompleteResult = {
  output: ModelOutput;
  model: string;
  inputTokens: number;
  outputTokens: number;
};

export type CompleteFn = (input: CompleteInput) => Promise<CompleteResult>;
