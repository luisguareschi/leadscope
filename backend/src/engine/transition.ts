import { capReply, containsForbidden } from "./guardrails";
import {
  CrmAction,
  ModelOutput,
  ThreadSnapshot,
  ThreadState,
  TurnDecision,
  TurnEvent,
  TurnOptions,
} from "./types";

export function storedText(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function hasQualifyingAnswers(fields: {
  interest: string | null;
  budget: string | null;
  knowsProjects: boolean | null;
}): boolean {
  return storedText(fields.interest) != null && storedText(fields.budget) != null && fields.knowsProjects != null;
}

function readyForCrm(fields: {
  interest: string | null;
  budget: string | null;
  knowsProjects: boolean | null;
  callTime: string | null;
}): boolean {
  return hasQualifyingAnswers(fields) && storedText(fields.callTime) != null;
}

function mergeFields(thread: ThreadSnapshot, model: ModelOutput) {
  return {
    interest: storedText(model.interest) ?? storedText(thread.interest),
    budget: storedText(model.budget) ?? storedText(thread.budget),
    knowsProjects:
      model.knowsProjects === null || model.knowsProjects === undefined
        ? thread.knowsProjects
        : model.knowsProjects,
    callTime: storedText(model.callTime) ?? storedText(thread.callTime),
  };
}

/**
 * A text message after Closed or Handoff is handled in Answer.
 * If that same turn leaves interest, budget, knowsProjects, and callTime stored,
 * and they were not already all stored, the turn still finishes the handoff.
 */
export function stateForPrompt(thread: ThreadSnapshot): ThreadState {
  if (thread.paused || thread.needsHuman) return thread.state;
  if (thread.state === "Closed" || thread.state === "Handoff") return "Answer";
  return thread.state;
}

export function applyTurn(thread: ThreadSnapshot, event: TurnEvent, options: TurnOptions): TurnDecision {
  const unchanged: TurnDecision = {
    state: thread.state,
    paused: thread.paused,
    needsHuman: thread.needsHuman,
    interest: storedText(thread.interest),
    budget: storedText(thread.budget),
    knowsProjects: thread.knowsProjects,
    callTime: storedText(thread.callTime),
    outbound: null,
    crm: "none",
  };

  if (thread.paused || thread.needsHuman) return unchanged;

  if (event.kind === "non_text") {
    return { ...unchanged, outbound: options.nonTextMessage };
  }

  const state: ThreadState = stateForPrompt(thread);

  if (event.kind === "model_failure") {
    return { ...unchanged, state, needsHuman: true, outbound: options.fallbackMessage };
  }

  const merged = mergeFields(thread, event.model);
  const blocked =
    event.model.intent === "needs_human" || containsForbidden(event.model.reply, options.forbiddenTopics);
  if (blocked) {
    return {
      ...unchanged,
      ...merged,
      state,
      needsHuman: true,
      outbound: options.fallbackMessage,
      crm: "none" satisfies CrmAction,
    };
  }

  const reply = capReply(event.model.reply, options.maxReplyChars);
  if (!reply) {
    return { ...unchanged, ...merged, state, needsHuman: true, outbound: options.fallbackMessage };
  }

  if (event.model.intent === "not_interested") {
    return { ...unchanged, ...merged, state: "Closed", outbound: reply, crm: "close" };
  }

  if (!readyForCrm(thread) && readyForCrm(merged)) {
    return { ...unchanged, ...merged, state: "Handoff", outbound: reply, crm: "handoff" };
  }

  let next: ThreadState = state === "Greeting" ? "Qualify" : state;

  if (next === "Qualify") {
    if (!hasQualifyingAnswers(merged)) {
      return { ...unchanged, ...merged, state: "Qualify", outbound: reply };
    }
    if (event.model.intent === "qualified") {
      return { ...unchanged, ...merged, state: "Handoff", outbound: reply };
    }
    return { ...unchanged, ...merged, state: "Answer", outbound: reply };
  }

  if (
    next === "Answer" &&
    hasQualifyingAnswers(merged) &&
    storedText(merged.callTime) == null &&
    event.model.intent === "qualified"
  ) {
    return { ...unchanged, ...merged, state: "Handoff", outbound: reply };
  }

  return { ...unchanged, ...merged, state: next, outbound: reply };
}
