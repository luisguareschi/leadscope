import { findForbidden, foldText } from "../engine/guardrails.js";
import { fieldsOf, stageForPrompt } from "../engine/turn.js";
import type { Intent, LeadFields } from "../engine/types.js";
import type { CompleteInput, CompleteResult, LlmClient } from "./types.js";

const NOT_INTERESTED = /\b(no me interesa|no gracias|no quiero|equivoque|equivocado|equivocada|dejame|no molesten)\b/;
const GREETING_ONLY = /^(hola|buenas|buen dia|buenos dias|buenas tardes|buenas noches|hey|que tal)[\s!.,]*$/;
const QUESTION = /\?|^(cuanto|cuantos|cual|cuales|que|cuando|donde|tienen|hay|como|me pasas|me decis)\b/;
const YES = /\b(si|claro|obvio|ya los conozco|los conozco|conozco)\b/;
const NO = /\bno\b/;
const FACT_TOPICS: Array<{ pattern: RegExp; keywords: string[] }> = [
  { pattern: /precio|cuesta|sale|valor|usd|dolar/, keywords: ["precio"] },
  { pattern: /tipolog|dormitorio|ambiente/, keywords: ["tipolog"] },
  { pattern: /entrega|cuando/, keywords: ["entrega"] },
  { pattern: /orientaci/, keywords: ["orientaci"] },
  { pattern: /donde|ubicaci|direcci|barrio|zona/, keywords: ["ubicaci"] },
  { pattern: /amenit|piscina|gimnasio|barbacoa/, keywords: ["amenit"] },
  { pattern: /pago|financ|cuota|reserva/, keywords: ["reserva", "pago"] },
];

function findFact(question: string, documents: CompleteInput["scenario"]["documents"]): string | null {
  const topic = FACT_TOPICS.find((candidate) => candidate.pattern.test(question));
  if (!topic) return null;
  for (const doc of documents) {
    const line = doc.text
      .split("\n")
      .map((value) => value.replace(/^[-*#\s]+/, "").trim())
      .find((value) => topic.keywords.some((keyword) => foldText(value).includes(keyword)));
    if (line) return line.replace(/\.$/, "").slice(0, 220);
  }
  return null;
}

/**
 * Local stand-in for the model, used when a company has no Anthropic key and fakes are allowed.
 * It walks the qualifying questions with simple rules so the pipeline and panel can be exercised.
 * It is not the prompt that runs in production.
 */
export function createFakeLlm(): LlmClient {
  return {
    kind: "fake",
    async complete(input: CompleteInput): Promise<CompleteResult> {
      const { thread, config, documents } = input.scenario;
      const lastLead = [...input.messages].reverse().find((turn) => turn.role === "user")?.content ?? "";
      // A burst arrives as one turn with a line per message.
      const lines = lastLead
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("[The lead"));
      const said = lines.at(-1) ?? "";
      const text = foldText(said);
      const stage = stageForPrompt(thread);
      const fields = fieldsOf(thread);
      const update: LeadFields = { interest: null, budget: null, knowsProjects: null, callTime: null };
      const isQuestion = QUESTION.test(text);
      let intent: Intent = "continue";
      let reply: string;

      const nextAsk = (merged: LeadFields): string => {
        if (merged.interest === null) return config.questions.interest;
        if (merged.budget === null) return config.questions.budget;
        if (merged.knowsProjects === null) return config.questions.knowsProjects;
        if (merged.callTime === null) return "¿En qué día y horario te puede llamar un asesor?";
        return "¿Te puedo ayudar con algo más?";
      };

      if (findForbidden(text, config.forbiddenTopics.patterns)) {
        intent = "needs_human";
        reply = "Eso te lo explica un asesor.";
      } else if (NOT_INTERESTED.test(text)) {
        intent = "not_interested";
        reply = "Perfecto, gracias por avisar. Si más adelante te interesa, escribinos por acá.";
      } else if (stage === "handoff" && fields.callTime === null && !isQuestion) {
        update.callTime = said;
        intent = "qualified";
        reply = `Listo, un asesor te va a llamar ${said.charAt(0).toLowerCase()}${said.slice(1)}. ¡Gracias por escribirnos!`;
      } else {
        const merged: LeadFields = { ...fields };
        for (const line of lines) {
          const folded = foldText(line);
          if (QUESTION.test(folded) || GREETING_ONLY.test(folded)) continue;
          const cleaned = line.replace(/^(hola|buenas)[!,.\s]*/i, "").trim();
          if (!cleaned) continue;
          if (merged.interest === null) merged.interest = update.interest = cleaned;
          else if (merged.budget === null) merged.budget = update.budget = cleaned;
          else if (merged.knowsProjects === null) {
            merged.knowsProjects = update.knowsProjects = YES.test(folded) && !NO.test(folded);
          }
        }
        const fact = isQuestion ? findFact(text, documents) : null;
        const answer = isQuestion ? (fact ? `${fact}.` : "Ese dato te lo confirma un asesor.") : "";
        const intro = stage === "greeting" ? `¡Hola! Soy el asistente virtual de ${config.displayName}.` : "";
        reply = [intro, answer, nextAsk(merged)].filter(Boolean).join(" ");
      }

      return {
        output: { reply, intent, ...update },
        usage: { model: "fake", inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, latencyMs: 0 },
      };
    },
  };
}
