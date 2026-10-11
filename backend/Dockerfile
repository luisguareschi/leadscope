# LeadScope backend. One always-on container: webhook, conversation engine, and scheduled sweeps.
FROM node:22-slim AS base
# Prisma's migration engine needs OpenSSL, which the slim image lacks.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS build
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev && npm cache clean --force

FROM base
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/prisma.config.ts ./
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3001
# Migrations need DIRECT_URL (Supabase's direct connection); the app uses the pooled DATABASE_URL.
CMD ["sh", "-c", "npx prisma migrate deploy && exec node dist/index.js"]
