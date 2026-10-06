import { Intent } from "../engine/types";
import { CompleteInput, CompleteResult } from "./types";

/**
 * Local stand-in used when the company Anthropic key is missing or the literal "fake".
 * It walks the three questions. It does not call Anthropic and it is not the live prompt.
 */
export async function fakeComplete(input: CompleteInput): Promise<CompleteResult> {
  const lastUser = [...input.messages].reverse().find((message) => message.role === "user");
  const text = (lastUser?.content ?? "").trim();
  const state = /Current state:\s*(\w+)/.exec(input.state)?.[1] ?? "Greeting";
  const interest = valueOf(input.state, "interest");
  const budget = valueOf(input.state, "budget");
  const knows = valueOf(input.state, "knowsProjects");
  const company = /Company:\s*(.+)/.exec(input.system)?.[1]?.split("\n")[0] ?? "la empresa";
  const topics = forbiddenTopics(input.system);

  let intent: Intent = "continue";
  let reply = "¿Me contás un poco más?";
  let nextInterest: string | null = null;
  let nextBudget: string | null = null;
  let nextKnows: boolean | null = null;
  let nextCall: string | null = null;

  if (topics.some((topic) => text.toLowerCase().includes(topic.toLowerCase()))) {
    intent = "needs_human";
    reply = text;
  } else if (/no me interesa|no gracias|no quiero|dej[aá]/i.test(text)) {
    intent = "not_interested";
    reply = "Gracias por avisar. Cualquier cosa, escribinos.";
  } else if (state === "Greeting" && /^(hola|buenas|hey|buen día|buen dia)\b/i.test(text) && text.length < 40) {
    reply = `Hola, soy el asistente de ${company}. ¿Qué estás buscando?`;
  } else if (!interest) {
    nextInterest = text;
    reply = "¿Con qué presupuesto contás?";
  } else if (!budget) {
    nextBudget = text;
    reply = "¿Ya conocés los proyectos?";
  } else if (knows === "(empty)") {
    nextKnows = !/\bno\b/i.test(text);
    intent = "qualified";
    reply = "¿Cuándo te puede llamar un asesor?";
  } else if (/precio|tipolog|entrega|orientaci/i.test(text)) {
    reply = firstFact(input.system, text);
  } else {
    nextCall = text;
    intent = "qualified";
    reply = "Dale, un asesor te llama en ese horario.";
  }

  return {
    output: {
      reply,
      interest: nextInterest,
      budget: nextBudget,
      knowsProjects: nextKnows,
      callTime: nextCall,
      intent,
    },
    model: "fake",
    inputTokens: 0,
    outputTokens: 0,
  };
}

function valueOf(state: string, label: string): string {
  return new RegExp(`${label}:\\s*(.+)`).exec(state)?.[1]?.trim() ?? "(empty)";
}

function forbiddenTopics(system: string): string[] {
  const line = /Forbidden topics, never answer these:\s*(.+)/.exec(system)?.[1] ?? "";
  return line
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part && part !== "(none)");
}

function firstFact(system: string, text: string): string {
  const block = system.split("Knowledge block:")[1] ?? "";
  const price = /Price from:\s*(.+)/.exec(block)?.[1]?.trim();
  const typology = /Typologies:\s*(.+)/.exec(block)?.[1]?.trim();
  const delivery = /Delivery:\s*(.+)/.exec(block)?.[1]?.trim();
  const orientation = /Orientation:\s*(.+)/.exec(block)?.[1]?.trim();
  if (/precio/i.test(text) && price) return `Los precios arrancan en ${price}.`;
  if (/tipolog/i.test(text) && typology) return `Las tipologías son ${typology}.`;
  if (/entrega/i.test(text) && delivery) return `La entrega está prevista para ${delivery}.`;
  if (/orientaci/i.test(text) && orientation) return `La orientación es ${orientation}.`;
  return "Eso no lo tengo en la ficha. Te lo confirma un asesor.";
}
