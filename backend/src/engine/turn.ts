import { capReply, findForbidden } from "./guardrails.js";
import type { LeadFields, ThreadSnapshot, ThreadState, TurnDecision, TurnInput, TurnRules } from "./types.js";

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function fieldsOf(thread: LeadFields): LeadFields {
  return {
    interest: clean(thread.interest),
    budget: clean(thread.budget),
    knowsProjects: thread.knowsProjects,
    callTime: clean(thread.callTime),
  };
}

/** The qualify gate: interest, budget, and knowsProjects stored. knowsProjects=false still counts. */
export function hasQualifyingAnswers(fields: LeadFields): boolean {
  return fields.interest !== null && fields.budget !== null && fields.knowsProjects !== null;
}

export function isHandoffComplete(fields: LeadFields): boolean {
  return hasQualifyingAnswers(fields) && fields.callTime !== null;
}

/** New values from the lead win (they may correct their budget); empty values keep what we had. */
export function mergeFields(current: LeadFields, update: LeadFields): LeadFields {
  return {
    interest: clean(update.interest) ?? current.interest,
    budget: clean(update.budget) ?? current.budget,
    knowsProjects: update.knowsProjects ?? current.knowsProjects,
    callTime: clean(update.callTime) ?? current.callTime,
  };
}

/**
 * The stage the model is told it is in. A lead who writes again after Closed, or after a completed
 * Handoff, reopens the same thread in Answer.
 */
export function stageForPrompt(thread: ThreadSnapshot): ThreadState {
  if (thread.state === "closed") return "answer";
  if (thread.state === "handoff" && isHandoffComplete(fieldsOf(thread))) return "answer";
  return thread.state;
}

function nextState(previous: ThreadSnapshot, fields: LeadFields): Pick<TurnDecision, "state" | "crm"> {
  const wasComplete = isHandoffComplete(fieldsOf(previous));
  if (!wasComplete && isHandoffComplete(fields)) return { state: "handoff", crm: "handoff" };

  const reopened = stageForPrompt(previous) === "answer";
  if (!hasQualifyingAnswers(fields)) return { state: reopened ? "answer" : "qualify", crm: null };
  if (fields.callTime === null) return { state: "handoff", crm: null };
  return { state: "answer", crm: null };
}

/**
 * Decides one bot turn. Pure: the caller loads the thread, calls the model, and persists the result.
 * The model writes the words and extracts fields; this function owns the state.
 */
export function decideTurn(thread: ThreadSnapshot, input: TurnInput, rules: TurnRules): TurnDecision {
  const current = fieldsOf(thread);

  if (input.kind === "non_text") {
    return { state: thread.state, fields: current, reply: rules.messages.nonText, needsHuman: null, crm: null };
  }

  if (input.kind === "model_failure") {
    return {
      state: thread.state,
      fields: current,
      reply: rules.messages.fallback,
      needsHuman: { reason: `model_failure: ${input.reason}` },
      crm: "needs_human",
    };
  }

  const { output } = input;
  const fields = mergeFields(current, output);

  // The model's own words are never sent here, so the forbidden-topic check is not needed.
  if (output.intent === "needs_human") {
    return {
      state: thread.state,
      fields,
      reply: rules.messages.needsHuman,
      needsHuman: { reason: "lead_needs_human" },
      crm: "needs_human",
    };
  }

  const blockedBy = findForbidden(output.reply, rules.forbiddenPatterns);
  if (blockedBy) {
    return {
      state: thread.state,
      fields,
      reply: rules.messages.fallback,
      needsHuman: { reason: `blocked_reply: ${blockedBy}` },
      crm: "needs_human",
    };
  }

  const reply = capReply(output.reply, rules.maxReplyChars);
  if (!reply) {
    return {
      state: thread.state,
      fields,
      reply: rules.messages.fallback,
      needsHuman: { reason: "empty_reply" },
      crm: "needs_human",
    };
  }

  if (output.intent === "not_interested") {
    return { state: "closed", fields, reply, needsHuman: null, crm: "close" };
  }

  return { ...nextState(thread, fields), fields, reply, needsHuman: null };
}
