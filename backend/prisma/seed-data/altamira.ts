import { DEFAULT_KNOWLEDGE_LIMITS, type CompanyConfigInput } from "../../src/companies/company-config.js";

/**
 * Altamira's company config. Seed data only: the application reads it from the Company row.
 * Values marked "week 1" are placeholders until Altamira confirms them.
 */
export const altamiraConfig: CompanyConfigInput = {
  displayName: "Altamira",
  language: "es-UY",
  tone: 'Español de Uruguay, con voseo ("contame", "¿tenés…?"). Cálido, claro y profesional. Sin emojis salvo que el lead los use.',
  about: "Altamira es una desarrolladora inmobiliaria en Uruguay.",
  timezone: "America/Montevideo",
  defaultCountry: "UY",
  // Week 1: the hours Altamira's advisors make calls.
  businessHours: "",
  questions: {
    interest: "¿Qué estás buscando? Por ejemplo, si es para vivir o para invertir, y cuántos dormitorios.",
    budget: "¿Con qué presupuesto aproximado contás?",
    knowsProjects: "¿Ya conocés nuestros proyectos?",
  },
  forbiddenTopics: {
    describe: [
      "Rentabilidad futura, renta proyectada o retorno de la inversión (porcentajes, ROI, cap rate).",
      "Alquiler o renta garantizada, o cualquier promesa de ingresos.",
      "Valorización o plusvalía futura de las unidades.",
    ],
    patterns: [
      "rentabilidad",
      "renta (futura|garantizada|asegurada|proyectada|estimada|esperada|mensual|anual)",
      "(alquiler|ingreso)s? (garantizad|asegurad)",
      "garantiza\\w* (la |el |una |un )?(renta|alquiler|retorno|rentabilidad|ingreso)",
      "retorno (de|sobre) (la |tu |su )?inversion",
      "rendimiento (de la |del )?(inversion|capital|alquiler)",
      "\\d+([.,]\\d+)? ?% (de )?(renta|rentabilidad|retorno|rendimiento)",
      "\\broi\\b",
      "cap rate",
      "plusvalia",
      "valorizacion",
    ],
  },
  messages: {
    fallback: "Gracias por escribirnos. En breve te contacta un asesor de Altamira para ayudarte.",
    needsHuman: "Esa consulta la tiene que ver un asesor. Ya le pasé tu mensaje y te va a contactar a la brevedad.",
    nonText: "Por ahora solo puedo leer mensajes de texto. ¿Me lo escribís?",
  },
  maxReplyChars: 600,
  llm: { model: "claude-haiku-4-5", temperature: 0.4, historyLimit: 40, timeoutMs: 25_000 },
  knowledge: DEFAULT_KNOWLEDGE_LIMITS,
  // Week 1: the internal name of the HubSpot long-text property that receives the summary.
  crm: { provider: "hubspot", transcriptProperty: "" },
  // Week 1: the welcome template Meta approves. The name must match it exactly.
  whatsapp: {
    welcomeTemplate: {
      name: "bienvenida_formulario",
      language: "es",
      bodyPreview: "¡Hola! Gracias por tu interés en Altamira. Soy el asistente virtual. ¿Qué estás buscando?",
    },
  },
};

export const SAMPLE_KNOWLEDGE_NAME = "proyectos-ejemplo.md";

export const SAMPLE_KNOWLEDGE = `# Proyectos de ejemplo (datos ficticios para desarrollo)

Estos datos son de ejemplo. Reemplazá este archivo por la ficha real de proyectos de Altamira.

## Proyecto Demo Rambla
- Ubicación: Pocitos, Montevideo, a dos cuadras de la rambla.
- Tipologías: monoambientes, 1 y 2 dormitorios.
- Precio desde: USD 129.000 (monoambiente). 2 dormitorios desde USD 219.000.
- Entrega estimada: diciembre de 2027.
- Orientación: unidades al frente orientadas al norte; contrafrente al sur.
- Amenities: piscina en la azotea, gimnasio, cowork y bicicletero.

## Proyecto Demo Parque
- Ubicación: Parque Batlle, Montevideo.
- Tipologías: 2 y 3 dormitorios.
- Precio desde: USD 189.000 (2 dormitorios).
- Entrega estimada: junio de 2028.
- Orientación: este-oeste; todas las unidades tienen balcón.
- Amenities: barbacoa, jardín interior y coworking.

## Forma de pago (ejemplo)
- Reserva con USD 5.000.
- 30% durante la obra y el saldo a la entrega.
`;
