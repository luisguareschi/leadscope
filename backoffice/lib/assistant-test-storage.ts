import type { TestChatRole, TestLead, TestTurnResponse } from "./types";

/** One bubble of the test chat. The model's own words and a stop ride on the assistant's reply. */
export type TestChatMessage = {
  id: string;
  role: TestChatRole;
  body: string;
  sentAt: string;
  modelReply?: string | null;
  stoppedReason?: string | null;
};

export type TestChat = {
  messages: TestChatMessage[];
  lead: TestLead | null;
  leadName: string;
  /** The last reply would have stopped the assistant, and nobody chose to continue yet. */
  stopped: boolean;
  lastTurn: Pick<TestTurnResponse, "model" | "usage"> | null;
};

export const EMPTY_TEST_CHAT: TestChat = {
  messages: [],
  lead: null,
  leadName: "",
  stopped: false,
  lastTurn: null,
};

/** Mirrors the backend's cap on the history's characters. */
export const MAX_HISTORY_CHARS = 60_000;
/** The panel API takes JSON bodies up to 100 KB; this leaves room for the lead's state. */
const MAX_HISTORY_BYTES = 80_000;

const STATES = ["greeting", "qualify", "answer", "handoff", "closed"];
const STAGES = ["qualifying", "to_contact", "contacted", "not_interested"];

/** A stored lead from an older version, or edited by hand, is dropped rather than sent. */
function validLead(value: unknown): TestLead | null {
  if (!value || typeof value !== "object") return null;
  const lead = value as Record<string, unknown>;
  const text = (v: unknown) => v === null || typeof v === "string";
  const collected = lead.collected;
  if (
    !STATES.includes(lead.state as string) ||
    !STAGES.includes(lead.stage as string) ||
    !text(lead.callTime) ||
    !text(lead.summary) ||
    !collected ||
    typeof collected !== "object" ||
    Array.isArray(collected) ||
    !Object.values(collected).every((v) => typeof v === "string")
  )
    return null;
  return value as TestLead;
}

const keyFor = (company: string) => `leadscope.assistant-test.${company}`;

/** Per browser and company. Storage may be unavailable (private mode); the chat still works. */
export function loadTestChat(company: string): TestChat {
  try {
    const raw = window.localStorage.getItem(keyFor(company));
    if (!raw) return EMPTY_TEST_CHAT;
    const parsed = JSON.parse(raw) as Partial<TestChat>;
    if (!Array.isArray(parsed.messages)) return EMPTY_TEST_CHAT;
    const messages = parsed.messages.filter(
      (message): message is TestChatMessage =>
        Boolean(message) &&
        (message.role === "lead" || message.role === "assistant") &&
        typeof message.body === "string" &&
        typeof message.id === "string" &&
        typeof message.sentAt === "string",
    );
    return {
      ...EMPTY_TEST_CHAT,
      ...parsed,
      messages,
      lead: validLead(parsed.lead),
      leadName: typeof parsed.leadName === "string" ? parsed.leadName : "",
      stopped: parsed.stopped === true,
    };
  } catch {
    return EMPTY_TEST_CHAT;
  }
}

export function saveTestChat(company: string, chat: TestChat): void {
  try {
    if (chat.messages.length === 0 && !chat.leadName)
      window.localStorage.removeItem(keyFor(company));
    else window.localStorage.setItem(keyFor(company), JSON.stringify(chat));
  } catch {
    // Not saved: the chat lives until the page reloads.
  }
}

const bytesOf = (value: unknown) =>
  new TextEncoder().encode(JSON.stringify(value)).length;

/**
 * What the model would read: the last `historyLimit` messages, trimmed further from the oldest to
 * fit `MAX_HISTORY_CHARS` and the API's body limit (accents and emoji take more than one byte).
 * The lead's state carries what older messages established.
 */
export function historyForRequest(
  messages: TestChatMessage[],
  historyLimit: number,
): Array<{ role: TestChatRole; body: string }> {
  const recent = messages.slice(-Math.max(1, historyLimit));
  let total = recent.reduce((sum, message) => sum + message.body.length, 0);
  let start = 0;
  while (total > MAX_HISTORY_CHARS && start < recent.length - 1) {
    total -= recent[start]!.body.length;
    start += 1;
  }
  const history = recent
    .slice(start)
    .map((message) => ({ role: message.role, body: message.body }));
  while (history.length > 1 && bytesOf(history) > MAX_HISTORY_BYTES)
    history.shift();
  return history;
}
