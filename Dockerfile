ARG NODE_VERSION=20-bookworm-slim

FROM node:${NODE_VERSION} AS deps

WORKDIR /app

COPY package*.json .npmrc ./
RUN npm ci --include=dev

FROM node:${NODE_VERSION} AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package*.json nest-cli.json tsconfig*.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:${NODE_VERSION} AS runtime

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

RUN groupadd --system appgroup \
    && useradd --system --gid appgroup --create-home appuser \
    && chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "const h=require('http');h.get('http://127.0.0.1:3000/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["sh", "-c", "node dist/database/run-migrations.js && node dist/main.js"]
