/** Every demo CTA opens a WhatsApp chat with Luis. The landing never shows prices. */
export const WHATSAPP_DEMO_URL =
  "https://wa.me/34695403932?text=Hola%20Luis%2C%20quiero%20una%20demo%20de%20LeadScope%20para%20mi%20empresa";

export const OWNER_CONTACT = {
  name: "Luis Guareschi",
  phoneDisplay: "+34 695 40 3932",
  phoneHref: "tel:+34695403932",
  linkedinUrl: "https://www.linkedin.com/in/luis-guareschi-29a68b1a0/",
} as const;

export type HeroScenarioId = "real_estate" | "logistics" | "b2b_services";

export type HeroMessage =
  | {
      from: "lead";
      text: string;
      /** A voice note: the badge shows above the transcript. */
      audio?: string;
    }
  | {
      from: "assistant";
      text: string;
      time: string;
      /** A public Conocimiento file the assistant sends with the bubble. */
      file?: string;
    };

export type HeroScenario = {
  id: HeroScenarioId;
  label: string;
  leadName: string;
  leadMeta: string;
  messages: HeroMessage[];
  stage: string;
  status: string;
  summary: string[];
  fields: { label: string; value: string }[];
};

export type StageTone = "primary" | "califying" | "ok";
export type BotTone = "ok" | "neutral" | "danger";

export type ConversationPreviewRow = {
  id: string;
  name: string;
  initials: string;
  detail: string;
  stage: "Por contactar" | "Calificando" | "Contactado";
  stageTone: StageTone;
  assistant: "Respondiendo" | "Pausado" | "Requiere asesor";
  assistantTone: BotTone;
  assignee: string;
  hubspot: "Sincronizado" | "—";
  time: string;
  /** Optional link to one of the interactive thread detail tabs in the same window. */
  scenarioId?: HeroScenarioId;
};

export type PreviewRowTone = "accent" | "ok" | "neutral" | "danger";

export type FeaturePreviewRow = {
  title: string;
  detail: string;
  tag: string;
  tone: PreviewRowTone;
};

export type FeatureBlockId = "agent" | "knowledge" | "control";

export type FeatureBlock = {
  id: FeatureBlockId;
  /** Optional HTML anchor id for navbar scroll targets. */
  anchorId?: string;
  kicker: string;
  title: string;
  description: string;
  points: string[];
  visualSide: "left" | "right";
  cardTitle: string;
  cardBadge: string;
  /** Optional red topic chips shown above the rows (used in Control). */
  chips?: string[];
  rows: FeaturePreviewRow[];
};

export type OperationalHighlight = {
  value: string;
  title: string;
  description: string;
};

export type FaqItem = { question: string; answer: string };

export const CONVERSATIONS_PREVIEW_ROWS: ConversationPreviewRow[] = [
  {
    id: "martin-silva",
    name: "Martín Silva",
    initials: "MS",
    detail: "Inmobiliaria · 2 dorm. Tres Cruces",
    stage: "Por contactar",
    stageTone: "primary",
    assistant: "Respondiendo",
    assistantTone: "ok",
    assignee: "Sin asignar",
    hubspot: "Sincronizado",
    time: "Hace 4 min",
    scenarioId: "real_estate",
  },
  {
    id: "logistica-del-sur",
    name: "Logística del Sur",
    initials: "LS",
    detail: "Logística · 4 pallets MVD a ASU",
    stage: "Por contactar",
    stageTone: "primary",
    assistant: "Respondiendo",
    assistantTone: "ok",
    assignee: "Sofía",
    hubspot: "Sincronizado",
    time: "12 min",
    scenarioId: "logistics",
  },
  {
    id: "clinica-norte",
    name: "Clínica Norte",
    initials: "CN",
    detail: "Servicios B2B · 3 sucursales",
    stage: "Por contactar",
    stageTone: "primary",
    assistant: "Requiere asesor",
    assistantTone: "danger",
    assignee: "Mateo",
    hubspot: "Sincronizado",
    time: "Hace 18 min",
    scenarioId: "b2b_services",
  },
  {
    id: "lucia-perez",
    name: "Lucía Pérez",
    initials: "LP",
    detail: "Inmobiliaria · Consulta por planos",
    stage: "Contactado",
    stageTone: "ok",
    assistant: "Pausado",
    assistantTone: "neutral",
    assignee: "Sofía",
    hubspot: "Sincronizado",
    time: "Hace 42 min",
  },
  {
    id: "carlos-mendez",
    name: "Carlos Méndez",
    initials: "CM",
    detail: "Logística · Carga consolidada",
    stage: "Por contactar",
    stageTone: "primary",
    assistant: "Respondiendo",
    assistantTone: "ok",
    assignee: "Sin asignar",
    hubspot: "—",
    time: "Hace 1 h",
  },
  {
    id: "paula-rojas",
    name: "Paula Rojas",
    initials: "PR",
    detail: "Servicios B2B · Plan anual",
    stage: "Calificando",
    stageTone: "califying",
    assistant: "Respondiendo",
    assistantTone: "ok",
    assignee: "Sin asignar",
    hubspot: "—",
    time: "Hace 2 h",
  },
];

export const HERO_SCENARIOS: HeroScenario[] = [
  {
    id: "real_estate",
    label: "Inmobiliaria",
    leadName: "Martín Silva",
    leadMeta: "+598 94 218 401 · WhatsApp oficial",
    messages: [
      {
        from: "lead",
        audio: "Audio transcrito · 0:18",
        text: "Hola! Busco un 2 dormitorios en Tres Cruces, presupuesto hasta USD 170.000.",
      },
      {
        from: "assistant",
        text: "¡Hola! En Tres Cruces tenemos opciones de 2 dormitorios desde USD 158.000 con entrega en diciembre.",
        time: "21:14",
      },
      {
        from: "assistant",
        text: "Te envío el brochure con planos. ¿En qué horario te puede llamar un asesor?",
        time: "21:14",
        file: "Brochure_Tres_Cruces.pdf",
      },
    ],
    stage: "Por contactar",
    status: "HubSpot al día",
    summary: [
      "Busca 2 dormitorios en Tres Cruces.",
      "Presupuesto de USD 170.000 (audio entendido).",
      "Brochure público enviado al cliente.",
    ],
    fields: [
      { label: "Tipología", value: "2 dormitorios" },
      { label: "Presupuesto", value: "USD 170.000" },
    ],
  },
  {
    id: "logistics",
    label: "Logística",
    leadName: "Logística del Sur",
    leadMeta: "+598 99 540 112 · WhatsApp oficial",
    messages: [
      {
        from: "lead",
        text: "Buenas, necesito cotizar 4 pallets consolidados de Montevideo a Asunción para la próxima semana.",
      },
      {
        from: "assistant",
        text: "¡Hola! Tenemos salidas semanales de Montevideo a Asunción para carga consolidada.",
        time: "19:42",
      },
      {
        from: "assistant",
        text: "¿Qué peso aproximado tienen los 4 pallets? Te comparto los requisitos de despacho.",
        time: "19:42",
        file: "Guia_Carga_Consolidada.pdf",
      },
    ],
    stage: "Por contactar",
    status: "Asignado · Sofía",
    summary: [
      "Cotización de flete consolidado MVD a ASU.",
      "Volumen de 4 pallets, salida próxima semana.",
      "Guía de requisitos enviada por WhatsApp.",
    ],
    fields: [
      { label: "Ruta", value: "MVD a ASU" },
      { label: "Volumen", value: "4 pallets" },
    ],
  },
  {
    id: "b2b_services",
    label: "Servicios B2B",
    leadName: "Clínica Norte",
    leadMeta: "+598 91 803 290 · WhatsApp oficial",
    messages: [
      {
        from: "lead",
        text: "Hola, somos una clínica con 3 sucursales y queremos hablar directo con alguien hoy.",
      },
      {
        from: "assistant",
        text: "Perfecto, no te hago más preguntas.",
        time: "11:05",
      },
      {
        from: "assistant",
        text: "Ya pasé tu consulta a un asesor para que te llame lo antes posible.",
        time: "11:05",
      },
    ],
    stage: "Por contactar",
    status: "Pidió hablar ya",
    summary: [
      "Clínica con 3 sucursales.",
      "Pidió hablar con una persona de inmediato.",
      "Saltó las preguntas y pasó directo a Por contactar.",
    ],
    fields: [
      { label: "Horario", value: "Lo antes posible" },
      { label: "Sucursales", value: "3" },
    ],
  },
];

export const FORBIDDEN_TOPIC_EXAMPLES = [
  "Rentabilidad garantizada",
  "Reclamos legales",
  "Descuentos fuera de lista",
];

export const FEATURE_BLOCKS: FeatureBlock[] = [
  {
    id: "agent",
    kicker: "Agente IA",
    title: "Conversa como una persona real, 24/7",
    description:
      "Responde en burbujas cortas como en un chat real, entiende notas de voz e imágenes, y retoma conversaciones dentro de las 24 horas si el lead deja de contestar.",
    points: [
      "Nunca repite preguntas que el cliente ya respondió.",
      "Si el lead pide hablar con una persona, frena las preguntas y lo pasa directo a Por contactar.",
      "Recopila los datos clave de tu negocio en cualquier orden y sin menús rígidos.",
    ],
    visualSide: "left",
    cardTitle: "Actividad del agente",
    cardBadge: "En burbujas",
    rows: [
      {
        title: "Nota de voz recibida",
        detail: "Transcrita y respondida en 4 segundos",
        tag: "Audio",
        tone: "ok",
      },
      {
        title: "Imagen enviada por el cliente",
        detail: "Analizada con Visión en contexto del chat",
        tag: "Visión",
        tone: "accent",
      },
      {
        title: "Seguimiento automático (24h)",
        detail: "Retoma la charla dentro de la ventana oficial",
        tag: "Opcional",
        tone: "neutral",
      },
      {
        title: "Respuestas en burbujas cortas",
        detail: "1 a 3 mensajes breves en lugar de bloques largos",
        tag: "Natural",
        tone: "accent",
      },
    ],
  },
  {
    id: "knowledge",
    kicker: "Conocimiento",
    title: "Tus precios siempre al día, sin entrenar modelos",
    description:
      "Organiza PDFs, Excels, Word e imágenes en carpetas. Reemplaza un archivo con el mismo nombre y el asistente empieza a responder con la versión nueva al instante.",
    points: [
      "Separa archivos internos (solo referencia) de públicos (enviables al cliente por WhatsApp).",
      "Vista previa directa de PDFs e imágenes desde el panel.",
      "Cada carpeta da contexto al modelo sin depender de soporte técnico.",
    ],
    visualSide: "right",
    cardTitle: "Conocimiento",
    cardBadge: "Carpetas",
    rows: [
      {
        title: "Precios / Lista_Noviembre.xlsx",
        detail: "Solo lectura del asistente · Nunca se reenvía",
        tag: "Interno",
        tone: "neutral",
      },
      {
        title: "Catálogos / Brochure_2026.pdf",
        detail: "El asistente y los asesores pueden enviarlo",
        tag: "Público",
        tone: "ok",
      },
      {
        title: "Rutas / Tarifario_Fletes.pdf",
        detail: "Actualizado hace 2 días · Vista previa lista",
        tag: "Interno",
        tone: "neutral",
      },
    ],
  },
  {
    id: "control",
    anchorId: "control",
    kicker: "Control y confianza",
    title: "IA con límites claros y pausa en un clic",
    description:
      "Defines en español normal qué temas no debe tocar. Cuando un asesor escribe desde el panel, el asistente se pausa solo en ese hilo para no interrumpir la venta.",
    points: [
      "Temas prohibidos en lenguaje común: si aparecen, envía un mensaje fijo y marca Requiere asesor.",
      "Pausa automática por hilo cuando responde tu equipo, o pausa global de la empresa en un clic.",
      "Probar asistente permite validar borradores de instrucciones sin tocar tu WhatsApp en vivo.",
    ],
    visualSide: "left",
    cardTitle: "Límites y control humano",
    cardBadge: "Protegido",
    chips: FORBIDDEN_TOPIC_EXAMPLES,
    rows: [
      {
        title: "Tema prohibido detectado",
        detail: "Respuesta fija enviada · Esperando al equipo",
        tag: "Requiere asesor",
        tone: "accent",
      },
      {
        title: "Enviado por Sofía",
        detail: "Asistente pausado automáticamente en este chat",
        tag: "Pausado",
        tone: "neutral",
      },
      {
        title: "Probar borrador",
        detail: "Simulación local sin impacto en producción",
        tag: "Activo",
        tone: "ok",
      },
    ],
  },
];

export const OPERATIONAL_HIGHLIGHTS: OperationalHighlight[] = [
  {
    value: "24/7",
    title: "Atención en tu número oficial",
    description:
      "Opera sobre tu cuenta oficial de WhatsApp Business en Meta, atiende consultas fuera de horario y mantiene los celulares personales de tus vendedores aparte.",
  },
  {
    value: "HubSpot",
    title: "Sincronización opcional por empresa",
    description:
      "Actívalo o desactívalo con un interruptor. Crea contactos sin duplicar teléfonos y escribe resumen y conversación en un solo campo; sin CRM, trabajas igual desde el panel.",
  },
  {
    value: "1 panel",
    title: "Métricas, conversaciones y archivos",
    description:
      "Etapas editables a medida, asignación en un clic, tiempos hasta el contacto, consumo estimado de IA y WhatsApp, y app instalable en iPhone y escritorio.",
  },
];

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: "¿Pierdo mi número de WhatsApp o el celular de mis vendedores?",
    answer:
      "No. Conectamos tu número oficial de WhatsApp Business dentro de tu propia cuenta de Meta. Tus vendedores mantienen sus números personales y también pueden responder desde el panel cuando quieran.",
  },
  {
    question: "¿Necesito tener HubSpot para usar LeadScope?",
    answer:
      "No es obligatorio. Si usas HubSpot, LeadScope crea y actualiza cada contacto automáticamente. Si no usas CRM, gestionas todo el embudo (etapas, responsables y seguimiento) directo desde el panel.",
  },
  {
    question: "¿Cómo funciona el precio y la puesta en marcha?",
    answer:
      "Cotizamos según tu volumen mensual de leads y las integraciones que necesites. Escríbenos por WhatsApp, te mostramos una demo con archivos parecidos a los tuyos y en días queda funcionando.",
  },
];
