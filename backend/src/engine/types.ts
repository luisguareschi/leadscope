export const THREAD_STATES = ["Greeting", "Qualify", "Answer", "Handoff", "Closed"] as const;
export type ThreadState = (typeof THREAD_STATES)[number];

export const INTENTS = ["continue", "qualified", "not_interested", "needs_human"] as const;
export type Intent = (typeof INTENTS)[number];

export type ThreadSnapshot = {
  state: ThreadState;
  paused: boolean;
  needsHuman: boolean;
  interest: string | null;
  budget: string | null;
  knowsProjects: boolean | null;
  callTime: string | null;
};

export type ModelOutput = {
  reply: string;
  interest: string | null;
  budget: string | null;
  knowsProjects: boolean | null;
  callTime: string | null;
  intent: Intent;
};

export type TurnEvent =
  | { kind: "inbound_text"; model: ModelOutput }
  | { kind: "model_failure" }
  | { kind: "non_text" };

export type CrmAction = "none" | "handoff" | "close";

export type TurnDecision = {
  state: ThreadState;
  paused: boolean;
  needsHuman: boolean;
  interest: string | null;
  budget: string | null;
  knowsProjects: boolean | null;
  callTime: string | null;
  outbound: string | null;
  crm: CrmAction;
};

export type TurnOptions = {
  fallbackMessage: string;
  nonTextMessage: string;
  maxReplyChars: number;
  forbiddenTopics: string[];
};
