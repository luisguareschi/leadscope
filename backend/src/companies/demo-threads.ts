import { PrismaClient } from "@prisma/client";
import { ThreadState } from "../engine/types";
import { ALTAMIRA_PHONE_NUMBER_ID } from "./altamira";

type DemoMessage = {
  id: string;
  direction: "in" | "out";
  body: string;
};

type DemoThread = {
  phone: string;
  state: ThreadState;
  paused: boolean;
  needsHuman: boolean;
  interest: string | null;
  budget: string | null;
  knowsProjects: boolean | null;
  callTime: string | null;
  messages: DemoMessage[];
};

/** Fake numbers and sample copy. Not Altamira leads. */
const DEMO_THREADS: DemoThread[] = [
  {
    phone: "+59899000001",
    state: "Qualify",
    paused: false,
    needsHuman: false,
    interest: "apartamento de dos dormitorios para vivir",
    budget: null,
    knowsProjects: null,
    callTime: null,
    messages: [
      {
        id: "demo-qualify-in-1",
        direction: "in",
        body: "Hola, busco un apartamento de dos dormitorios para vivir.",
      },
      {
        id: "demo-qualify-out-1",
        direction: "out",
        body: "¿Con qué presupuesto contás?",
      },
    ],
  },
  {
    phone: "+59899000002",
    state: "Answer",
    paused: false,
    needsHuman: false,
    interest: "invertir",
    budget: "hasta USD 150.000",
    knowsProjects: false,
    callTime: null,
    messages: [
      {
        id: "demo-answer-in-1",
        direction: "in",
        body: "Quiero invertir, presupuesto hasta USD 150.000. No conozco los proyectos.",
      },
      {
        id: "demo-answer-out-1",
        direction: "out",
        body: "Dale. ¿Desde qué precio querés que te cuente?",
      },
      {
        id: "demo-answer-in-2",
        direction: "in",
        body: "¿Desde qué precio arranca?",
      },
      {
        id: "demo-answer-out-2",
        direction: "out",
        body: "En la ficha de prueba, Ejemplo Norte arranca en USD 120.000. No es inventario real.",
      },
    ],
  },
  {
    phone: "+59899000003",
    state: "Handoff",
    paused: false,
    needsHuman: false,
    interest: "para vivir",
    budget: "unos USD 180.000",
    knowsProjects: true,
    callTime: "mañana a las 10",
    messages: [
      {
        id: "demo-handoff-in-1",
        direction: "in",
        body: "Busco para vivir, ando en unos USD 180.000 y ya conozco los proyectos.",
      },
      {
        id: "demo-handoff-out-1",
        direction: "out",
        body: "¿Cuándo te puede llamar un asesor?",
      },
      {
        id: "demo-handoff-in-2",
        direction: "in",
        body: "Mañana a las 10.",
      },
      {
        id: "demo-handoff-out-2",
        direction: "out",
        body: "Dale, un asesor te llama mañana a las 10.",
      },
    ],
  },
  {
    phone: "+59899000004",
    state: "Answer",
    paused: true,
    needsHuman: false,
    interest: "dos dormitorios",
    budget: "unos USD 200.000",
    knowsProjects: false,
    callTime: null,
    messages: [
      {
        id: "demo-paused-in-1",
        direction: "in",
        body: "Hola, me interesa un dos dormitorios.",
      },
      {
        id: "demo-paused-out-1",
        direction: "out",
        body: "¿Con qué presupuesto contás?",
      },
      {
        id: "demo-paused-in-2",
        direction: "in",
        body: "Unos USD 200.000. Los proyectos no los conozco.",
      },
      {
        id: "demo-paused-out-2",
        direction: "out",
        body: "Cuando quieras, un asesor te los cuenta.",
      },
    ],
  },
  {
    phone: "+59899000005",
    state: "Qualify",
    paused: false,
    needsHuman: true,
    interest: "un apartamento",
    budget: null,
    knowsProjects: null,
    callTime: null,
    messages: [
      {
        id: "demo-human-in-1",
        direction: "in",
        body: "Hola, busco un apartamento.",
      },
      {
        id: "demo-human-out-1",
        direction: "out",
        body: "¿Con qué presupuesto contás?",
      },
      {
        id: "demo-human-in-2",
        direction: "in",
        body: "Solo si hay renta garantizada.",
      },
      {
        id: "demo-human-out-2",
        direction: "out",
        body: "Te va a contactar un asesor.",
      },
    ],
  },
];

/**
 * Inserts the five sample threads only when the database has no threads.
 * A second call, or any call after real conversations exist, inserts nothing.
 */
export async function seedDemoThreads(db: PrismaClient): Promise<number> {
  const existing = await db.thread.count();
  if (existing > 0) return 0;
  const company = await db.company.findUnique({ where: { whatsappPhoneNumberId: ALTAMIRA_PHONE_NUMBER_ID } });
  if (!company) return 0;

  const started = Date.now();
  let tick = 0;
  let inserted = 0;
  for (const demo of DEMO_THREADS) {
    const thread = await db.thread.create({
      data: {
        companyId: company.id,
        phone: demo.phone,
        state: demo.state,
        paused: demo.paused,
        needsHuman: demo.needsHuman,
        interest: demo.interest,
        budget: demo.budget,
        knowsProjects: demo.knowsProjects,
        callTime: demo.callTime,
        lastInboundAt: new Date(started),
      },
    });
    for (const message of demo.messages) {
      tick += 1;
      await db.message.create({
        data: {
          companyId: company.id,
          threadId: thread.id,
          direction: message.direction === "in" ? "inbound" : "outbound",
          body: message.body,
          contentType: "text",
          whatsappMessageId: message.id,
          createdAt: new Date(started + tick),
        },
      });
    }
    inserted += 1;
  }
  return inserted;
}
