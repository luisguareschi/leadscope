import {
  Building2Icon,
  CpuIcon,
  FileTextIcon,
  HistoryIcon,
  MessageSquareQuoteIcon,
  MessagesSquareIcon,
  PlugIcon,
  ScrollTextIcon,
  SendIcon,
  ShieldBanIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import type { ConfigDraft } from "./config-draft";

export type ConfigSectionId =
  "general" | "conversation" | "forbidden" | "messages" | "crm" | "model";

export type SectionId =
  | ConfigSectionId
  | "instructions"
  | "prompt"
  | "integrations"
  | "versions"
  | "operators";

export type SectionItem = {
  id: SectionId;
  label: string;
  icon: LucideIcon;
  supportOnly?: boolean;
};

export const SECTION_GROUPS: Array<{ label: string; items: SectionItem[] }> = [
  {
    label: "Asistente",
    items: [
      { id: "general", label: "General", icon: Building2Icon },
      { id: "conversation", label: "Conversación", icon: MessagesSquareIcon },
      { id: "forbidden", label: "Temas prohibidos", icon: ShieldBanIcon },
      { id: "messages", label: "Mensajes fijos", icon: MessageSquareQuoteIcon },
      { id: "crm", label: "Bienvenida y CRM", icon: SendIcon },
      { id: "model", label: "Modelo y límites", icon: CpuIcon },
    ],
  },
  {
    label: "Prompt",
    items: [
      { id: "instructions", label: "Instrucciones", icon: FileTextIcon },
      { id: "prompt", label: "Reglas y prompt", icon: ScrollTextIcon },
    ],
  },
  {
    label: "Empresa",
    items: [
      { id: "integrations", label: "Integraciones", icon: PlugIcon },
      { id: "versions", label: "Historial", icon: HistoryIcon },
      {
        id: "operators",
        label: "Operadores",
        icon: UsersIcon,
        supportOnly: true,
      },
    ],
  },
];

export const DEFAULT_SECTION: SectionId = "general";

/** Tab values from before the redesign, so old links still land somewhere sensible. */
export const LEGACY_SECTIONS: Record<string, SectionId> = {
  assistant: "general",
};

export const CONFIG_SECTION_FIELDS: Record<
  ConfigSectionId,
  Array<keyof ConfigDraft>
> = {
  general: [
    "companyName",
    "assistantName",
    "language",
    "timezone",
    "defaultCountry",
    "businessHours",
  ],
  conversation: ["tone", "maxReplyChars", "collect"],
  forbidden: ["forbiddenDescribe"],
  messages: ["needsHuman", "fallback", "nonText"],
  crm: [
    "welcomeEnabled",
    "templateName",
    "templateLanguage",
    "templateBody",
    "transcriptProperty",
  ],
  model: [
    "model",
    "temperature",
    "historyLimit",
    "timeoutSeconds",
    "maxFileMegabytes",
    "maxCharsPerFile",
    "maxCharsTotal",
  ],
};

export function isConfigSection(id: SectionId): id is ConfigSectionId {
  return id in CONFIG_SECTION_FIELDS;
}

export function sectionOfField(key: keyof ConfigDraft): ConfigSectionId {
  const entry = Object.entries(CONFIG_SECTION_FIELDS).find(([, keys]) =>
    keys.includes(key),
  );
  return (entry?.[0] as ConfigSectionId | undefined) ?? "general";
}
