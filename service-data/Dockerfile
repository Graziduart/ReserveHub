FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY package*.json tsconfig.json tsconfig.build.json nest-cli.json eslint.config.mjs ./
COPY src ./src
RUN npm ci && npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist
EXPOSE 3002
CMD ["node", "dist/main.js"]
