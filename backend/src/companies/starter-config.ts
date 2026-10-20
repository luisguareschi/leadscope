import {
  DEFAULT_KNOWLEDGE_LIMITS,
  type CollectItem,
  type CompanyConfigInput,
} from "./company-config.js";

/** What every new company starts finding out: the three items Altamira qualifies with. */
export const STARTER_COLLECT: CollectItem[] = [
  {
    key: "interest",
    name: "Interés",
    description:
      "Qué está buscando: si es para vivir o para invertir, y cuántos dormitorios.",
    required: true,
  },
  {
    key: "budget",
    name: "Presupuesto",
    description: "Con qué presupuesto aproximado cuenta.",
    required: true,
  },
  {
    key: "knowsProjects",
    name: "Conoce los proyectos",
    description:
      "Si ya conoce los proyectos de la empresa (sí o no, y cuáles si lo dice).",
    required: true,
  },
];

/**
 * Config written when a platform admin creates a company. Same shape the seed stores for
 * Altamira, with the typed name filled in. No secrets, no WhatsApp number, no demo data.
 * Altamira's own wording stays in prisma/seed-data and is not copied here.
 */
export function starterCompanyConfig(displayName: string): CompanyConfigInput {
  const name = displayName.trim();
  return {
    displayName: name,
    language: "es",
    tone: "Español claro y profesional. Cálido, sin emojis salvo que el lead los use.",
    timezone: "America/Montevideo",
    defaultCountry: "UY",
    businessHours: "",
    collect: STARTER_COLLECT,
    forbiddenTopics: {
      describe: [
        "Rentabilidad futura, renta proyectada o retorno de la inversión.",
        "Alquiler o renta garantizada, o cualquier promesa de ingresos.",
      ],
    },
    messages: {
      fallback: `Gracias por escribirnos. En breve te contacta un asesor de ${name}.`,
      needsHuman:
        "Esa consulta la tiene que ver un asesor. Ya le pasé tu mensaje y te va a contactar a la brevedad.",
      nonText: "Por ahora solo puedo leer mensajes de texto. ¿Me lo escribís?",
    },
    maxReplyChars: 600,
    knowledge: DEFAULT_KNOWLEDGE_LIMITS,
    crm: { provider: "hubspot", transcriptProperty: "" },
    whatsapp: { welcomeTemplate: null },
  };
}

/** The company instructions a new company starts with. Its operators rewrite them in Configuración. */
export function starterInstructions(displayName: string): string {
  return `${displayName.trim()} es una desarrolladora inmobiliaria.`;
}
