export const INTENTS = ["continue", "qualified", "not_interested", "needs_human"] as const;
export type Intent = (typeof INTENTS)[number];

export type ThreadState = "greeting" | "qualify" | "answer" | "handoff" | "closed";

export type LeadFields = {
  interest: string | null;
  budget: string | null;
  knowsProjects: boolean | null;
  callTime: string | null;
};

export type ThreadSnapshot = LeadFields & {
  state: ThreadState;
};

/** What the model returns through the submit_turn tool. */
export type ModelTurn = LeadFields & {
  reply: string;
  intent: Intent;
};

export type TurnInput =
  | { kind: "model"; output: ModelTurn }
  | { kind: "model_failure"; reason: string }
  | { kind: "non_text" };

export type CrmActionKind = "handoff" | "close" | "needs_human";

export type TurnRules = {
  maxReplyChars: number;
  forbiddenPatterns: string[];
  messages: { fallback: string; needsHuman: string; nonText: string };
};

export type TurnDecision = {
  state: ThreadState;
  fields: LeadFields;
  reply: string;
  /** Set when the bot stops itself and waits for an operator. */
  needsHuman: { reason: string } | null;
  crm: CrmActionKind | null;
};
