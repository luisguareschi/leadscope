"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  EMPTY_TEST_CHAT,
  buildTurnRequest,
  loadTestChat,
  saveTestChat,
  testChatOwner,
  type TestChat,
  type TestChatMessage,
} from "@/lib/assistant-test-storage";
import { useAssistantTestTurn, useMe } from "@/lib/queries";

type TestError = { message: string; code?: string };

type AssistantTest = {
  chat: TestChat;
  /** The lead's message while its reply is on the way. */
  sending: TestChatMessage | null;
  pending: boolean;
  error: TestError | null;
  /** The composer's text, kept here so it survives other pages and comes back after a failure. */
  draft: string;
  setDraft: (draft: string) => void;
  /** Resolves false when the turn failed, so the composer can give the message back. */
  send: (body: string, historyLimit: number) => Promise<boolean>;
  setLeadName: (name: string) => void;
  /** As if a person had attended the stop: the composer opens again. */
  resume: () => void;
  reset: () => void;
};

const AssistantTestContext = createContext<AssistantTest | null>(null);

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;

/**
 * Holds Probar asistente's chat for the whole panel, so a reply that is on its way still lands
 * after the person opens another page. The chat is per signed-in person and company, kept in
 * this browser.
 */
export function AssistantTestProvider({ children }: { children: ReactNode }) {
  const me = useMe();
  const { email } = useAuth();
  const slug = me.data?.company?.slug ?? null;
  const company = email && slug ? testChatOwner(email, slug) : null;
  const turn = useAssistantTestTurn();
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [chat, setChat] = useState<TestChat>(EMPTY_TEST_CHAT);
  const [sending, setSending] = useState<TestChatMessage | null>(null);
  const [error, setError] = useState<TestError | null>(null);
  const [draft, setDraft] = useState("");
  const current = useRef(company);
  useEffect(() => {
    current.current = company;
  }, [company]);

  // Another company (a platform admin entered a different one): its own chat.
  if (company !== loadedFor) {
    setLoadedFor(company);
    setChat(company ? loadTestChat(company) : EMPTY_TEST_CHAT);
    setSending(null);
    setError(null);
    setDraft("");
  }

  useEffect(() => {
    if (company && company === loadedFor) saveTestChat(company, chat);
  }, [company, loadedFor, chat]);

  const send = useCallback(
    async (body: string, historyLimit: number) => {
      if (!company) return false;
      setError(null);
      setDraft("");
      const lead: TestChatMessage = {
        id: newId(),
        role: "lead",
        body,
        sentAt: new Date().toISOString(),
      };
      const messages = [...chat.messages, lead];
      setSending(lead);
      try {
        const response = await turn.mutateAsync(
          buildTurnRequest(messages, historyLimit, chat.lead, chat.leadName),
        );
        const next: TestChat = {
          ...chat,
          messages: [
            ...messages,
            {
              id: newId(),
              role: "assistant",
              body: response.reply,
              sentAt: new Date().toISOString(),
              modelReply: response.modelReply,
              stoppedReason: response.stoppedReason,
            },
          ],
          lead: response.lead,
          stopped: response.stoppedReason !== null,
          lastTurn: { model: response.model, usage: response.usage },
        };
        // The person may have entered another company meanwhile: the reply belongs to this one.
        if (current.current === company) setChat(next);
        else saveTestChat(company, next);
        return true;
      } catch (cause) {
        if (current.current === company) {
          // Not sent: the message goes back to the composer to retry.
          setDraft((now) => now || body);
          setError(
            cause instanceof ApiError
              ? { message: cause.message, code: cause.code }
              : {
                  message:
                    cause instanceof Error
                      ? cause.message
                      : "No se pudo probar el asistente.",
                },
          );
        }
        return false;
      } finally {
        setSending(null);
      }
    },
    [company, chat, turn],
  );

  const value: AssistantTest = {
    chat,
    sending,
    pending: turn.isPending,
    error,
    draft,
    setDraft,
    send,
    setLeadName: (leadName) => setChat((prev) => ({ ...prev, leadName })),
    resume: () => setChat((prev) => ({ ...prev, stopped: false })),
    reset: () => {
      setError(null);
      setDraft("");
      setChat((prev) => ({ ...EMPTY_TEST_CHAT, leadName: prev.leadName }));
    },
  };

  return (
    <AssistantTestContext.Provider value={value}>
      {children}
    </AssistantTestContext.Provider>
  );
}

export function useAssistantTest(): AssistantTest {
  const value = useContext(AssistantTestContext);
  if (!value)
    throw new Error("useAssistantTest needs an AssistantTestProvider");
  return value;
}
