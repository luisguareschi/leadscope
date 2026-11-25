import { normalizeReplies } from "./guardrails.js";
import { isClosedStage, isSystemStage } from "./stages.js";
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

/** Maximum number of public files the assistant may send in a single turn. */
export const MAX_FILES_PER_TURN = 2;

/** The call time stored when the lead wants to talk to a person now (`callNow`). */
export const CALL_NOW_TIME = "Lo antes posible";

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function cleanFileIds(ids: string[] | undefined): string[] {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of ids) {
    const id = typeof raw === "string" ? raw.trim() : "";
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
    if (result.length >= MAX_FILES_PER_TURN) break;
  }
  return result;
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

/** Whether the company configures at least one required collect item. */
export function hasAnyRequiredItem(items: CollectRule[]): boolean {
  return items.some((item) => item.required);
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
 * The lead is ready for Por contactar: every required item is stored. When a company has no
 * required items, a bare greeting does not enter the queue; the gate is a preferred contact
 * time/channel (`callTime`) or the model judging the conversation ready (`intent === "qualified"`).
 */
export function isReadyForAdvisor(
  fields: LeadFields,
  items: CollectRule[],
  intent: Intent = "continue",
): boolean {
  if (!hasRequiredItems(fields, items)) return false;
  if (hasAnyRequiredItem(items)) return true;
  return fields.callTime !== null || intent === "qualified";
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
  if (thread.state === "closed") {
    return stageOf(thread) === "no_response" ? "qualify" : "answer";
  }
  if (thread.state === "handoff" && isHandoffComplete(fieldsOf(thread), items))
    return "answer";
  return thread.state;
}

export function stageOf(thread: Pick<ThreadSnapshot, "stage">): LeadStage {
  return thread.stage ?? "qualifying";
}

/**
 * Por contactar, Contactado, and any company-defined custom stage: the lead is owned by the sales
 * team, and the bot keeps answering without re-qualifying or moving the stage backwards.
 */
export function isWithSalesTeam(stage: LeadStage): boolean {
  return (
    stage === "to_contact" || stage === "contacted" || !isSystemStage(stage)
  );
}

/** The current stage was picked by a person in the panel, not reached by the bot. */
export function stageSetByPerson(
  thread: Pick<ThreadSnapshot, "stageChangedByEmail">,
): boolean {
  return Boolean(thread.stageChangedByEmail);
}

/**
 * The conversation step that goes with a stage a person picked, so the next turn behaves like that
 * stage: Calificando asks for what is still missing (then the call time), closed stages close, and
 * sales stages reopen a closed conversation. A thread nobody has answered yet keeps its greeting.
 */
export function stateForManualStage(
  thread: ThreadSnapshot,
  stage: LeadStage,
  items: CollectRule[],
): ThreadState {
  if (thread.state === "greeting") return "greeting";
  if (isClosedStage(stage)) return "closed";
  if (stage === "qualifying") {
    const fields = fieldsOf(thread);
    if (!hasRequiredItems(fields, items)) return "qualify";
    if (!hasAnyRequiredItem(items) && fields.callTime === null)
      return "qualify";
    return fields.callTime === null ? "handoff" : "answer";
  }
  return thread.state === "closed" ? "answer" : thread.state;
}

/**
 * Forward-only for the bot, from whatever stage the thread is in (a person may have set it by
 * hand). Calificando moves to Por contactar once every required item is stored (with no required
 * items, once there is a preferred contact time/channel or the model marks intent as "qualified"),
 * or right away on `callNow`, or to Sin interés / Descalificado. A silent thread in Sin respuesta
 * re-enters Calificando (or Por contactar) as soon as the lead writes back. From sales stages
 * (`to_contact`, `contacted`, custom) only a person moves the lead; nothing the lead writes moves
 * it back. Sin interés / Descalificado come back to Por contactar only when the lead re-qualifies.
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
  if (intent === "disqualified") return "disqualified";
  if (isReadyForAdvisor(fields, items, intent)) {
    if (stage === "qualifying" || stage === "no_response") return "to_contact";
    const completedNow = !isReadyForAdvisor(fieldsOf(previous), items);
    return completedNow || intent === "qualified" ? "to_contact" : stage;
  }
  if (stage === "no_response") return "qualifying";
  return stage;
}

function nextState(
  previous: ThreadSnapshot,
  fields: LeadFields,
  nextLeadStage: LeadStage,
  items: CollectRule[],
): Pick<TurnDecision, "state" | "crm"> {
  const wasComplete = isHandoffComplete(fieldsOf(previous), items);
  if (!wasComplete && isHandoffComplete(fields, items))
    return { state: "handoff", crm: "handoff" };

  const justHandedOff =
    nextLeadStage === "to_contact" && !isWithSalesTeam(stageOf(previous));
  if (justHandedOff && !hasAnyRequiredItem(items))
    return { state: "answer", crm: "handoff" };

  const reopened =
    stageForPrompt(previous, items) === "answer" &&
    stageOf(previous) !== "no_response";
  if (!hasRequiredItems(fields, items))
    return { state: reopened ? "answer" : "qualify", crm: null };
  if (!hasAnyRequiredItem(items) && !isWithSalesTeam(nextLeadStage))
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
      replies: [rules.messages.nonText],
      sendFileIds: [],
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
      replies: [rules.messages.fallback],
      sendFileIds: [],
      needsHuman: { reason: `model_failure: ${input.reason}` },
      crm: "needs_human",
    };
  }

  const { output } = input;
  const fields = mergeFields(current, output, rules.collect);
  const summary = summaryOf(thread, output.summary);

  // The model's own words (and files) are never sent on these two paths: the lead gets the fixed line.
  const forbiddenTopic = clean(output.forbiddenTopic);
  if (forbiddenTopic) {
    return {
      state: thread.state,
      stage,
      fields,
      summary,
      reply: rules.messages.needsHuman,
      replies: [rules.messages.needsHuman],
      sendFileIds: [],
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
      replies: [rules.messages.needsHuman],
      sendFileIds: [],
      needsHuman: { reason: "lead_needs_human" },
      crm: "needs_human",
    };
  }

  const replies = normalizeReplies(output, rules.maxReplyChars);
  if (replies.length === 0) {
    return {
      state: thread.state,
      stage,
      fields,
      summary,
      reply: rules.messages.fallback,
      replies: [rules.messages.fallback],
      sendFileIds: [],
      needsHuman: { reason: "empty_reply" },
      crm: "needs_human",
    };
  }
  const reply = replies.join("\n\n");

  const sendFileIds = cleanFileIds(output.sendFileIds);

  // The lead wants a person now: straight to the advisors' queue, missing items or not. The bot
  // stops qualifying (the prompt never re-qualifies a lead with the sales team). Keep any
  // preferred channel/time extracted on this turn instead of overwriting it with "Lo antes posible".
  if (output.callNow) {
    return {
      state: "answer",
      stage: isWithSalesTeam(stage) ? stage : "to_contact",
      fields: { ...fields, callTime: clean(output.callTime) ?? CALL_NOW_TIME },
      summary,
      reply,
      replies,
      sendFileIds,
      needsHuman: null,
      crm: "handoff",
    };
  }

  if (output.intent === "not_interested" || output.intent === "disqualified") {
    // Sales stages (`to_contact`, `contacted`, custom) stay owned by the sales team: keep state in
    // `answer` and send an `update` so Thread.state and HubSpot status never contradict Thread.stage.
    if (isWithSalesTeam(stage)) {
      return {
        state: "answer",
        stage,
        fields,
        summary,
        reply,
        replies,
        sendFileIds: [],
        needsHuman: null,
        crm: "update",
      };
    }
    return {
      state: "closed",
      stage: nextStage(thread, fields, output.intent, rules.collect),
      fields,
      summary,
      reply,
      replies,
      sendFileIds: [],
      needsHuman: null,
      crm: "close",
    };
  }

  const stageNext = nextStage(thread, fields, output.intent, rules.collect);
  return {
    ...nextState(thread, fields, stageNext, rules.collect),
    stage: stageNext,
    fields,
    summary,
    reply,
    replies,
    sendFileIds,
    needsHuman: null,
  };
}
