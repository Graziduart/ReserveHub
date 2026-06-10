# dist/ é gerado no host antes do build (npm run build --prefix service-core)
# para evitar npm ci + nest build dentro do Docker (falhas de rede comuns no Windows).
FROM node:20-bookworm-slim AS deps
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm config set fetch-retries 5 \
  && npm config set fetch-timeout 300000 \
  && npm ci --omit=dev \
  && npx prisma generate

FROM node:20-bookworm-slim AS runner
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY --from=deps /app/node_modules ./node_modules
COPY dist ./dist
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]
