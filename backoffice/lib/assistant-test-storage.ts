import type {
  TestChatRole,
  TestLead,
  TestTurnRequest,
  TestTurnResponse,
} from "./types";

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
/** The panel API takes JSON bodies up to 100 KB (102,400 bytes); this leaves some margin. */
const MAX_REQUEST_BYTES = 95_000;

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

/**
 * Whose chat it is: the signed-in email and the company's slug. On a shared browser, the next
 * person who signs in to the same company does not see it.
 */
export const testChatOwner = (email: string, company: string) =>
  `${email.trim().toLowerCase()}:${company}`;

const keyFor = (owner: string) => `leadscope.assistant-test.${owner}`;

/** Per browser, person, and company. Storage may be unavailable (private mode); the chat still works. */
export function loadTestChat(owner: string): TestChat {
  try {
    const raw = window.localStorage.getItem(keyFor(owner));
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

export function saveTestChat(owner: string, chat: TestChat): void {
  try {
    if (chat.messages.length === 0 && !chat.leadName)
      window.localStorage.removeItem(keyFor(owner));
    else window.localStorage.setItem(keyFor(owner), JSON.stringify(chat));
  } catch {
    // Not saved: the chat lives until the page reloads.
  }
}

const bytesOf = (value: unknown) =>
  new TextEncoder().encode(JSON.stringify(value)).length;

/**
 * The next turn's request. History is what the model would read: the last `historyLimit`
 * messages, trimmed further from the oldest to fit `MAX_HISTORY_CHARS` and, with the lead's state,
 * the API's body limit (accents and emoji take more than one byte). The lead's state carries what
 * older messages established.
 */
export function buildTurnRequest(
  messages: TestChatMessage[],
  historyLimit: number,
  lead: TestLead | null,
  leadName: string,
): TestTurnRequest {
  const recent = messages.slice(-Math.max(1, historyLimit));
  let total = recent.reduce((sum, message) => sum + message.body.length, 0);
  let start = 0;
  while (total > MAX_HISTORY_CHARS && start < recent.length - 1) {
    total -= recent[start]!.body.length;
    start += 1;
  }
  const request: TestTurnRequest = {
    messages: recent
      .slice(start)
      .map((message) => ({ role: message.role, body: message.body })),
    ...(lead ? { lead } : {}),
    leadName: leadName.trim() || null,
  };
  while (request.messages.length > 1 && bytesOf(request) > MAX_REQUEST_BYTES)
    request.messages.shift();
  return request;
}
