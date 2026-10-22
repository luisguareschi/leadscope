import type { NextConfig } from "next";

// The panel is client-side only: pages fetch from the Express backend with React Query.
// Cache Components and partial prefetching only matter for server-rendered data, so they stay off.
const nextConfig: NextConfig = {
  devIndicators: false,
  // Integraciones is a section of Configuración now.
  async redirects() {
    return [
      {
        source: "/integrations",
        destination: "/settings?tab=integrations",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
