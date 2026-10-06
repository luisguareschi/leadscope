FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
ENV DATABASE_URL=postgresql://leadscope:leadscope@localhost:5432/leadscope
ENV DIRECT_URL=postgresql://leadscope:leadscope@localhost:5432/leadscope
RUN npm ci && npx prisma generate
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY prisma ./prisma
ENV DATABASE_URL=postgresql://leadscope:leadscope@localhost:5432/leadscope
ENV DIRECT_URL=postgresql://leadscope:leadscope@localhost:5432/leadscope
RUN npm ci --omit=dev && npx prisma generate
COPY --from=build /app/dist ./dist
COPY fixtures ./fixtures
EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
