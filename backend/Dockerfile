# LeadScope backend. One always-on container: webhook, conversation engine, and scheduled sweeps.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3001
# Migrations need DIRECT_URL (Supabase's direct connection); the app uses the pooled DATABASE_URL.
CMD ["sh", "-c", "npx prisma migrate deploy && exec node dist/index.js"]
