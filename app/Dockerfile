# ══════════════════════════════════════════════════════════════════════════════
# The Book Times — Frontend Dockerfile (Multi-stage)
# Supports both development and production builds
# ══════════════════════════════════════════════════════════════════════════════

# ── Base stage ───────────────────────────────────────────────────────────────
FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache python3 make g++ pkgconfig \
    cairo-dev pango-dev libjpeg-turbo-dev giflib-dev && \
    corepack enable

# ── Dependencies stage ───────────────────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps 2>/dev/null || npm install --legacy-peer-deps

# ── Development stage: Vite dev server with HMR ─────────────────────────────
FROM deps AS development
ENV NODE_ENV=development
COPY . .
EXPOSE 5173
CMD ["npx", "vite", "--host", "0.0.0.0"]

# ── Build stage: compile production assets ───────────────────────────────────
FROM deps AS build
COPY . .
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}
ENV NODE_ENV=production
RUN npx vite build

# ── Production stage: serve with nginx ───────────────────────────────────────
FROM nginx:alpine AS production

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
