import {
  BotIcon,
  Building2Icon,
  ClipboardListIcon,
  FileTextIcon,
  GaugeIcon,
  HistoryIcon,
  MessageCircleIcon,
  MessageSquareQuoteIcon,
  MessagesSquareIcon,
  ScrollTextIcon,
  ShieldBanIcon,
  UsersIcon,
  WaypointsIcon,
  type LucideIcon,
} from "lucide-react";
import type { ConfigDraft } from "./config-draft";

/** Sections of the Asistente group, all inside the one config form. */
export type AssistantSectionId =
  "general" | "conversation" | "forbidden" | "messages" | "limits";

/** One per provider: what it needs, its guide, and its test. */
export type IntegrationSectionId =
  "whatsapp" | "forms" | "hubspot" | "anthropic";

/** Sections that edit part of the config draft (and so show the save bar). */
export type ConfigSectionId = Exclude<
  AssistantSectionId | IntegrationSectionId,
  "whatsapp"
>;

export type SectionId =
  | AssistantSectionId
  | IntegrationSectionId
  | "instructions"
  | "prompt"
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
      { id: "limits", label: "Respuestas y límites", icon: GaugeIcon },
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
    label: "Integraciones",
    items: [
      { id: "whatsapp", label: "WhatsApp (Kapso)", icon: MessageCircleIcon },
      { id: "forms", label: "Formularios", icon: ClipboardListIcon },
      { id: "hubspot", label: "HubSpot", icon: WaypointsIcon },
      { id: "anthropic", label: "Anthropic", icon: BotIcon },
    ],
  },
  {
    label: "Empresa",
    items: [
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

/** Tab values from before a redesign, so old links still land somewhere sensible. */
export const LEGACY_SECTIONS: Record<string, SectionId> = {
  assistant: "general",
  integrations: "whatsapp",
  crm: "forms",
  model: "limits",
};

export const ASSISTANT_SECTIONS: AssistantSectionId[] = [
  "general",
  "conversation",
  "forbidden",
  "messages",
  "limits",
];

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
  limits: [
    "temperature",
    "historyLimit",
    "timeoutSeconds",
    "maxFileMegabytes",
    "maxCharsPerFile",
    "maxCharsTotal",
  ],
  forms: ["welcomeEnabled", "templateName", "templateLanguage", "templateBody"],
  hubspot: ["transcriptProperty"],
  anthropic: ["model"],
};

export function isConfigSection(id: SectionId): id is ConfigSectionId {
  return id in CONFIG_SECTION_FIELDS;
}

export function isAssistantSection(id: SectionId): id is AssistantSectionId {
  return (ASSISTANT_SECTIONS as SectionId[]).includes(id);
}

export function sectionOfField(key: keyof ConfigDraft): ConfigSectionId {
  const entry = Object.entries(CONFIG_SECTION_FIELDS).find(([, keys]) =>
    keys.includes(key),
  );
  return (entry?.[0] as ConfigSectionId | undefined) ?? "general";
}
