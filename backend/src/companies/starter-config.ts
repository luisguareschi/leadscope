import {
  DEFAULT_KNOWLEDGE_LIMITS,
  type CompanyConfigInput,
} from "./company-config.js";

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
    about: `${name} es una desarrolladora inmobiliaria.`,
    timezone: "America/Montevideo",
    defaultCountry: "UY",
    businessHours: "",
    questions: {
      interest:
        "¿Qué estás buscando? Por ejemplo, si es para vivir o para invertir, y cuántos dormitorios.",
      budget: "¿Con qué presupuesto aproximado contás?",
      knowsProjects: "¿Ya conocés nuestros proyectos?",
    },
    forbiddenTopics: {
      describe: [
        "Rentabilidad futura, renta proyectada o retorno de la inversión.",
        "Alquiler o renta garantizada, o cualquier promesa de ingresos.",
      ],
      patterns: [
        "rentabilidad",
        "renta (futura|garantizada|asegurada|proyectada)",
        "(alquiler|ingreso)s? (garantizad|asegurad)",
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
