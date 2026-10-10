import { CompanyConfig } from "./config";
import { CompanySecrets } from "../crypto/secrets";
import { KNOWLEDGE_MAX_COMPANY_BYTES, KNOWLEDGE_MAX_FILE_BYTES } from "./knowledge-limits";

/** Seed config only. The engine does not import this file. */
export const ALTAMIRA_PHONE_NUMBER_ID = "FAKE_PHONE_NUMBER_ID";

export function altamiraConfig(): CompanyConfig {
  return {
    displayName: "Altamira",
    language: "es-UY",
    tone: "Español uruguayo, con voseo. Cercano y breve.",
    brandVoice: "Desarrolladora inmobiliaria. No prometas rentabilidad ni renta futura.",
    questions: [
      "¿Qué estás buscando?",
      "¿Con qué presupuesto contás?",
      "¿Ya conocés los proyectos?",
    ],
    forbiddenTopics: [
      "renta futura",
      "renta garantizada",
      "alquiler garantizado",
      "retorno garantizado",
      "rendimiento garantizado",
      "garantía de renta",
    ],
    businessHours: "",
    messages: {
      fallback: "Te va a contactar un asesor.",
      nonText: "¿Me lo podés escribir? Así te ayudo.",
      maxReplyChars: 500,
    },
    knowledge: {
      maxFileBytes: KNOWLEDGE_MAX_FILE_BYTES,
      maxCompanyBytes: KNOWLEDGE_MAX_COMPANY_BYTES,
      allowlistedUrls: [],
    },
    crm: {
      adapter: "hubspot",
      transcriptProperty: "",
    },
    whatsapp: {
      phoneNumberId: ALTAMIRA_PHONE_NUMBER_ID,
      welcomeTemplateName: "welcome_placeholder",
      templateLanguage: "es",
    },
  };
}

export function altamiraDevSecrets(): CompanySecrets {
  return {
    anthropicApiKey: "fake",
    hubspotAccessToken: "fake",
    metaAccessToken: "fake",
    googleAccessJson: "",
    formLeadSecret: "dev-form-secret",
  };
}
