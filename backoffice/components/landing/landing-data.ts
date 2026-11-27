/** Every demo CTA opens a WhatsApp chat with Luis. The landing never shows prices. */
export const WHATSAPP_DEMO_URL =
  "https://wa.me/34695403932?text=Hola%20Luis%2C%20quiero%20una%20demo%20de%20LeadScope%20para%20mi%20empresa";

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
  messages: HeroMessage[];
  stage: string;
  status: string;
  summary: string[];
  fields: { label: string; value: string }[];
};

export type ProductTabId = "agent" | "team" | "knowledge" | "metrics";

export type ProductRowTone = "accent" | "ok" | "neutral" | "danger";

export type ProductTab = {
  id: ProductTabId;
  label: string;
  title: string;
  description: string;
  points: string[];
  rows: {
    title: string;
    detail: string;
    tag: string;
    tone: ProductRowTone;
  }[];
};

export type FaqItem = { question: string; answer: string };

export const HERO_SCENARIOS: HeroScenario[] = [
  {
    id: "real_estate",
    label: "Inmobiliaria",
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
    status: "Asignado · Ventas",
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

export const PRODUCT_TABS: ProductTab[] = [
  {
    id: "agent",
    label: "Agente IA",
    title: "Conversa como una persona real",
    description:
      "Envía respuestas en burbujas cortas, entiende audios y fotos, y hace seguimientos automáticos dentro de las 24 horas si el lead deja de responder.",
    points: [
      "Nunca repite preguntas que el cliente ya contestó.",
      "Si el cliente pide hablar con una persona, frena las preguntas al instante.",
      "Recopila hasta 10 datos clave según tu negocio.",
    ],
    rows: [
      {
        title: "Nota de voz recibida",
        detail: "Transcrita y respondida en 4 segundos",
        tag: "Audio",
        tone: "ok",
      },
      {
        title: "Imagen enviada por el cliente",
        detail: "Analizada en contexto sin salir del chat",
        tag: "Visión",
        tone: "accent",
      },
      {
        title: "Seguimiento automático (24h)",
        detail: "Retoma la charla si no respondió en 4 h",
        tag: "Opcional",
        tone: "neutral",
      },
    ],
  },
  {
    id: "team",
    label: "Panel de equipo",
    title: "Cola ordenada para tus vendedores",
    description:
      "Cada asesor ve qué clientes esperan llamada, desde hace cuánto tiempo y puede responder directo desde el panel con formato de WhatsApp y archivos.",
    points: [
      "Etapas editables a medida más 6 etapas base.",
      "Asignación de leads en un clic sin abrir planillas.",
      "App instalable en iPhone y escritorio en modo claro u oscuro.",
    ],
    rows: [
      {
        title: "Martín Silva",
        detail: "Por contactar · Esperando 12 min",
        tag: "Sin asignar",
        tone: "accent",
      },
      {
        title: "Lucía Pérez",
        detail: "Escribió de nuevo · Asignada a Sofía",
        tag: "Contactado",
        tone: "ok",
      },
      {
        title: "Carlos Méndez",
        detail: "Pidió hablar ya · Lo antes posible",
        tag: "Hablar ya",
        tone: "danger",
      },
    ],
  },
  {
    id: "knowledge",
    label: "Conocimiento",
    title: "Tus precios siempre actualizados",
    description:
      "Sube PDFs, Excels, Word e imágenes en carpetas. Reemplaza un archivo con el mismo nombre y el asistente ya usa la versión nueva.",
    points: [
      "Separa archivos internos (solo referencia) de públicos (enviables al cliente).",
      "Vista previa directa de PDFs e imágenes desde el panel.",
      "Sin entrenar modelos ni depender de soporte técnico.",
    ],
    rows: [
      {
        title: "Precios / Lista_Noviembre.xlsx",
        detail: "Solo lectura del asistente",
        tag: "Interno",
        tone: "neutral",
      },
      {
        title: "Catálogos / Brochure_2026.pdf",
        detail: "El bot puede enviarlo al cliente",
        tag: "Público",
        tone: "ok",
      },
      {
        title: "Rutas / Tarifario_Fletes.pdf",
        detail: "Actualizado hace 2 días",
        tag: "Interno",
        tone: "neutral",
      },
    ],
  },
  {
    id: "metrics",
    label: "Métricas y HubSpot",
    title: "Métricas reales y HubSpot opcional",
    description:
      "Mide leads nuevos, porcentaje fuera de horario, tiempo hasta el primer contacto y consumo estimado de IA y WhatsApp desde una sola vista.",
    points: [
      "Activa o desactiva HubSpot con un interruptor por empresa.",
      "Crea el contacto desde el primer mensaje sin duplicar teléfonos.",
      "Escribe resumen y conversación completa en un solo campo.",
    ],
    rows: [
      {
        title: "Leads fuera de horario",
        detail: "Atendidos al instante mientras no hay equipo",
        tag: "70%",
        tone: "accent",
      },
      {
        title: "Tiempo mediano al contacto",
        detail: "De Por contactar a Contactado",
        tag: "18 min",
        tone: "ok",
      },
      {
        title: "Sincronización HubSpot",
        detail: "Activo en segundo plano sin frenar el chat",
        tag: "Conectado",
        tone: "ok",
      },
    ],
  },
];

export const FORBIDDEN_TOPIC_EXAMPLES = [
  "Rentabilidad garantizada",
  "Reclamos legales",
  "Descuentos fuera de lista",
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
