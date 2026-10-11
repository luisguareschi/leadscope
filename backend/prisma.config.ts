import "dotenv/config";
import { defineConfig } from "prisma/config";

// Migrations need a direct connection. Supabase's pooled URL (port 6543) is for the running app only.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
});
