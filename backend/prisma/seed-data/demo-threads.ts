import type { CrmAction, ThreadSource, ThreadState } from "../../src/generated/prisma/client.js";

type DemoMessage = { from: "lead" | "bot"; text: string; minutesAgo: number; type?: string };

export type DemoThread = {
  phone: string;
  name: string | null;
  email?: string;
  source?: ThreadSource;
  state: ThreadState;
  paused?: boolean;
  needsHuman?: string;
  interest?: string;
  budget?: string;
  knowsProjects?: boolean;
  callTime?: string;
  crm?: { synced: boolean; action?: CrmAction; error?: string };
  messages: DemoMessage[];
};

/** Fictional conversations (fake +598 99 000 0xx numbers) covering every status the panel shows. */
export const DEMO_THREADS: DemoThread[] = [
  {
    phone: "+59899000001",
    name: "Martina",
    state: "qualify",
    interest: "2 dormitorios para vivir",
    messages: [
      { from: "lead", text: "Hola! Vi el anuncio en Instagram", minutesAgo: 14 },
      {
        from: "bot",
        text: "¡Hola Martina! Soy el asistente virtual de Altamira. ¿Qué estás buscando? Por ejemplo, si es para vivir o para invertir, y cuántos dormitorios.",
        minutesAgo: 14,
      },
      { from: "lead", text: "Busco un 2 dormitorios para vivir con mi pareja", minutesAgo: 9 },
      {
        from: "bot",
        text: "¡Genial! Tenemos opciones de 2 dormitorios en Pocitos y Parque Batlle. ¿Con qué presupuesto aproximado contás?",
        minutesAgo: 9,
      },
    ],
  },
  {
    phone: "+59899000002",
    name: "Diego",
    state: "handoff",
    interest: "Monoambiente para invertir",
    budget: "Hasta USD 140.000",
    knowsProjects: false,
    messages: [
      { from: "lead", text: "Buenas, quiero info de monoambientes para invertir", minutesAgo: 70 },
      {
        from: "bot",
        text: "¡Hola Diego! Soy el asistente virtual de Altamira. ¿Con qué presupuesto aproximado contás?",
        minutesAgo: 70,
      },
      { from: "lead", text: "Unos 140 mil dólares", minutesAgo: 66 },
      { from: "bot", text: "Perfecto. ¿Ya conocés nuestros proyectos?", minutesAgo: 66 },
      { from: "lead", text: "No, es la primera vez", minutesAgo: 60 },
      {
        from: "bot",
        text: "En Proyecto Demo Rambla los monoambientes arrancan en USD 129.000, con entrega estimada en diciembre de 2027. ¿En qué día y horario te puede llamar un asesor para contarte más?",
        minutesAgo: 60,
      },
    ],
  },
  {
    phone: "+59899000003",
    name: "Lucía Fernández",
    state: "handoff",
    interest: "3 dormitorios para vivir con la familia",
    budget: "USD 250.000",
    knowsProjects: true,
    callTime: "Mañana después de las 18",
    crm: { synced: false, action: "handoff", error: "HubSpot returned 503 (Service Unavailable)" },
    messages: [
      { from: "lead", text: "Hola, ¿tienen de 3 dormitorios?", minutesAgo: 190 },
      {
        from: "bot",
        text: "¡Hola Lucía! Soy el asistente virtual de Altamira. Sí, en Proyecto Demo Parque hay 3 dormitorios. ¿Es para vivir o para invertir?",
        minutesAgo: 190,
      },
      { from: "lead", text: "Para vivir con mi familia. Tenemos unos 250 mil", minutesAgo: 185 },
      { from: "bot", text: "Gracias. ¿Ya conocés nuestros proyectos?", minutesAgo: 185 },
      { from: "lead", text: "Sí, pasamos por el de Parque Batlle", minutesAgo: 182 },
      { from: "bot", text: "¡Bárbaro! ¿En qué día y horario te puede llamar un asesor?", minutesAgo: 182 },
      { from: "lead", text: "Mañana después de las 18", minutesAgo: 180 },
      {
        from: "bot",
        text: "Listo, un asesor te va a llamar mañana después de las 18. ¡Gracias por escribirnos!",
        minutesAgo: 180,
      },
    ],
  },
  {
    phone: "+59899000004",
    name: "Federico",
    state: "qualify",
    needsHuman: "lead_needs_human",
    interest: "Para invertir",
    crm: { synced: true },
    messages: [
      { from: "lead", text: "Hola, quiero invertir en un apartamento", minutesAgo: 35 },
      {
        from: "bot",
        text: "¡Hola Federico! Soy el asistente virtual de Altamira. ¿Con qué presupuesto aproximado contás?",
        minutesAgo: 35,
      },
      { from: "lead", text: "Antes decime qué rentabilidad me da por año", minutesAgo: 31 },
      {
        from: "bot",
        text: "Esa consulta la tiene que ver un asesor. Ya le pasé tu mensaje y te va a contactar a la brevedad.",
        minutesAgo: 31,
      },
    ],
  },
  {
    phone: "+59899000005",
    name: "Sofía",
    state: "answer",
    paused: true,
    interest: "1 dormitorio",
    budget: "USD 160.000",
    knowsProjects: true,
    messages: [
      { from: "lead", text: "Hola! Quería saber la orientación del 1 dormitorio en Rambla", minutesAgo: 300 },
      {
        from: "bot",
        text: "¡Hola Sofía! Las unidades al frente de Proyecto Demo Rambla están orientadas al norte y las de contrafrente al sur. ¿Te interesa alguna en particular?",
        minutesAgo: 300,
      },
      { from: "lead", text: "Prefiero hablar con Ana, la asesora que me atendió", minutesAgo: 290 },
    ],
  },
  {
    phone: "+59899000006",
    name: "Pablo",
    state: "closed",
    crm: { synced: true },
    messages: [
      { from: "lead", text: "Hola", minutesAgo: 1500 },
      {
        from: "bot",
        text: "¡Hola Pablo! Soy el asistente virtual de Altamira. ¿Qué estás buscando? Por ejemplo, si es para vivir o para invertir, y cuántos dormitorios.",
        minutesAgo: 1500,
      },
      { from: "lead", text: "Perdón, me equivoqué de número", minutesAgo: 1498 },
      { from: "bot", text: "No hay problema, ¡que tengas un buen día!", minutesAgo: 1498 },
    ],
  },
  {
    phone: "+59899000007",
    name: "Valentina Ruiz",
    email: "valentina@example.com",
    source: "form",
    state: "qualify",
    messages: [
      {
        from: "bot",
        type: "template",
        text: "¡Hola! Gracias por tu interés en Altamira. Soy el asistente virtual. ¿Qué estás buscando?",
        minutesAgo: 5,
      },
    ],
  },
];
