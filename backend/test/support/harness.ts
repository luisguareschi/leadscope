import pino from "pino";
import { parseCompanyConfig, type CompanyConfigInput } from "../../src/companies/company-config.js";
import { encryptSecrets, type CompanySecrets } from "../../src/companies/company-secrets.js";
import type { AppContext } from "../../src/context.js";
import { createContext } from "../../src/create-context.js";
import { createIntegrations, type Integrations } from "../../src/integrations/registry.js";
import type { InboundMessage } from "../../src/integrations/whatsapp/webhook-payload.js";
import { parseEncryptionKey } from "../../src/lib/crypto.js";
import { createPrisma, type Db } from "../../src/lib/prisma.js";
import { scriptedLlm, type ScriptedLlm } from "./scripted-llm.js";
import { TEST_ENCRYPTION_KEY, testEnv } from "./test-env.js";

let sharedDb: Db | null = null;

export function testDb(): Db {
  sharedDb ??= createPrisma(testEnv().DATABASE_URL);
  return sharedDb;
}

export async function resetDb(db: Db = testDb()): Promise<void> {
  await db.$executeRawUnsafe(
    'TRUNCATE "LlmUsage", "Message", "Thread", "KnowledgeFile", "Operator", "Company" RESTART IDENTITY CASCADE',
  );
}

export const baseConfig: CompanyConfigInput = {
  displayName: "Constructora Test",
  language: "es-UY",
  tone: "Breve y cordial, con voseo.",
  questions: {
    interest: "¿Qué estás buscando?",
    budget: "¿Con qué presupuesto contás?",
    knowsProjects: "¿Ya conocés nuestros proyectos?",
  },
  forbiddenTopics: { describe: ["Rentabilidad futura"], patterns: ["rentabilidad", "renta garantizada"] },
  messages: {
    fallback: "Te va a contactar un asesor.",
    needsHuman: "Un asesor te va a responder eso.",
    nonText: "¿Me lo escribís?",
  },
  whatsapp: { welcomeTemplate: { name: "bienvenida", language: "es", bodyPreview: "¡Hola! Gracias por escribirnos." } },
};

export async function createCompany(
  db: Db,
  options: { slug?: string; phoneNumberId?: string; config?: Partial<CompanyConfigInput>; secrets?: CompanySecrets } = {},
) {
  const slug = options.slug ?? "test-co";
  return db.company.create({
    data: {
      slug,
      name: slug,
      config: parseCompanyConfig({ ...baseConfig, ...options.config }),
      whatsappPhoneNumberId: options.phoneNumberId ?? `PNID-${slug}`,
      encryptedSecrets: encryptSecrets(
        options.secrets ?? { formLeadSecret: "form-secret" },
        parseEncryptionKey(TEST_ENCRYPTION_KEY),
      ),
    },
  });
}

export type TestContext = AppContext & { llm: ScriptedLlm };

export function createTestContext(options: { integrations?: Partial<Integrations>; now?: () => Date } = {}): TestContext {
  const env = testEnv();
  const llm = scriptedLlm();
  const base = createIntegrations(env, { llmFor: () => llm });
  const ctx = createContext(env, {
    db: testDb(),
    integrations: { ...base, ...options.integrations },
    logger: pino({ level: "silent" }),
    now: options.now,
  });
  return Object.assign(ctx, { llm });
}

let messageCounter = 0;

export function inbound(phoneNumberId: string, overrides: Partial<InboundMessage> = {}): InboundMessage {
  messageCounter += 1;
  return {
    phoneNumberId,
    waMessageId: `wamid.test.${Date.now()}.${messageCounter}`,
    from: "59899111222",
    profileName: "Ana",
    type: "text",
    body: "Hola",
    sentAt: new Date(),
    ...overrides,
  };
}
