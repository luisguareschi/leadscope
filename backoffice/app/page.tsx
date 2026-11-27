import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";

const TITLE = "LeadScope | Asistente de WhatsApp con IA para equipos de ventas";
const DESCRIPTION =
  "LeadScope responde a tus leads de WhatsApp en segundos con tus propios archivos, los califica a toda hora y le entrega a tu equipo un resumen listo para llamar.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/",
    siteName: "LeadScope",
    locale: "es_ES",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function Home() {
  return <LandingPage />;
}
