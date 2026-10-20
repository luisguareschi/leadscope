import type { CollectItem } from "../companies/company-config.js";
import { foldText } from "../engine/guardrails.js";
import { fieldsOf, missingItems, stageForPrompt } from "../engine/turn.js";
import type { Collected, Intent, ModelTurn } from "../engine/types.js";
import type { CompleteInput, CompleteResult, LlmClient } from "./types.js";

const NOT_INTERESTED =
  /\b(no me interesa|no gracias|no quiero|equivoque|equivocado|equivocada|dejame|no molesten)\b/;
const GREETING_ONLY =
  /^(hola|buenas|buen dia|buenos dias|buenas tardes|buenas noches|hey|que tal)[\s!.,]*$/;
const QUESTION =
  /\?|^(cuanto|cuantos|cual|cuales|que|cuando|donde|tienen|hay|como|me pasas|me decis)\b/;
const YES = /\b(si|claro|obvio|ya los conozco|los conozco|conozco)\b/;
const NO = /\bno\b/;
const MONEY =
  /\b(usd|u\$s|us\$|dolares|pesos|presupuesto)\b|\$|\d+\s*(mil|k)\b|\d{2,3}[.,]\d{3}/;
const KNOWS = /\b(conozco|conoce|conocia|conocemos|vi los|proyectos)\b/;
/**
 * The fake's stand-in for the model's judgment on yield questions. The real model reads the
 * company's plain-language topics; nothing here is company config.
 */
const YIELD_QUESTION =
  /rentab|renta (futur|garantiz|asegur|proyect|estim|esperad|mensual|anual)|(alquiler|ingreso)s? (garantiz|asegur)|garantiz\w* (la |el |una |un )?(renta|alquiler|retorno|ingreso)|retorno|\broi\b|cap rate|plusval|valoriz|cuanto (renta|rinde|deja)|\brinde\b/;
/** Splits "Busco 2 dormitorios, tengo 150 mil y no conozco los proyectos" into its parts. */
const FRAGMENT_BREAK =
  /[,;]|\.\s+|\s+y\s+(?=(?:tengo|cuento|no|ya|conozco|hasta|unos|mi|el)\b)/i;
const FACT_TOPICS: Array<{
  pattern: RegExp;
  keywords: string[];
  label: string;
}> = [
  {
    pattern: /precio|cuesta|sale|valor|usd|dolar/,
    keywords: ["precio"],
    label: "precios",
  },
  {
    pattern: /tipolog|dormitorio|ambiente/,
    keywords: ["tipolog"],
    label: "tipologías",
  },
  { pattern: /entrega|cuando/, keywords: ["entrega"], label: "la entrega" },
  { pattern: /orientaci/, keywords: ["orientaci"], label: "la orientación" },
  {
    pattern: /donde|ubicaci|direcci|barrio|zona/,
    keywords: ["ubicaci"],
    label: "la ubicación",
  },
  {
    pattern: /amenit|piscina|gimnasio|barbacoa/,
    keywords: ["amenit"],
    label: "amenities",
  },
  {
    pattern: /pago|financ|cuota|reserva/,
    keywords: ["reserva", "pago"],
    label: "la forma de pago",
  },
];
const ASKED_PREFIX = "- Preguntó por ";

/** Phrasing for the starter items; any other item is asked by its name. */
const ASK_BY_KEY: Record<string, string> = {
  interest: "¿Qué estás buscando? ¿Es para vivir o para invertir?",
  budget: "¿Con qué presupuesto aproximado contás?",
  knowsProjects: "¿Ya conocés nuestros proyectos?",
};

function itemText(item: CollectItem): string {
  return foldText(`${item.key} ${item.name}`);
}
const isBudgetItem = (item: CollectItem) =>
  /presupuesto|budget|monto|inversion/.test(itemText(item));
const isKnowsItem = (item: CollectItem) =>
  /conoce|proyecto|knows/.test(itemText(item));

function topicOf(question: string) {
  return FACT_TOPICS.find((candidate) => candidate.pattern.test(question));
}

function findFact(
  question: string,
  documents: CompleteInput["scenario"]["documents"],
): string | null {
  const topic = topicOf(question);
  if (!topic) return null;
  for (const doc of documents) {
    const line = doc.text
      .split("\n")
      .map((value) => value.replace(/^[-*#\s]+/, "").trim())
      .find((value) =>
        topic.keywords.some((keyword) => foldText(value).includes(keyword)),
      );
    if (line) return line.replace(/\.$/, "").slice(0, 220);
  }
  return null;
}

/** The listed topic that shares the most word stems with the message, or the first one. */
function closestTopic(text: string, topics: string[]): string | null {
  const stems = new Set(
    text
      .split(/\W+/)
      .filter((word) => word.length >= 4)
      .map((w) => w.slice(0, 5)),
  );
  let best: { topic: string; score: number } | null = null;
  for (const topic of topics) {
    const score = foldText(topic)
      .split(/\W+/)
      .filter((word) => word.length >= 4 && stems.has(word.slice(0, 5))).length;
    if (!best || score > best.score) best = { topic, score };
  }
  return best?.topic ?? null;
}

/**
 * Which item a piece of the lead's message answers. A budget or a yes/no about the projects may
 * correct a stored value; any other text fills the first open item of another kind.
 */
function itemFor(
  fragment: string,
  items: CollectItem[],
  open: CollectItem[],
): CollectItem | undefined {
  if (MONEY.test(fragment)) {
    const budget = items.find(isBudgetItem);
    if (budget) return budget;
  }
  if (KNOWS.test(fragment)) {
    const knows = items.find(isKnowsItem);
    if (knows) return knows;
  }
  return open.find((item) => !isBudgetItem(item) && !isKnowsItem(item));
}

function valueFor(item: CollectItem, fragment: string): string {
  if (!isKnowsItem(item)) return fragment;
  const folded = foldText(fragment);
  return YES.test(folded) && !NO.test(folded) ? "Sí" : "No";
}

function askFor(item: CollectItem): string {
  return (
    ASK_BY_KEY[item.key] ??
    `Para ayudarte mejor, ¿me contás ${item.name.charAt(0).toLowerCase()}${item.name.slice(1)}?`
  );
}

function buildSummary(input: {
  source: "whatsapp" | "form";
  items: CollectItem[];
  collected: Collected;
  previous: string | null | undefined;
  asked: string | null;
  callTime: string | null;
  forbiddenTopic: string | null;
  notInterested: boolean;
}): string {
  const asked = new Set(
    (input.previous ?? "")
      .split("\n")
      .filter((line) => line.startsWith(ASKED_PREFIX)),
  );
  if (input.asked) asked.add(`${ASKED_PREFIX}${input.asked}.`);
  return [
    input.source === "form"
      ? "- Llegó por un formulario y siguió por WhatsApp."
      : "- Escribió por WhatsApp.",
    ...input.items
      .filter((item) => input.collected[item.key])
      .map((item) => `- ${item.name}: ${input.collected[item.key]}.`),
    ...asked,
    input.forbiddenTopic
      ? "- Preguntó por un tema prohibido; espera la respuesta de un asesor."
      : null,
    input.callTime ? `- Pidió que lo llamen ${input.callTime}.` : null,
    input.notInterested ? "- Dijo que no le interesa." : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

/**
 * Local stand-in for the model, used when a company has no Anthropic key and fakes are allowed.
 * It picks up the company's items from what the lead writes, in any order, with simple rules, so
 * the pipeline and panel can be exercised. It is not the prompt that runs in production.
 */
export function createFakeLlm(): LlmClient {
  return {
    kind: "fake",
    async complete(input: CompleteInput): Promise<CompleteResult> {
      const { thread, config, documents } = input.scenario;
      const items = config.collect;
      const lastLead =
        [...input.messages].reverse().find((turn) => turn.role === "user")
          ?.content ?? "";
      // A burst arrives as one turn with a line per message.
      const lines = lastLead
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("[The lead"));
      const said = lines.at(-1) ?? "";
      const text = foldText(said);
      const stage = stageForPrompt(thread, items);
      const fields = fieldsOf(thread);
      const update: Record<string, string | null> = {};
      let callTime: string | null = null;
      let forbiddenTopic: string | null = null;
      const isQuestion = QUESTION.test(text);
      let intent: Intent = "continue";
      let reply: string;
      const collected: Collected = { ...fields.collected };

      const nextAsk = (): string => {
        const missing = missingItems({ collected, callTime: null }, items);
        const required = missing.find((item) => item.required);
        if (required) return askFor(required);
        if (fields.callTime === null)
          return "¿En qué día y horario te puede llamar un asesor?";
        const optional = missing[0];
        return optional ? askFor(optional) : "¿Te puedo ayudar con algo más?";
      };

      const topics = config.forbiddenTopics.describe;
      if (
        topics.length > 0 &&
        lines.some((line) => YIELD_QUESTION.test(foldText(line)))
      ) {
        forbiddenTopic = closestTopic(text, topics);
        reply = "Eso te lo explica un asesor.";
      } else if (NOT_INTERESTED.test(text)) {
        intent = "not_interested";
        reply =
          "Perfecto, gracias por avisar. Si más adelante te interesa, escribinos por acá.";
      } else if (
        stage === "handoff" &&
        fields.callTime === null &&
        !isQuestion
      ) {
        callTime = said;
        intent = "qualified";
        reply = `Listo, un asesor te va a llamar ${said.charAt(0).toLowerCase()}${said.slice(1)}. ¡Gracias por escribirnos!`;
      } else {
        for (const line of lines) {
          const cleaned = line.replace(/^(hola|buenas)[!,.\s]*/i, "").trim();
          for (const fragment of cleaned.split(FRAGMENT_BREAK)) {
            const piece = fragment?.trim().replace(/[.!]+$/, "");
            if (!piece) continue;
            const folded = foldText(piece);
            if (QUESTION.test(folded) || GREETING_ONLY.test(folded)) continue;
            const open = missingItems({ collected, callTime: null }, items);
            const item = itemFor(folded, items, open);
            if (!item) continue;
            collected[item.key] = update[item.key] = valueFor(item, piece);
          }
        }
        const fact = isQuestion ? findFact(text, documents) : null;
        const answer = isQuestion
          ? fact
            ? `${fact}.`
            : "Ese dato te lo confirma un asesor."
          : "";
        const intro =
          stage === "greeting"
            ? `¡Hola! Soy el asistente virtual de ${config.displayName}.`
            : "";
        reply = [intro, answer, nextAsk()].filter(Boolean).join(" ");
      }

      const output: ModelTurn = {
        reply,
        intent,
        collected: update,
        callTime,
        needsHuman: false,
        forbiddenTopic,
        summary: buildSummary({
          source: thread.source,
          items,
          collected,
          previous: thread.summary,
          asked:
            isQuestion && !forbiddenTopic
              ? (topicOf(text)?.label ?? null)
              : null,
          callTime: callTime ?? fields.callTime,
          forbiddenTopic,
          notInterested: intent === "not_interested",
        }),
      };
      return {
        output,
        usage: {
          model: "fake",
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          latencyMs: 0,
        },
      };
    },
  };
}
