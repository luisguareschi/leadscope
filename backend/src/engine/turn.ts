import { capReply } from "./guardrails.js";
import type {
  Collected,
  CollectRule,
  Intent,
  LeadFields,
  LeadStage,
  ThreadSnapshot,
  ThreadState,
  TurnDecision,
  TurnInput,
  TurnRules,
} from "./types.js";

/** Bullets are for a person skimming the panel or HubSpot; a longer one is cut. */
export const MAX_SUMMARY_CHARS = 1_200;

/** The call time stored when the lead wants to talk to a person now (`callNow`). */
export const CALL_NOW_TIME = "Lo antes posible";

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Reads `Thread.collected` (JSON) defensively: anything that is not a non-empty string is dropped. */
export function collectedOf(value: unknown): Collected {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const collected: Collected = {};
  for (const [key, raw] of Object.entries(value)) {
    const text = typeof raw === "string" ? clean(raw) : null;
    if (text) collected[key] = text;
  }
  return collected;
}

export function fieldsOf(thread: ThreadSnapshot): LeadFields {
  return {
    collected: collectedOf(thread.collected),
    callTime: clean(thread.callTime),
  };
}

/** Items the lead has not answered yet, in config order. */
export function missingItems<T extends CollectRule>(
  fields: LeadFields,
  items: T[],
): T[] {
  return items.filter((item) => !fields.collected[item.key]);
}

/** The qualify gate: every required item is stored. Optional items never hold the handoff. */
export function hasRequiredItems(
  fields: LeadFields,
  items: CollectRule[],
): boolean {
  return (
    missingItems(
      fields,
      items.filter((item) => item.required),
    ).length === 0
  );
}

/**
 * The lead is ready for Por contactar: every required item is stored. A company with no required
 * items would send every "Hola" to the queue, so there the call time is the gate.
 */
export function isReadyForAdvisor(
  fields: LeadFields,
  items: CollectRule[],
): boolean {
  return (
    hasRequiredItems(fields, items) &&
    (items.some((item) => item.required) || fields.callTime !== null)
  );
}

export function isHandoffComplete(
  fields: LeadFields,
  items: CollectRule[],
): boolean {
  return hasRequiredItems(fields, items) && fields.callTime !== null;
}

/**
 * New values from the lead win (they may correct their budget); empty values keep what we had.
 * Only keys of the company's items are taken from the model.
 */
export function mergeFields(
  current: LeadFields,
  update: {
    collected: Record<string, string | null>;
    callTime: string | null;
  },
  items: CollectRule[],
): LeadFields {
  const collected: Collected = { ...current.collected };
  for (const item of items) {
    const value = clean(update.collected[item.key]);
    if (value) collected[item.key] = value;
  }
  return {
    collected,
    callTime: clean(update.callTime) ?? current.callTime,
  };
}

function summaryOf(
  thread: ThreadSnapshot,
  update: string | null | undefined,
): string | null {
  const next = clean(update);
  if (!next) return clean(thread.summary);
  return next.length > MAX_SUMMARY_CHARS
    ? `${next.slice(0, MAX_SUMMARY_CHARS - 1).trimEnd()}…`
    : next;
}

/**
 * The stage the model is told it is in. A lead who writes again after Closed, or after a completed
 * Handoff, reopens the same thread in Answer.
 */
export function stageForPrompt(
  thread: ThreadSnapshot,
  items: CollectRule[],
): ThreadState {
  if (thread.state === "closed") return "answer";
  if (thread.state === "handoff" && isHandoffComplete(fieldsOf(thread), items))
    return "answer";
  return thread.state;
}

export function stageOf(thread: Pick<ThreadSnapshot, "stage">): LeadStage {
  return thread.stage ?? "qualifying";
}

/** Por contactar and Contactado: the lead is the sales team's, and the bot does not re-qualify. */
export function isWithSalesTeam(stage: LeadStage): boolean {
  return stage === "to_contact" || stage === "contacted";
}

/** The current stage was picked by a person in the panel, not reached by the bot. */
export function stageSetByPerson(
  thread: Pick<ThreadSnapshot, "stageChangedByEmail">,
): boolean {
  return Boolean(thread.stageChangedByEmail);
}

/**
 * The conversation step that goes with a stage a person picked, so the next turn behaves like that
 * stage: Calificando asks for what is still missing (then the call time), Sin interés closes, and
 * Por contactar or Contactado reopen a closed conversation. A thread nobody has answered yet keeps
 * its greeting.
 */
export function stateForManualStage(
  thread: ThreadSnapshot,
  stage: LeadStage,
  items: CollectRule[],
): ThreadState {
  if (thread.state === "greeting") return "greeting";
  if (stage === "not_interested") return "closed";
  if (stage === "qualifying") {
    const fields = fieldsOf(thread);
    if (!hasRequiredItems(fields, items)) return "qualify";
    return fields.callTime === null ? "handoff" : "answer";
  }
  return thread.state === "closed" ? "answer" : thread.state;
}

/**
 * Forward-only for the bot, from whatever stage the thread is in (a person may have set it by
 * hand). Calificando moves to Por contactar once every required item is stored (with no required
 * items, once there is a call time), or right away on `callNow`, or to Sin interés. From Por
 * contactar only a person moves the lead; nothing the lead writes moves it back. Sin interés comes
 * back to Por contactar only when the lead re-qualifies: the turn completes the required items, or
 * the model says they accept a call.
 */
function nextStage(
  previous: ThreadSnapshot,
  fields: LeadFields,
  intent: Intent,
  items: CollectRule[],
): LeadStage {
  const stage = stageOf(previous);
  if (isWithSalesTeam(stage)) return stage;
  if (intent === "not_interested") return "not_interested";
  if (!isReadyForAdvisor(fields, items)) return stage;
  if (stage === "qualifying") return "to_contact";
  const completedNow = !isReadyForAdvisor(fieldsOf(previous), items);
  return completedNow || intent === "qualified" ? "to_contact" : stage;
}

function nextState(
  previous: ThreadSnapshot,
  fields: LeadFields,
  items: CollectRule[],
): Pick<TurnDecision, "state" | "crm"> {
  const wasComplete = isHandoffComplete(fieldsOf(previous), items);
  if (!wasComplete && isHandoffComplete(fields, items))
    return { state: "handoff", crm: "handoff" };

  const reopened = stageForPrompt(previous, items) === "answer";
  if (!hasRequiredItems(fields, items))
    return { state: reopened ? "answer" : "qualify", crm: null };
  if (fields.callTime === null) return { state: "handoff", crm: null };
  return { state: "answer", crm: null };
}

/**
 * Decides one bot turn. Pure: the caller loads the thread, calls the model, and persists the result.
 * The model writes the words, extracts values, and flags topics; this function owns the state and
 * decides what is sent.
 */
export function decideTurn(
  thread: ThreadSnapshot,
  input: TurnInput,
  rules: TurnRules,
): TurnDecision {
  const current = fieldsOf(thread);
  const keptSummary = clean(thread.summary);
  const stage = stageOf(thread);

  if (input.kind === "non_text") {
    return {
      state: thread.state,
      stage,
      fields: current,
      summary: keptSummary,
      reply: rules.messages.nonText,
      needsHuman: null,
      crm: null,
    };
  }

  if (input.kind === "model_failure") {
    return {
      state: thread.state,
      stage,
      fields: current,
      summary: keptSummary,
      reply: rules.messages.fallback,
      needsHuman: { reason: `model_failure: ${input.reason}` },
      crm: "needs_human",
    };
  }

  const { output } = input;
  const fields = mergeFields(current, output, rules.collect);
  const summary = summaryOf(thread, output.summary);

  // The model's own words are never sent on these two paths: the lead gets the fixed line.
  const forbiddenTopic = clean(output.forbiddenTopic);
  if (forbiddenTopic) {
    return {
      state: thread.state,
      stage,
      fields,
      summary,
      reply: rules.messages.needsHuman,
      needsHuman: {
        reason: `forbidden_topic: ${forbiddenTopic.slice(0, 200)}`,
      },
      crm: "needs_human",
    };
  }
  if (output.needsHuman) {
    return {
      state: thread.state,
      stage,
      fields,
      summary,
      reply: rules.messages.needsHuman,
      needsHuman: { reason: "lead_needs_human" },
      crm: "needs_human",
    };
  }

  const reply = capReply(output.reply, rules.maxReplyChars);
  if (!reply) {
    return {
      state: thread.state,
      stage,
      fields,
      summary,
      reply: rules.messages.fallback,
      needsHuman: { reason: "empty_reply" },
      crm: "needs_human",
    };
  }

  // The lead wants a person now: straight to the advisors' queue, missing items or not. The bot
  // stops qualifying (the prompt never re-qualifies a lead with the sales team).
  if (output.callNow) {
    return {
      state: "answer",
      stage: isWithSalesTeam(stage) ? stage : "to_contact",
      fields: { ...fields, callTime: CALL_NOW_TIME },
      summary,
      reply,
      needsHuman: null,
      crm: "handoff",
    };
  }

  if (output.intent === "not_interested") {
    return {
      state: "closed",
      stage: nextStage(thread, fields, output.intent, rules.collect),
      fields,
      summary,
      reply,
      needsHuman: null,
      crm: "close",
    };
  }

  return {
    ...nextState(thread, fields, rules.collect),
    stage: nextStage(thread, fields, output.intent, rules.collect),
    fields,
    summary,
    reply,
    needsHuman: null,
  };
}
