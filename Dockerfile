# ========================================
# Stage 1: Build
# ========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for caching
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY tsconfig.json ./
COPY src/ ./src/
COPY openapi.yaml ./
RUN npm run build

# ========================================
# Stage 2: Production
# ========================================
FROM node:20-alpine AS production

WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built output and assets
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/migrations ./src/migrations
COPY openapi.yaml ./

# Non-root user for security
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup
USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/server.js"]
