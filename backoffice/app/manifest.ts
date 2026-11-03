import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "LeadScope",
    short_name: "LeadScope",
    description: "Panel del asistente de WhatsApp",
    lang: "es",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f2f3f7",
    theme_color: "#f2f3f7",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
