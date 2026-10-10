import type { NextConfig } from "next";

// The panel is client-side only: pages fetch from the Express backend with React Query.
// Cache Components and partial prefetching only matter for server-rendered data, so they stay off.
const nextConfig: NextConfig = {
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
