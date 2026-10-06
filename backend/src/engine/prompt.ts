import { CompanyConfig } from "../companies/config";
import { ThreadSnapshot } from "./types";
import { stateForPrompt, storedText } from "./transition";

export type ProjectFact = {
  slug: string;
  name: string;
  priceFrom: string | null;
  typologies: string | null;
  deliveryDate: string | null;
  orientation: string | null;
  notes: string | null;
  siteNotes: string | null;
};

const BASE_PROMPT = [
  "You are the WhatsApp assistant for a real-estate developer.",
  "Answer only from the knowledge block and the company instructions.",
  "Ask one question at a time. Keep the reply short enough for WhatsApp.",
  "If a fact is not in the knowledge block, say you do not know and offer an advisor.",
  "Never invent rental yield, guaranteed rent, or investment returns.",
  "Never list full unit inventory or unit-level availability.",
  "Price from, typology, delivery date, and orientation may be answered when they are in the block.",
  "Sheet facts win over site notes for price, typology, delivery, orientation, and availability.",
  "The engine owns the conversation state. You only return the reply and extracted fields.",
  "Set intent to not_interested when the lead refuses or says they are not interested.",
  "Set intent to needs_human when they ask about a forbidden topic or you cannot answer safely.",
  "Set intent to qualified when the qualifying answers are in and they should talk to an advisor.",
  "Otherwise set intent to continue.",
  "Extract interest, budget, and knowsProjects only when the lead actually states them.",
  "knowsProjects is false when they say they do not know the projects. That is still an answer.",
  "budget is their words, not a number you enforce.",
  "callTime is the phrase they give for when an advisor can call. There is no slot picker.",
].join(" ");

export function formatKnowledge(projects: ProjectFact[]): string {
  if (projects.length === 0) return "(no projects synced)";
  return projects
    .map((project) => {
      const lines = [
        `Project: ${project.name} (${project.slug})`,
        `Price from: ${project.priceFrom ?? "(unknown)"}`,
        `Typologies: ${project.typologies ?? "(unknown)"}`,
        `Delivery: ${project.deliveryDate ?? "(unknown)"}`,
        `Orientation: ${project.orientation ?? "(unknown)"}`,
        `Notes: ${project.notes ?? ""}`,
        `Site notes (stable facts only; the sheet wins on commercial facts): ${project.siteNotes ?? ""}`,
      ];
      return lines.join("\n");
    })
    .join("\n\n");
}

export function buildSystemPrompt(config: CompanyConfig, projects: ProjectFact[]): string {
  return [
    BASE_PROMPT,
    `Company: ${config.displayName}`,
    `Language and tone: ${config.language}. ${config.tone}`,
    `Brand voice: ${config.brandVoice}`,
    "Qualifying questions, one at a time:",
    ...config.questions.map((question, index) => `${index + 1}. ${question}`),
    `Forbidden topics, never answer these: ${config.forbiddenTopics.join("; ") || "(none)"}`,
    `Business hours to mention when asking for a call: ${config.businessHours || "(not configured)"}`,
    "Knowledge block:",
    formatKnowledge(projects),
  ].join("\n\n");
}

function fieldLine(label: string, value: string | null): string {
  return `${label}: ${value ?? "(empty)"}`;
}

export function buildStateBlock(thread: ThreadSnapshot): string {
  const knows =
    thread.knowsProjects == null ? "(empty)" : thread.knowsProjects ? "true" : "false";
  return [
    `Current state: ${stateForPrompt(thread)}`,
    fieldLine("interest", storedText(thread.interest)),
    fieldLine("budget", storedText(thread.budget)),
    `knowsProjects: ${knows}`,
    fieldLine("callTime", storedText(thread.callTime)),
    "If state is Greeting, welcome them and start the questions.",
    "If a qualifying answer is still empty, ask the next one.",
    "If interest, budget, and knowsProjects are stored and callTime is empty, ask when an advisor can call.",
    "If they ask a project question, answer from the knowledge block in the same short reply.",
  ].join("\n");
}

export function toAnthropicMessages(
  messages: { direction: "in" | "out"; body: string; contentType: string }[],
): { role: "user" | "assistant"; content: string }[] {
  const mapped = messages
    .filter((message) => message.contentType === "text")
    .map((message) => ({
      role: message.direction === "in" ? ("user" as const) : ("assistant" as const),
      content: message.body,
    }));

  const folded: { role: "user" | "assistant"; content: string }[] = [];
  for (const message of mapped) {
    const last = folded[folded.length - 1];
    if (last && last.role === message.role) last.content = `${last.content}\n${message.content}`;
    else folded.push({ ...message });
  }
  if (folded.length === 0) return [{ role: "user", content: "(empty)" }];
  if (folded[0].role === "assistant") folded.unshift({ role: "user", content: "(conversation)" });
  return folded;
}
