FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Build
COPY . .
RUN npm run build

# --- Production image ---
FROM node:20-alpine AS production

WORKDIR /app

# Only production dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built output
COPY --from=builder /app/dist ./dist

# Run as non-root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3000

CMD ["node", "dist/main"]
