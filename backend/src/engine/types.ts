export const INTENTS = ["continue", "qualified", "not_interested"] as const;
export type Intent = (typeof INTENTS)[number];

export type ThreadState =
  "greeting" | "qualify" | "answer" | "handoff" | "closed";

/** What the lead told us, by collect item key (`config.collect[].key`). Only non-empty values. */
export type Collected = Record<string, string>;

export type LeadFields = {
  collected: Collected;
  callTime: string | null;
};

/** What the engine needs to know about a collect item. */
export type CollectRule = { key: string; required: boolean };

export type ThreadSnapshot = {
  state: ThreadState;
  /** `Thread.collected` as stored (JSON). Read with `collectedOf`. */
  collected: unknown;
  callTime: string | null;
  summary?: string | null;
};

/** What the model returns through the submit_turn tool. */
export type ModelTurn = {
  reply: string;
  /** By collect item key; null when this turn does not add or change it. */
  collected: Record<string, string | null>;
  callTime: string | null;
  intent: Intent;
  /** The lead needs a person (complaint, existing purchase, insists on a person). */
  needsHuman: boolean;
  /** The forbidden topic the lead asked about (or the reply would touch), as listed in config. */
  forbiddenTopic: string | null;
  /** Short bullets: the conversation so far and what the lead wants. */
  summary: string | null;
};

export type TurnInput =
  | { kind: "model"; output: ModelTurn }
  | { kind: "model_failure"; reason: string }
  | { kind: "non_text" };

export type CrmActionKind = "handoff" | "close" | "needs_human";

export type TurnRules = {
  maxReplyChars: number;
  collect: CollectRule[];
  messages: { fallback: string; needsHuman: string; nonText: string };
};

export type TurnDecision = {
  state: ThreadState;
  fields: LeadFields;
  summary: string | null;
  reply: string;
  /** Set when the bot stops itself and waits for an operator. */
  needsHuman: { reason: string } | null;
  crm: CrmActionKind | null;
};
