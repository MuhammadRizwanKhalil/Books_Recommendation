# ══════════════════════════════════════════════════════════════════════════════
# BookDiscovery — Backend Dockerfile (Multi-stage)
# Supports both development and production builds
# ══════════════════════════════════════════════════════════════════════════════

# ── Base stage: shared Node.js setup ─────────────────────────────────────────
FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache python3 make g++ && \
    corepack enable

# ── Dependencies stage: install all deps ─────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps || npm install --legacy-peer-deps

# ── Development stage: hot-reload with tsx watch ─────────────────────────────
FROM deps AS development
ENV NODE_ENV=development
# Enable polling for Docker bind-mount file watching
ENV CHOKIDAR_USEPOLLING=true
COPY . .
RUN mkdir -p /app/uploads
EXPOSE 3001
CMD ["npx", "tsx", "watch", "--clear-screen=false", "src/index.ts"]

# ── Build stage: compile TypeScript ──────────────────────────────────────────
FROM deps AS build
COPY . .
RUN npx tsc

# ── Production stage: lean runtime image ─────────────────────────────────────
FROM node:22-alpine AS production
LABEL maintainer="BookDiscovery" \
      description="BookDiscovery API Server"
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json* ./
RUN apk add --no-cache wget && \
    npm ci --legacy-peer-deps --omit=dev 2>/dev/null || npm install --legacy-peer-deps --omit=dev && \
    npm cache clean --force

# Copy compiled output + any non-TS assets
COPY --from=build /app/dist ./dist
COPY --from=build /app/src/services ./src/services
RUN mkdir -p /app/uploads

# Add non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup && \
    chown -R appuser:appgroup /app
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=30s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

EXPOSE 3001
CMD ["node", "dist/index.js"]
