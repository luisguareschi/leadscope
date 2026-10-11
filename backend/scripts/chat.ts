/**
 * Talk to the assistant as a lead, from the terminal:
 *   npm run chat -- [--company altamira] [--phone +59899000123] [--name "Lead de prueba"] [--real-crm]
 *
 * Uses the real engine, the company's uploaded knowledge, and the real model when the company (or
 * ANTHROPIC_API_KEY in development) has a key. WhatsApp is always faked here; HubSpot too unless
 * --real-crm is passed. The conversation shows up in the backoffice like any other thread.
 * Commands: /audio (send a voice note), /estado, /reset, /salir.
 */
import { createInterface } from "node:readline";
import { parseArgs } from "node:util";
import { loadCompany } from "../src/companies/load-company.js";
import { loadEnv } from "../src/config/env.js";
import { recordInboundMessage } from "../src/conversation/inbound.js";
import { processThread } from "../src/conversation/process-thread.js";
import { createContext } from "../src/create-context.js";
import { createIntegrations } from "../src/integrations/registry.js";
import { logger } from "../src/lib/logger.js";
import { e164ToWaId, waIdToE164 } from "../src/lib/phone.js";

const { values } = parseArgs({
  options: {
    company: { type: "string", default: "altamira" },
    phone: { type: "string", default: "+59899555123" },
    name: { type: "string", default: "Lead de prueba" },
    "real-crm": { type: "boolean", default: false },
  },
});

const dim = (text: string) => `\x1b[2m${text}\x1b[0m`;
const bold = (text: string) => `\x1b[1m${text}\x1b[0m`;

async function main() {
  const env = loadEnv();
  logger.level = "warn";
  const base = createIntegrations(env);
  const integrations = {
    ...base,
    channelFor: () => base.fakes.channel,
    crmFor: values["real-crm"] ? base.crmFor : () => base.fakes.crm,
  };
  const ctx = createContext(env, { integrations });
  const company = await ctx.db.company.findUnique({ where: { slug: values.company } });
  if (!company?.whatsappPhoneNumberId) throw new Error(`Company "${values.company}" not found or has no phone number id`);
  const waId = e164ToWaId(values.phone);
  const phone = waIdToE164(waId);
  if (!phone) throw new Error(`Invalid phone ${values.phone}`);

  const llmKind = ctx.integrations.llmFor(loadCompany(company, ctx.encryptionKey)).kind;
  console.log(bold(`Chat with ${company.name}'s assistant as ${values.name} (${phone}).`));
  console.log(dim(`Model: ${llmKind === "fake" ? "local fake (set an Anthropic key for the real model)" : "Anthropic"}. Commands: /audio /estado /reset /salir`));

  const findThread = () => ctx.db.thread.findUnique({ where: { companyId_phone: { companyId: company.id, phone } } });
  const printState = async () => {
    const thread = await findThread();
    if (!thread) return console.log(dim("(no conversation yet)"));
    const flags = [thread.paused && "paused", thread.needsHuman && `needs human: ${thread.needsHumanReason}`].filter(Boolean);
    console.log(
      dim(
        `[${thread.state}${flags.length ? ` · ${flags.join(" · ")}` : ""}] interest: ${thread.interest ?? "—"} · budget: ${thread.budget ?? "—"} · knows projects: ${thread.knowsProjects ?? "—"} · call: ${thread.callTime ?? "—"} · crm: ${thread.crmSyncedAt ? "synced" : thread.crmPendingAction ? "pending" : "—"}`,
      ),
    );
  };

  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
  rl.setPrompt(bold("Vos: "));
  rl.prompt();
  let counter = 0;
  for await (const rawLine of rl) {
    const line = rawLine.trim();
    if (!process.stdin.isTTY && line) console.log(line);
    if (line === "/salir") break;
    if (!line) {
      rl.prompt();
      continue;
    }
    if (line === "/estado" || line === "/reset") {
      if (line === "/reset") {
        await ctx.db.thread.deleteMany({ where: { companyId: company.id, phone } });
        console.log(dim("(conversation deleted)"));
      } else {
        await printState();
      }
      rl.prompt();
      continue;
    }
    const isAudio = line === "/audio";
    const result = await recordInboundMessage(ctx, {
      phoneNumberId: company.whatsappPhoneNumberId,
      waMessageId: `wamid.chat.${Date.now()}.${counter++}`,
      from: waId,
      profileName: values.name,
      type: isAudio ? "audio" : "text",
      body: isAudio ? "" : line,
      sentAt: new Date(),
    });
    if (result.status !== "recorded") {
      console.log(dim(`(message not recorded: ${result.status})`));
      rl.prompt();
      continue;
    }
    const since = new Date();
    const outcome = await processThread(ctx, result.threadId);
    const replies = await ctx.db.message.findMany({
      where: { threadId: result.threadId, direction: "outbound", createdAt: { gte: since } },
      orderBy: { sentAt: "asc" },
    });
    for (const reply of replies) console.log(`${bold("Asistente:")} ${reply.body}`);
    if (replies.length === 0) console.log(dim(`(no reply: ${outcome})`));
    await printState();
    rl.prompt();
  }
  rl.close();
  await ctx.db.$disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
